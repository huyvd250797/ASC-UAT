import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../store';
import { ConfirmDialog, Empty, Field, Icon, Modal, ProgressBar } from '../components/ui';
import { cycleRepo, executionRepo, issueRepo, projectRepo, testCaseRepo } from '../db';
import type { Project, ProjectStatus } from '../types';
import { OPEN_ISSUE_STATUSES, cx, fmtDate, fmtNum, pct } from '../utils';
import { seedDemo } from '../lib/seed';

const STATUSES: ProjectStatus[] = ['PLANNING', 'CONFIGURATION', 'INTERNAL TEST', 'UAT', 'GO-LIVE PREPARATION', 'GO-LIVE', 'CLOSED'];

const blank = (): Partial<Project> => ({
  code: '', name: '', customer: '', status: 'UAT', version: '', pm: '', consultant: '',
  startDate: '', goLiveDate: '', description: '',
});

interface Stat { cases: number; executed: number; fail: number; openIssues: number; progress: number }

export function ProjectsView() {
  const { projects, refreshProjects, selectProject, navigate, toast } = useApp();
  const [form, setForm] = useState<Partial<Project> | null>(null);
  const [stats, setStats] = useState<Record<string, Stat>>({});
  const [confirmDel, setConfirmDel] = useState<Project | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const out: Record<string, Stat> = {};
      for (const p of projects) {
        const [cases, execs, issues, cycles] = await Promise.all([
          testCaseRepo.byProject(p.id), executionRepo.byProject(p.id),
          issueRepo.byProject(p.id), cycleRepo.byProject(p.id),
        ]);
        const last = cycles.sort((a, b) => a.createdAt - b.createdAt)[cycles.length - 1];
        const cur = last ? execs.filter((e) => e.uatCycleId === last.id) : [];
        const executed = cur.filter((e) => e.status !== 'NOT RUN').length;
        out[p.id] = {
          cases: cases.length,
          executed,
          fail: cur.filter((e) => e.status === 'FAIL').length,
          openIssues: issues.filter((i) => OPEN_ISSUE_STATUSES.includes(i.status)).length,
          progress: pct(executed, cases.length),
        };
      }
      setStats(out);
    })();
  }, [projects]);

  const save = async () => {
    if (!form?.code?.trim() || !form?.name?.trim()) { toast('Nhập Mã dự án và Tên dự án.', 'error'); return; }
    if (form.id) {
      await projectRepo.update(form.id, form);
      toast('Đã lưu dự án.');
    } else {
      const p = await projectRepo.create({ ...blank(), ...form, code: form.code!.toUpperCase().trim() } as any);
      selectProject(p.id);
      toast('Đã tạo dự án.');
    }
    setForm(null);
    await refreshProjects();
  };

  const runSeed = async () => {
    setBusy(true);
    try {
      const id = await seedDemo();
      await refreshProjects();
      selectProject(id);
      toast('Đã tạo dự án mẫu EPU với Test Case, 2 vòng UAT và Issue.');
      navigate('dashboard');
    } finally { setBusy(false); }
  };

  const open = (p: Project) => { selectProject(p.id); navigate('dashboard'); };

  return (
    <div className="p-4 lg:p-6 max-w-6xl mx-auto">
      <div className="flex items-end justify-between gap-3 mb-5">
        <div>
          <p className="eyebrow">Workspace</p>
          <h1 className="text-xl font-semibold tracking-tight">Dự án</h1>
        </div>
        <div className="flex gap-2">
          {!projects.length && (
            <button className="btn" onClick={runSeed} disabled={busy}>
              {busy ? 'Đang tạo…' : 'Dùng dữ liệu mẫu'}
            </button>
          )}
          <button className="btn btn-primary" onClick={() => setForm(blank())}>
            <Icon name="plus" /> Tạo dự án
          </button>
        </div>
      </div>

      {!projects.length ? (
        <div className="panel">
          <Empty icon="folder" title="Chưa có dự án nào"
            hint="Tạo dự án đầu tiên để bắt đầu quản lý Test Case và UAT, hoặc nạp dữ liệu mẫu để xem toàn bộ luồng hoạt động."
            action={<>
              <button className="btn btn-primary" onClick={() => setForm(blank())}><Icon name="plus" /> Tạo dự án</button>
              <button className="btn" onClick={runSeed} disabled={busy}>Dùng dữ liệu mẫu</button>
            </>} />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {projects.map((p) => {
            const s = stats[p.id];
            return (
              <div key={p.id} className="panel p-4 flex flex-col gap-3 hover:border-[var(--faint)] transition-colors">
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => open(p)}>
                    <div className="flex items-center gap-2">
                      <span className="code font-semibold" style={{ color: 'var(--accent)' }}>{p.code}</span>
                      <span className="st st-neutral">{p.status}</span>
                    </div>
                    <p className="font-semibold mt-1 truncate">{p.name}</p>
                    <p className="text-[12.5px] muted truncate">{p.customer || '—'}</p>
                  </div>
                  <div className="flex gap-1">
                    <button className="btn btn-ghost btn-sm" onClick={() => setForm(p)} aria-label="Sửa"><Icon name="edit" size={14} /></button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDel(p)} aria-label="Xoá"><Icon name="trash" size={14} /></button>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[12px] muted mb-1">
                    <span>Tiến độ vòng UAT gần nhất</span>
                    <span className="code" style={{ color: 'var(--text)' }}>{(s?.progress || 0).toFixed(1)}%</span>
                  </div>
                  <ProgressBar segments={[
                    { value: s?.executed || 0, color: 'var(--accent)', label: 'Đã test' },
                    { value: Math.max(0, (s?.cases || 0) - (s?.executed || 0)), color: 'var(--panel-3)', label: 'Chưa test' },
                  ]} />
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div><p className="code text-[15px] font-semibold">{fmtNum(s?.cases || 0)}</p><p className="text-[11px] muted">Test Case</p></div>
                  <div><p className="code text-[15px] font-semibold" style={{ color: s?.fail ? 'var(--fail)' : undefined }}>{fmtNum(s?.fail || 0)}</p><p className="text-[11px] muted">FAIL</p></div>
                  <div><p className="code text-[15px] font-semibold" style={{ color: s?.openIssues ? 'var(--blocked)' : undefined }}>{fmtNum(s?.openIssues || 0)}</p><p className="text-[11px] muted">Issue mở</p></div>
                </div>

                <div className="flex items-center justify-between pt-1 border-t" style={{ borderColor: 'var(--border-soft)' }}>
                  <span className="text-[11.5px] muted">Go-live: {fmtDate(p.goLiveDate)}</span>
                  <button className="btn btn-sm" onClick={() => open(p)}>Mở <Icon name="chevronRight" size={13} /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ProjectForm form={form} setForm={setForm} onSave={save} />

      <ConfirmDialog
        open={!!confirmDel} danger requireText={confirmDel?.code}
        title="Xoá dự án"
        message={<>Xoá dự án <b>{confirmDel?.name}</b> sẽ xoá toàn bộ Module, Test Case, kết quả UAT và Issue của dự án. Hành động này không hoàn tác được.</>}
        confirmLabel="Xoá dự án"
        onCancel={() => setConfirmDel(null)}
        onConfirm={async () => {
          await projectRepo.remove(confirmDel!.id);
          setConfirmDel(null);
          await refreshProjects();
          toast('Đã xoá dự án.');
        }} />
    </div>
  );
}

export function ProjectForm({ form, setForm, onSave }: any) {
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));
  return (
    <Modal open={!!form} title={form?.id ? 'Sửa dự án' : 'Tạo dự án'} onClose={() => setForm(null)} lockOutside
      footer={<>
        <button className="btn" onClick={() => setForm(null)}>Huỷ</button>
        <button className="btn btn-primary" onClick={onSave}>Lưu dự án</button>
      </>}>
      {form && (
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Mã dự án" required hint="dùng làm tiền tố Test Case ID">
            <input className="input code" value={form.code || ''} maxLength={10}
              onChange={(e) => set('code', e.target.value.toUpperCase())} placeholder="EPU" />
          </Field>
          <Field label="Tên dự án" required>
            <input className="input" value={form.name || ''} onChange={(e) => set('name', e.target.value)}
              placeholder="Triển khai ASC University" />
          </Field>
          <Field label="Khách hàng">
            <input className="input" value={form.customer || ''} onChange={(e) => set('customer', e.target.value)}
              placeholder="Trường Đại học Điện lực" />
          </Field>
          <Field label="Trạng thái">
            <select className="select" value={form.status} onChange={(e) => set('status', e.target.value)}>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Version"><input className="input" value={form.version || ''} onChange={(e) => set('version', e.target.value)} placeholder="V3.2" /></Field>
          <Field label="Project Manager"><input className="input" value={form.pm || ''} onChange={(e) => set('pm', e.target.value)} /></Field>
          <Field label="Functional Consultant"><input className="input" value={form.consultant || ''} onChange={(e) => set('consultant', e.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Ngày bắt đầu"><input type="date" className="input" value={form.startDate || ''} onChange={(e) => set('startDate', e.target.value)} /></Field>
            <Field label="Dự kiến Go-live"><input type="date" className="input" value={form.goLiveDate || ''} onChange={(e) => set('goLiveDate', e.target.value)} /></Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Mô tả">
              <textarea className="textarea" value={form.description || ''} onChange={(e) => set('description', e.target.value)} />
            </Field>
          </div>
        </div>
      )}
    </Modal>
  );
}
