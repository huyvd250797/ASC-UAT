import React, { useEffect, useState } from 'react';
import { Field, EvidenceBox, Modal } from './ui';
import type { Issue, IssueStatus, Severity } from '../types';
import { activityRepo, issueRepo } from '../db';
import { useApp } from '../store';

const SEVERITIES: Severity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
export const ISSUE_STATUSES: IssueStatus[] = [
  'OPEN', 'ANALYZING', 'IN PROGRESS', 'FIXED', 'READY FOR RETEST', 'REOPENED',
  'CLOSED', 'REJECTED', 'DUPLICATE', 'NOT A BUG',
];

export function IssueForm({
  draft, onClose, onSaved,
}: { draft: Partial<Issue> | null; onClose: () => void; onSaved?: (i: Issue) => void }) {
  const { project, modules, features, testCases, refreshIssues, toast } = useApp();
  const [f, setF] = useState<Partial<Issue> | null>(draft);

  useEffect(() => setF(draft), [draft]);
  if (!f) return null;

  const set = (k: keyof Issue, v: any) => setF((p) => ({ ...p, [k]: v }));
  const editing = !!f.id;

  const save = async () => {
    if (!f.title?.trim()) { toast('Nhập tiêu đề Issue.', 'error'); return; }
    if (!f.actualResult?.trim()) { toast('Nhập Actual Result — đây là mô tả lỗi thực tế.', 'error'); return; }
    if (!f.moduleId) { toast('Chọn Module.', 'error'); return; }

    if (editing) {
      const prev = await issueRepo.get(f.id!);
      const patch: Partial<Issue> = { ...f };
      if (prev && prev.status !== f.status) {
        if (f.status === 'FIXED' || f.status === 'READY FOR RETEST') patch.fixedAt = Date.now();
        if (f.status === 'CLOSED') patch.closedAt = Date.now();
        if (f.status === 'REOPENED') patch.reopenCount = (prev.reopenCount || 0) + 1;
        await activityRepo.log({
          projectId: project!.id, entityType: 'ISSUE', entityId: f.id!, entityCode: f.issueCode,
          action: `Issue: ${prev.status} → ${f.status}`, user: 'Tôi',
        });
      }
      const saved = await issueRepo.update(f.id!, patch);
      toast('Đã lưu Issue.');
      onSaved?.(saved!);
    } else {
      const code = await issueRepo.nextCode(project!.code, project!.id);
      const created = await issueRepo.create({
        issueCode: code, projectId: project!.id, severity: 'HIGH', priority: 'HIGH', status: 'OPEN',
        testCaseIds: [], evidence: [], reopenCount: 0, ...f,
      } as any);
      await activityRepo.log({
        projectId: project!.id, entityType: 'ISSUE', entityId: created.id, entityCode: created.issueCode,
        action: 'Tạo Issue', detail: created.title, user: 'Tôi',
      });
      toast(`Đã tạo ${created.issueCode}.`);
      onSaved?.(created);
    }
    await refreshIssues();
    onClose();
  };

  const relatedCases = testCases.filter((c) => (f.testCaseIds || []).includes(c.id));

  return (
    <Modal open lockOutside width="max-w-3xl" onClose={onClose}
      title={editing ? `Issue ${f.issueCode}` : 'Tạo Issue từ Test Case FAIL'}
      subtitle={relatedCases.length ? `Liên kết: ${relatedCases.map((c) => c.caseCode).join(', ')}` : undefined}
      footer={<>
        <button className="btn" onClick={onClose}>Huỷ</button>
        <button className="btn btn-primary" onClick={save}>{editing ? 'Lưu Issue' : 'Tạo Issue'}</button>
      </>}>
      <div className="space-y-3">
        <Field label="Tiêu đề" required>
          <input className="input" value={f.title || ''} onChange={(e) => set('title', e.target.value)}
            placeholder="Hệ thống cho phép đăng ký vượt giới hạn tín chỉ" autoFocus />
        </Field>

        <div className="grid sm:grid-cols-4 gap-3">
          <Field label="Module" required>
            <select className="select" value={f.moduleId || ''} onChange={(e) => set('moduleId', e.target.value)}>
              <option value="">—</option>
              {modules.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </Field>
          <Field label="Feature">
            <select className="select" value={f.featureId || ''} onChange={(e) => set('featureId', e.target.value)}>
              <option value="">—</option>
              {features.filter((x) => x.moduleId === f.moduleId).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
          </Field>
          <Field label="Severity">
            <select className="select" value={f.severity || 'HIGH'} onChange={(e) => set('severity', e.target.value)}>
              {SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Trạng thái">
            <select className="select" value={f.status || 'OPEN'} onChange={(e) => set('status', e.target.value)}>
              {ISSUE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
        </div>

        <div className="grid sm:grid-cols-4 gap-3">
          <Field label="Môi trường">
            <select className="select" value={f.environment || 'UAT'} onChange={(e) => set('environment', e.target.value)}>
              {['DEV', 'TEST', 'UAT', 'STAGING'].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Version"><input className="input" value={f.version || ''} onChange={(e) => set('version', e.target.value)} /></Field>
          <Field label="Người xử lý"><input className="input" value={f.assignee || ''} onChange={(e) => set('assignee', e.target.value)} placeholder="Dev Team" /></Field>
          <Field label="Hạn xử lý"><input type="date" className="input" value={f.dueDate || ''} onChange={(e) => set('dueDate', e.target.value)} /></Field>
        </div>

        <Field label="Kết quả thực tế (Actual Result)" required>
          <textarea className="textarea" value={f.actualResult || ''} onChange={(e) => set('actualResult', e.target.value)} />
        </Field>
        <Field label="Kết quả mong đợi (Expected Result)">
          <textarea className="textarea" value={f.expectedResult || ''} onChange={(e) => set('expectedResult', e.target.value)} />
        </Field>
        <Field label="Các bước tái hiện">
          <textarea className="textarea" value={f.stepsToReproduce || ''} onChange={(e) => set('stepsToReproduce', e.target.value)} />
        </Field>
        {editing && (
          <Field label="Ghi chú xử lý (Fix note)">
            <textarea className="textarea" value={f.fixNote || ''} onChange={(e) => set('fixNote', e.target.value)}
              placeholder="Dev ghi lại đã sửa gì, cần retest phần nào." />
          </Field>
        )}

        <Field label="Evidence" hint="ảnh chụp màn hình, log">
          <EvidenceBox items={f.evidence || []} onChange={(ev) => set('evidence', ev)} compact />
        </Field>
      </div>
    </Modal>
  );
}
