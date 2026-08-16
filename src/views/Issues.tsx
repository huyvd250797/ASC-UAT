import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../store';
import { ConfirmDialog, Empty, Icon } from '../components/ui';
import { IssueForm, ISSUE_STATUSES } from '../components/IssueForm';
import { activityRepo, issueRepo } from '../db';
import type { Issue } from '../types';
import { ISSUE_STYLE, OPEN_ISSUE_STATUSES, PRIORITY_STYLE, cx, daysOpen, fmtDateTime, fmtNum } from '../utils';

export function IssuesView() {
  const { project, modules, testCases, issues, refreshIssues, toast, route, navigate } = useApp();
  const [q, setQ] = useState('');
  const [fStatus, setFStatus] = useState('OPEN_ALL');
  const [fSeverity, setFSeverity] = useState('');
  const [fModule, setFModule] = useState('');
  const [draft, setDraft] = useState<Partial<Issue> | null>(null);
  const [del, setDel] = useState<Issue | null>(null);

  useEffect(() => {
    const qs = new URLSearchParams(route.split('?')[1] || '');
    const id = qs.get('issue');
    if (id) {
      const i = issues.find((x) => x.id === id);
      if (i) setDraft(i);
    }
  }, [route, issues]);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return issues.filter((i) => {
      if (fStatus === 'OPEN_ALL' ? !OPEN_ISSUE_STATUSES.includes(i.status) : fStatus && i.status !== fStatus) return false;
      if (fSeverity && i.severity !== fSeverity) return false;
      if (fModule && i.moduleId !== fModule) return false;
      if (s && !`${i.issueCode} ${i.title} ${i.actualResult}`.toLowerCase().includes(s)) return false;
      return true;
    });
  }, [issues, q, fStatus, fSeverity, fModule]);

  const changeStatus = async (i: Issue, status: string) => {
    const patch: Partial<Issue> = { status: status as any };
    if (status === 'FIXED' || status === 'READY FOR RETEST') patch.fixedAt = Date.now();
    if (status === 'CLOSED') patch.closedAt = Date.now();
    if (status === 'REOPENED') patch.reopenCount = (i.reopenCount || 0) + 1;
    await issueRepo.update(i.id, patch);
    await activityRepo.log({
      projectId: project!.id, entityType: 'ISSUE', entityId: i.id, entityCode: i.issueCode,
      action: `Issue: ${i.status} → ${status}`, user: 'Tôi',
    });
    await refreshIssues();
    toast(`${i.issueCode} → ${status}`);
  };

  if (!project) return <Empty title="Chưa chọn dự án" hint="Chọn dự án ở thanh trên."
    action={<button className="btn btn-primary" onClick={() => navigate('projects')}>Tới danh sách dự án</button>} />;

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-4 pb-3 border-b space-y-3" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-2 flex-wrap">
          <div>
            <p className="eyebrow">{project.code}</p>
            <h1 className="text-lg font-semibold tracking-tight">Issue</h1>
          </div>
          <span className="st st-neutral ml-1">{fmtNum(list.length)}</span>
          <div className="flex-1" />
          <button className="btn btn-primary" onClick={() => setDraft({
            projectId: project.id, status: 'OPEN', severity: 'HIGH', priority: 'HIGH',
            environment: 'UAT', version: project.version, testCaseIds: [], evidence: [], reopenCount: 0,
          })}><Icon name="plus" size={14} /> Tạo Issue</button>
        </div>
        <div className="flex gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 faint"><Icon name="search" size={14} /></span>
            <input className="input pl-8" placeholder="Tìm theo mã Issue, tiêu đề…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <select className="select w-auto" value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
            <option value="OPEN_ALL">Đang mở (tất cả)</option>
            <option value="">Mọi trạng thái</option>
            {ISSUE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select className="select w-auto" value={fSeverity} onChange={(e) => setFSeverity(e.target.value)}>
            <option value="">Mọi Severity</option>
            {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select className="select w-auto" value={fModule} onChange={(e) => setFModule(e.target.value)}>
            <option value="">Mọi Module</option>
            {modules.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {!list.length ? (
          <Empty icon="check" title={issues.length ? 'Không có Issue khớp bộ lọc' : 'Chưa có Issue nào'}
            hint={issues.length ? 'Đổi bộ lọc để xem các Issue khác.' : 'Issue được tạo từ Test Case FAIL trong màn hình Run UAT.'} />
        ) : (
          <table className="grid-table">
            <thead>
              <tr>
                <th>Issue ID</th><th>Module</th><th>Tiêu đề</th><th>Severity</th><th>Trạng thái</th>
                <th>Test Case</th><th>Người xử lý</th><th>Tồn</th><th>Cập nhật</th><th></th>
              </tr>
            </thead>
            <tbody>
              {list.map((i) => {
                const rel = testCases.filter((c) => i.testCaseIds.includes(c.id));
                const age = daysOpen(i.createdAt);
                const isOpen = OPEN_ISSUE_STATUSES.includes(i.status);
                return (
                  <tr key={i.id}>
                    <td><button className="code link" onClick={() => setDraft(i)}>{i.issueCode}</button></td>
                    <td className="muted whitespace-nowrap">{modules.find((m) => m.id === i.moduleId)?.name || '—'}</td>
                    <td className="max-w-[360px]">
                      <button className="text-left hover:underline" onClick={() => setDraft(i)}>{i.title}</button>
                      {i.reopenCount > 0 && <span className="tag ml-2">reopen ×{i.reopenCount}</span>}
                    </td>
                    <td><span className={PRIORITY_STYLE[i.severity]}>{i.severity}</span></td>
                    <td>
                      <select className="select" style={{ height: 26, fontSize: 11.5, width: 'auto' }}
                        value={i.status} onChange={(e) => changeStatus(i, e.target.value)}>
                        {ISSUE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td className="code">{rel.map((c) => c.caseCode).join(', ')}</td>
                    <td className="muted whitespace-nowrap">{i.assignee || '—'}</td>
                    <td className={cx('code', isOpen && age > 7 && 'font-semibold')}
                      style={{ color: isOpen && age > 7 ? 'var(--fail)' : isOpen && age > 3 ? 'var(--blocked)' : undefined }}>
                      {isOpen ? `${age}d` : '—'}
                    </td>
                    <td className="muted whitespace-nowrap text-[12px]">{fmtDateTime(i.updatedAt)}</td>
                    <td>
                      <div className="flex gap-0.5">
                        <button className="btn btn-ghost btn-sm" onClick={() => setDraft(i)} aria-label="Sửa"><Icon name="edit" size={14} /></button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setDel(i)} aria-label="Xoá"><Icon name="trash" size={14} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {draft && <IssueForm draft={draft} onClose={() => { setDraft(null); if (route.includes('issue=')) navigate('issues'); }} />}

      <ConfirmDialog open={!!del} danger title="Xoá Issue"
        message={<>Xoá <b>{del?.issueCode}</b> khỏi dự án? Lịch sử thực thi của Test Case vẫn được giữ nguyên.</>}
        confirmLabel="Xoá Issue" onCancel={() => setDel(null)}
        onConfirm={async () => { await issueRepo.remove(del!.id); setDel(null); await refreshIssues(); toast('Đã xoá Issue.'); }} />
    </div>
  );
}
