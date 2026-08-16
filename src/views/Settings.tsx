import React, { useMemo, useRef, useState } from 'react';
import { useApp } from '../store';
import { ConfirmDialog, Empty, Field, Icon, Modal } from '../components/ui';
import { ProjectForm } from './Projects';
import { backupRepo, cycleRepo, executionRepo, featureRepo, moduleRepo, projectRepo } from '../db';
import type { Environment, UATCycle } from '../types';
import { cx, downloadBlob, fmtDate, fmtNum, slugCode, todayISO } from '../utils';

const ENVS: Environment[] = ['DEV', 'TEST', 'UAT', 'STAGING'];
type Source = 'ALL' | 'FAILED' | 'FAILED_BLOCKED' | 'REGRESSION' | 'MANUAL';

export function SettingsView() {
  const {
    project, projects, cycles, cycle, modules, features, testCases, execMap,
    refreshProject, refreshProjects, refreshCycles, selectCycle, toast, navigate,
  } = useApp();
  const [tab, setTab] = useState<'cycles' | 'structure' | 'data'>('cycles');
  const [cycleForm, setCycleForm] = useState<Partial<UATCycle> | null>(null);
  const [source, setSource] = useState<Source>('ALL');
  const [projectForm, setProjectForm] = useState<any>(null);
  const [delCycle, setDelCycle] = useState<UATCycle | null>(null);
  const [newModule, setNewModule] = useState('');
  const [newFeature, setNewFeature] = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  const casesByModule = useMemo(() => {
    const m: Record<string, number> = {};
    testCases.forEach((c) => { m[c.moduleId] = (m[c.moduleId] || 0) + 1; });
    return m;
  }, [testCases]);

  if (!project) return <Empty title="Chưa chọn dự án" hint="Chọn dự án ở thanh trên."
    action={<button className="btn btn-primary" onClick={() => navigate('projects')}>Tới danh sách dự án</button>} />;

  const openNewCycle = () => {
    setSource('ALL');
    setCycleForm({
      name: `UAT Round ${cycles.length + 1}`, environment: 'UAT', version: project.version,
      startDate: todayISO(), endDate: '', status: 'IN PROGRESS', planCaseIds: [], tester: '',
    });
  };

  const saveCycle = async () => {
    if (!cycleForm?.name?.trim()) { toast('Nhập tên vòng UAT.', 'error'); return; }
    if (cycleForm.id) {
      await cycleRepo.update(cycleForm.id, cycleForm);
      toast('Đã lưu vòng UAT.');
    } else {
      let planCaseIds: string[] = [];
      if (source === 'FAILED') planCaseIds = testCases.filter((c) => execMap[c.id]?.status === 'FAIL').map((c) => c.id);
      else if (source === 'FAILED_BLOCKED') planCaseIds = testCases.filter((c) => ['FAIL', 'BLOCKED'].includes(execMap[c.id]?.status || '')).map((c) => c.id);
      else if (source === 'REGRESSION') planCaseIds = testCases.filter((c) => c.tags?.includes('REGRESSION')).map((c) => c.id);
      else if (source === 'MANUAL') planCaseIds = cycleForm.planCaseIds || [];

      if (source !== 'ALL' && !planCaseIds.length) {
        toast('Không có Test Case nào khớp lựa chọn này. Chọn nguồn khác.', 'error');
        return;
      }
      const c = await cycleRepo.create({ ...cycleForm, projectId: project.id, planCaseIds } as any);
      await refreshCycles();
      selectCycle(c.id);
      toast(`Đã tạo ${c.name}${planCaseIds.length ? ` với ${planCaseIds.length} Test Case` : ' (toàn bộ Test Case)'}.`);
    }
    setCycleForm(null);
    await refreshCycles();
  };

  const doBackup = async () => {
    const data = await backupRepo.export();
    downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
      `ASC-UAT-Backup-${new Date().toISOString().slice(0, 10)}.json`);
    toast('Đã tải file backup.');
  };

  const doRestore = async (file?: File) => {
    if (!file) return;
    try {
      const payload = JSON.parse(await file.text());
      await backupRepo.import(payload, 'replace');
      await refreshProjects();
      await refreshProject();
      toast('Đã khôi phục dữ liệu từ file backup.');
    } catch (e: any) {
      toast(`Không khôi phục được: ${e?.message || 'file không hợp lệ'}.`, 'error');
    }
  };

  const TABS = [['cycles', 'Vòng UAT'], ['structure', 'Module & Feature'], ['data', 'Dữ liệu']] as const;

  return (
    <div className="p-4 lg:p-5 max-w-5xl space-y-4">
      <div>
        <p className="eyebrow">{project.code}</p>
        <h1 className="text-xl font-semibold tracking-tight">Thiết lập dự án</h1>
      </div>

      <div className="flex gap-1 border-b" style={{ borderColor: 'var(--border)' }}>
        {TABS.map(([k, label]) => (
          <button key={k} onClick={() => setTab(k as any)}
            className={cx('px-3 py-2 text-[13px] font-medium border-b-2 -mb-px',
              tab === k ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-transparent muted')}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'cycles' && (
        <>
          <div className="panel p-4">
            <div className="flex items-center gap-2 mb-3">
              <p className="eyebrow flex-1">Thông tin dự án</p>
              <button className="btn btn-sm" onClick={() => setProjectForm(project)}><Icon name="edit" size={13} /> Sửa</button>
            </div>
            <div className="grid sm:grid-cols-3 gap-x-6 gap-y-2 text-[13px]">
              {[['Tên', project.name], ['Khách hàng', project.customer || '—'], ['Trạng thái', project.status],
              ['Version', project.version || '—'], ['PM', project.pm || '—'], ['Consultant', project.consultant || '—'],
              ['Bắt đầu', fmtDate(project.startDate)], ['Go-live', fmtDate(project.goLiveDate)],
              ['Test Case', fmtNum(testCases.length)]].map(([k, v]) => (
                <div key={k as string} className="flex justify-between gap-3 border-b pb-1" style={{ borderColor: 'var(--border-soft)' }}>
                  <span className="muted">{k as string}</span><span className="font-medium text-right truncate">{v as string}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="panel">
            <div className="flex items-center gap-2 px-4 pt-4 pb-2">
              <p className="eyebrow flex-1">Vòng UAT ({cycles.length})</p>
              <button className="btn btn-sm btn-primary" onClick={openNewCycle}><Icon name="plus" size={13} /> Tạo vòng UAT</button>
            </div>
            {!cycles.length ? (
              <p className="text-[13px] muted px-4 pb-4">Chưa có vòng UAT. Kết quả test luôn gắn với một vòng cụ thể để không ghi đè lịch sử.</p>
            ) : (
              <table className="grid-table">
                <thead><tr><th>Tên</th><th>Môi trường</th><th>Version</th><th>Thời gian</th><th>Phạm vi</th><th>Trạng thái</th><th></th></tr></thead>
                <tbody>
                  {cycles.map((c) => (
                    <tr key={c.id} className={cx(c.id === cycle?.id && 'row-selected')}>
                      <td className="font-medium">
                        <button className="link" onClick={() => selectCycle(c.id)}>{c.name}</button>
                      </td>
                      <td className="code">{c.environment}</td>
                      <td className="code muted">{c.version || '—'}</td>
                      <td className="muted whitespace-nowrap text-[12px]">{fmtDate(c.startDate)} → {fmtDate(c.endDate)}</td>
                      <td className="muted text-[12px]">{c.planCaseIds?.length ? `${c.planCaseIds.length} Case` : 'Toàn bộ'}</td>
                      <td><span className="st st-neutral">{c.status}</span></td>
                      <td>
                        <div className="flex gap-0.5">
                          <button className="btn btn-ghost btn-sm" onClick={() => { setSource('ALL'); setCycleForm(c); }} aria-label="Sửa"><Icon name="edit" size={14} /></button>
                          <button className="btn btn-ghost btn-sm" onClick={() => setDelCycle(c)} aria-label="Xoá"><Icon name="trash" size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {tab === 'structure' && (
        <div className="panel p-4">
          <div className="flex gap-2 mb-4">
            <input className="input" placeholder="Tên Module mới" value={newModule}
              onChange={(e) => setNewModule(e.target.value)}
              onKeyDown={async (e) => {
                if (e.key === 'Enter' && newModule.trim()) {
                  await moduleRepo.create({ projectId: project.id, name: newModule.trim(), code: slugCode(newModule), order: modules.length });
                  setNewModule(''); await refreshProject(); toast('Đã thêm Module.');
                }
              }} />
            <button className="btn btn-primary" onClick={async () => {
              if (!newModule.trim()) return;
              await moduleRepo.create({ projectId: project.id, name: newModule.trim(), code: slugCode(newModule), order: modules.length });
              setNewModule(''); await refreshProject(); toast('Đã thêm Module.');
            }}><Icon name="plus" size={14} /> Thêm Module</button>
          </div>

          {!modules.length ? (
            <p className="text-[13px] muted">Chưa có Module nào. Module là cách nhóm Test Case theo phân hệ nghiệp vụ.</p>
          ) : (
            <div className="space-y-3">
              {modules.map((m) => (
                <div key={m.id} className="panel p-3" style={{ background: 'var(--panel-2)' }}>
                  <div className="flex items-center gap-2">
                    <span className="code tag">{m.code}</span>
                    <input className="input flex-1" defaultValue={m.name} style={{ height: 30 }}
                      onBlur={async (e) => {
                        if (e.target.value.trim() && e.target.value !== m.name) {
                          await moduleRepo.update(m.id, { name: e.target.value.trim() }); await refreshProject();
                        }
                      }} />
                    <span className="text-[12px] muted whitespace-nowrap">{casesByModule[m.id] || 0} Case</span>
                    <button className="btn btn-ghost btn-sm" aria-label="Xoá Module"
                      onClick={async () => {
                        if (casesByModule[m.id]) { toast('Module còn Test Case, chuyển Test Case sang Module khác trước khi xoá.', 'error'); return; }
                        await moduleRepo.remove(m.id); await refreshProject(); toast('Đã xoá Module.');
                      }}><Icon name="trash" size={14} /></button>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2 ml-1">
                    {features.filter((f) => f.moduleId === m.id).map((f) => (
                      <span key={f.id} className="chip" style={{ height: 24, fontSize: 11.5 }}>
                        {f.name}
                        <button aria-label={`Xoá ${f.name}`} onClick={async () => { await featureRepo.remove(f.id); await refreshProject(); }}>
                          <Icon name="close" size={11} />
                        </button>
                      </span>
                    ))}
                    <input className="input" style={{ height: 24, width: 160, fontSize: 11.5 }} placeholder="+ Feature"
                      value={newFeature[m.id] || ''}
                      onChange={(e) => setNewFeature((s) => ({ ...s, [m.id]: e.target.value }))}
                      onKeyDown={async (e) => {
                        const v = (newFeature[m.id] || '').trim();
                        if (e.key === 'Enter' && v) {
                          await featureRepo.create({ projectId: project.id, moduleId: m.id, name: v });
                          setNewFeature((s) => ({ ...s, [m.id]: '' })); await refreshProject();
                        }
                      }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'data' && (
        <div className="space-y-4">
          <div className="panel p-4">
            <p className="eyebrow mb-2">Sao lưu &amp; khôi phục</p>
            <p className="text-[13px] muted leading-6 mb-3">
              Dữ liệu được lưu trong IndexedDB của trình duyệt trên máy này. Xoá cache trình duyệt sẽ mất dữ liệu,
              vì vậy nên tải file backup định kỳ. File backup chứa toàn bộ dự án, Test Case, kết quả UAT và Issue.
            </p>
            <div className="flex gap-2 flex-wrap">
              <button className="btn btn-primary" onClick={doBackup}><Icon name="download" size={14} /> Tải file backup</button>
              <button className="btn" onClick={() => fileRef.current?.click()}><Icon name="upload" size={14} /> Khôi phục từ backup</button>
              <input ref={fileRef} type="file" accept=".json" className="hidden"
                onChange={(e) => { doRestore(e.target.files?.[0]); e.currentTarget.value = ''; }} />
            </div>
            <p className="text-[12px] mt-2" style={{ color: 'var(--blocked)' }}>
              Khôi phục sẽ thay thế toàn bộ dữ liệu hiện có trên trình duyệt này.
            </p>
          </div>

          <div className="panel p-4">
            <p className="eyebrow mb-2">Thống kê dữ liệu</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              {[['Dự án', projects.length], ['Module', modules.length], ['Feature', features.length], ['Test Case', testCases.length]].map(([l, v]) => (
                <div key={l as string} className="panel p-3" style={{ background: 'var(--panel-2)' }}>
                  <p className="code text-lg font-semibold">{fmtNum(v as number)}</p>
                  <p className="text-[11.5px] muted">{l as string}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* cycle modal */}
      <Modal open={!!cycleForm} lockOutside width="max-w-xl" onClose={() => setCycleForm(null)}
        title={cycleForm?.id ? 'Sửa vòng UAT' : 'Tạo vòng UAT'}
        footer={<>
          <button className="btn" onClick={() => setCycleForm(null)}>Huỷ</button>
          <button className="btn btn-primary" onClick={saveCycle}>Lưu vòng UAT</button>
        </>}>
        {cycleForm && (
          <div className="space-y-3">
            <Field label="Tên vòng UAT" required>
              <input className="input" value={cycleForm.name || ''} autoFocus
                onChange={(e) => setCycleForm({ ...cycleForm, name: e.target.value })} placeholder="UAT Round 2" />
            </Field>
            <div className="grid sm:grid-cols-3 gap-3">
              <Field label="Môi trường">
                <select className="select" value={cycleForm.environment}
                  onChange={(e) => setCycleForm({ ...cycleForm, environment: e.target.value as Environment })}>
                  {ENVS.map((e) => <option key={e} value={e}>{e}</option>)}
                </select>
              </Field>
              <Field label="Version">
                <input className="input" value={cycleForm.version || ''}
                  onChange={(e) => setCycleForm({ ...cycleForm, version: e.target.value })} placeholder="V3.2.15" />
              </Field>
              <Field label="Trạng thái">
                <select className="select" value={cycleForm.status}
                  onChange={(e) => setCycleForm({ ...cycleForm, status: e.target.value as any })}>
                  {['DRAFT', 'READY', 'IN PROGRESS', 'COMPLETED', 'ARCHIVED'].map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
            </div>
            <div className="grid sm:grid-cols-3 gap-3">
              <Field label="Bắt đầu"><input type="date" className="input" value={cycleForm.startDate || ''}
                onChange={(e) => setCycleForm({ ...cycleForm, startDate: e.target.value })} /></Field>
              <Field label="Kết thúc"><input type="date" className="input" value={cycleForm.endDate || ''}
                onChange={(e) => setCycleForm({ ...cycleForm, endDate: e.target.value })} /></Field>
              <Field label="Tester phụ trách"><input className="input" value={cycleForm.tester || ''}
                onChange={(e) => setCycleForm({ ...cycleForm, tester: e.target.value })} /></Field>
            </div>

            {!cycleForm.id && (
              <Field label="Phạm vi Test Case" hint="chọn Case sẽ chạy trong vòng này">
                <select className="select" value={source} onChange={(e) => setSource(e.target.value as Source)}>
                  <option value="ALL">Toàn bộ Test Case của dự án</option>
                  <option value="FAILED">Chỉ Case đang FAIL ở vòng hiện tại</option>
                  <option value="FAILED_BLOCKED">Case đang FAIL và BLOCKED</option>
                  <option value="REGRESSION">Case gắn tag REGRESSION</option>
                </select>
                <p className="text-[12px] muted mt-1">
                  {source === 'ALL' && `${testCases.length} Test Case sẽ được đưa vào vòng này.`}
                  {source === 'FAILED' && `${testCases.filter((c) => execMap[c.id]?.status === 'FAIL').length} Case đang FAIL.`}
                  {source === 'FAILED_BLOCKED' && `${testCases.filter((c) => ['FAIL', 'BLOCKED'].includes(execMap[c.id]?.status || '')).length} Case FAIL hoặc BLOCKED.`}
                  {source === 'REGRESSION' && `${testCases.filter((c) => c.tags?.includes('REGRESSION')).length} Case gắn tag REGRESSION.`}
                </p>
              </Field>
            )}

            <Field label="Ghi chú">
              <textarea className="textarea" style={{ minHeight: 60 }} value={cycleForm.note || ''}
                onChange={(e) => setCycleForm({ ...cycleForm, note: e.target.value })} />
            </Field>
          </div>
        )}
      </Modal>

      <ProjectForm form={projectForm} setForm={setProjectForm} onSave={async () => {
        await projectRepo.update(projectForm.id, projectForm);
        setProjectForm(null);
        await refreshProjects();
        toast('Đã lưu dự án.');
      }} />

      <ConfirmDialog open={!!delCycle} danger title="Xoá vòng UAT"
        message={<>Xoá <b>{delCycle?.name}</b> sẽ xoá toàn bộ kết quả thực thi thuộc vòng này. Test Case và Issue vẫn được giữ.</>}
        confirmLabel="Xoá vòng UAT" onCancel={() => setDelCycle(null)}
        onConfirm={async () => {
          await cycleRepo.remove(delCycle!.id);
          setDelCycle(null);
          await refreshCycles();
          toast('Đã xoá vòng UAT.');
        }} />
    </div>
  );
}
