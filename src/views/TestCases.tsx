import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../store';
import { ConfirmDialog, Empty, Icon, Modal } from '../components/ui';
import { TestCaseEditor, blankCase } from '../components/TestCaseEditor';
import { TestCaseImport } from '../components/TestCaseImport';
import { activityRepo, cycleRepo, executionRepo, testCaseRepo } from '../db';
import type { ExecStatus, TestCase } from '../types';
import { EXEC_ICON, EXEC_STYLE, PRIORITY_STYLE, cx, fmtDateTime, fmtNum } from '../utils';
import { exportTestCases } from '../lib/excel';
import { TAGS } from '../types';

const QUICK: (ExecStatus | 'ALL')[] = ['ALL', 'NOT RUN', 'PASS', 'FAIL', 'BLOCKED'];
const PAGE = 50;

export function TestCasesView() {
  const {
    project, cycle, modules, features, testCases, execMap, issues, planCaseIds,
    refreshProject, refreshExecutions, refreshCycles, toast, route, navigate,
  } = useApp();

  const [q, setQ] = useState('');
  const [fModule, setFModule] = useState('');
  const [fFeature, setFFeature] = useState('');
  const [fPriority, setFPriority] = useState('');
  const [fTag, setFTag] = useState('');
  const [quick, setQuick] = useState<ExecStatus | 'ALL'>('ALL');
  const [onlyPlan, setOnlyPlan] = useState(false);
  const [sel, setSel] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [editor, setEditor] = useState<Partial<TestCase> | null>(null);
  const [detail, setDetail] = useState<TestCase | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [bulk, setBulk] = useState<string>('');

  useEffect(() => {
    const qs = new URLSearchParams(route.split('?')[1] || '');
    const id = qs.get('case');
    if (id) {
      const c = testCases.find((x) => x.id === id);
      if (c) setDetail(c);
    }
    const m = qs.get('module');
    if (m) setFModule(m);
    const st = qs.get('status');
    if (st) setQuick(st as ExecStatus);
  }, [route, testCases]);

  const planSet = useMemo(() => new Set(planCaseIds), [planCaseIds]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return testCases.filter((c) => {
      if (fModule && c.moduleId !== fModule) return false;
      if (fFeature && c.featureId !== fFeature) return false;
      if (fPriority && c.priority !== fPriority) return false;
      if (fTag && !(c.tags || []).includes(fTag)) return false;
      if (onlyPlan && !planSet.has(c.id)) return false;
      if (quick !== 'ALL') {
        const st = execMap[c.id]?.status || 'NOT RUN';
        if (st !== quick) return false;
      }
      if (s) {
        const hay = `${c.caseCode} ${c.title} ${c.expectedResult} ${c.preconditions}`.toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }, [testCases, q, fModule, fFeature, fPriority, fTag, quick, onlyPlan, planSet, execMap]);

  const paged = filtered.slice((page - 1) * PAGE, page * PAGE);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  useEffect(() => { setPage(1); }, [q, fModule, fFeature, fPriority, fTag, quick, onlyPlan]);

  const closeDetail = () => {
    setDetail(null);
    if (route.includes('case=')) navigate('testcases');
  };

  const modName = (id: string) => modules.find((m) => m.id === id)?.name || '—';
  const featName = (id?: string) => features.find((f) => f.id === id)?.name || '';

  const duplicate = async (c: TestCase) => {
    const mod = modules.find((m) => m.id === c.moduleId)!;
    const code = await testCaseRepo.nextCode(project!.code, mod.code, project!.id);
    const { id, caseCode, createdAt, updatedAt, ...rest } = c;
    await testCaseRepo.create({ ...rest, caseCode: code, title: `${c.title} (copy)` } as any);
    await refreshProject();
    toast(`Đã nhân bản thành ${code}.`);
  };

  const applyBulk = async (action: string, value?: string) => {
    if (!sel.length) return;
    if (action === 'priority') {
      for (const id of sel) await testCaseRepo.update(id, { priority: value as any });
      toast(`Đã đổi Priority cho ${sel.length} Test Case.`);
    } else if (action === 'module') {
      for (const id of sel) await testCaseRepo.update(id, { moduleId: value!, featureId: undefined });
      toast(`Đã chuyển ${sel.length} Test Case sang Module mới.`);
    } else if (action === 'tag') {
      for (const id of sel) {
        const c = testCases.find((x) => x.id === id)!;
        if (!c.tags.includes(value!)) await testCaseRepo.update(id, { tags: [...c.tags, value!] });
      }
      toast(`Đã gắn tag ${value} cho ${sel.length} Test Case.`);
    } else if (action === 'owner') {
      for (const id of sel) await testCaseRepo.update(id, { owner: value });
      toast(`Đã gán Owner cho ${sel.length} Test Case.`);
    } else if (action === 'plan') {
      if (!cycle) { toast('Chưa chọn vòng UAT.', 'error'); return; }
      const cur = cycle.planCaseIds?.length ? cycle.planCaseIds : testCases.map((c) => c.id);
      const next = Array.from(new Set([...cur, ...sel]));
      await cycleRepo.update(cycle.id, { planCaseIds: next });
      await refreshCycles();
      toast(`Đã thêm ${sel.length} Test Case vào ${cycle.name}.`);
    } else if (action === 'na') {
      if (!cycle) { toast('Chưa chọn vòng UAT.', 'error'); return; }
      for (const id of sel) {
        await executionRepo.save({ projectId: project!.id, uatCycleId: cycle.id, testCaseId: id, status: 'N/A', executedAt: Date.now() } as any);
      }
      await refreshExecutions();
      toast(`Đã đánh dấu N/A cho ${sel.length} Test Case.`);
    }
    await refreshProject();
    setSel([]);
    setBulk('');
  };

  const removeSelected = async () => {
    const snapshot = testCases.filter((c) => sel.includes(c.id));
    await testCaseRepo.remove(sel);
    await refreshProject();
    setConfirmDel(false);
    setSel([]);
    toast(`Đã xoá ${snapshot.length} Test Case.`, 'ok', {
      label: 'Hoàn tác',
      run: async () => {
        await testCaseRepo.bulkCreate(snapshot.map(({ id, createdAt, updatedAt, ...r }) => r) as any);
        await refreshProject();
        toast('Đã khôi phục Test Case.');
      },
    });
  };

  if (!project) return <Empty title="Chưa chọn dự án" hint="Chọn một dự án ở thanh trên để xem Test Case."
    action={<button className="btn btn-primary" onClick={() => navigate('projects')}>Tới danh sách dự án</button>} />;

  return (
    <div className="flex flex-col h-full">
      {/* toolbar */}
      <div className="px-4 pt-4 pb-3 border-b space-y-3" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-2 flex-wrap">
          <div>
            <p className="eyebrow">{project.code}</p>
            <h1 className="text-lg font-semibold tracking-tight">Test Case</h1>
          </div>
          <span className="st st-neutral ml-1">{fmtNum(filtered.length)} / {fmtNum(testCases.length)}</span>
          <div className="flex-1" />
          <button className="btn" onClick={() => setImportOpen(true)}><Icon name="upload" size={14} /> Import Excel</button>
          <button className="btn" onClick={() => exportTestCases(project, filtered, modules, features)}>
            <Icon name="download" size={14} /> Export
          </button>
          <button className="btn btn-primary" onClick={() => setEditor(blankCase(fModule))}><Icon name="plus" size={14} /> Test Case</button>
        </div>

        <div className="flex gap-2 flex-wrap items-center">
          <div className="relative flex-1 min-w-[190px]">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 faint"><Icon name="search" size={14} /></span>
            <input className="input pl-8" placeholder="Tìm theo ID, tiêu đề, expected result…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <select className="select w-auto" value={fModule} onChange={(e) => { setFModule(e.target.value); setFFeature(''); }}>
            <option value="">Tất cả Module</option>
            {modules.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <select className="select w-auto" value={fFeature} onChange={(e) => setFFeature(e.target.value)} disabled={!fModule}>
            <option value="">Tất cả Feature</option>
            {features.filter((f) => f.moduleId === fModule).map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
          <select className="select w-auto" value={fPriority} onChange={(e) => setFPriority(e.target.value)}>
            <option value="">Mọi Priority</option>
            {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <select className="select w-auto" value={fTag} onChange={(e) => setFTag(e.target.value)}>
            <option value="">Mọi Tag</option>
            {TAGS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div className="flex gap-1.5 flex-wrap items-center">
          {QUICK.map((s) => (
            <button key={s} className={cx('chip', quick === s && 'chip-on')} onClick={() => setQuick(s)}>{s}</button>
          ))}
          {cycle && (
            <button className={cx('chip', onlyPlan && 'chip-on')} onClick={() => setOnlyPlan((v) => !v)}>
              Chỉ Case trong {cycle.name}
            </button>
          )}
        </div>

        {sel.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap panel px-3 py-2" style={{ background: 'var(--panel-2)' }}>
            <span className="text-[13px] font-semibold">{sel.length} Case được chọn</span>
            <select className="select w-auto" value={bulk} onChange={(e) => setBulk(e.target.value)}>
              <option value="">Thao tác hàng loạt…</option>
              <option value="priority">Đổi Priority</option>
              <option value="module">Chuyển Module</option>
              <option value="tag">Gắn Tag</option>
              <option value="owner">Gán Owner</option>
              <option value="plan">Thêm vào vòng UAT hiện tại</option>
              <option value="na">Đánh dấu N/A ở vòng hiện tại</option>
            </select>
            {bulk === 'priority' && (
              <select className="select w-auto" onChange={(e) => e.target.value && applyBulk('priority', e.target.value)} defaultValue="">
                <option value="">Chọn Priority</option>
                {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            )}
            {bulk === 'module' && (
              <select className="select w-auto" onChange={(e) => e.target.value && applyBulk('module', e.target.value)} defaultValue="">
                <option value="">Chọn Module</option>
                {modules.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            )}
            {bulk === 'tag' && (
              <select className="select w-auto" onChange={(e) => e.target.value && applyBulk('tag', e.target.value)} defaultValue="">
                <option value="">Chọn Tag</option>
                {TAGS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            )}
            {bulk === 'owner' && (
              <input className="input w-auto" placeholder="Tên Owner rồi Enter"
                onKeyDown={(e) => { if (e.key === 'Enter') applyBulk('owner', (e.target as HTMLInputElement).value); }} />
            )}
            {(bulk === 'plan' || bulk === 'na') && (
              <button className="btn btn-sm btn-primary" onClick={() => applyBulk(bulk)}>Áp dụng</button>
            )}
            <div className="flex-1" />
            <button className="btn btn-sm btn-danger" onClick={() => setConfirmDel(true)}><Icon name="trash" size={13} /> Xoá</button>
            <button className="btn btn-sm" onClick={() => setSel([])}>Bỏ chọn</button>
          </div>
        )}
      </div>

      {/* grid */}
      <div className="flex-1 overflow-auto">
        {!filtered.length ? (
          <Empty icon="cases" title={testCases.length ? 'Không có Test Case khớp bộ lọc' : 'Chưa có Test Case'}
            hint={testCases.length ? 'Thử bỏ bớt bộ lọc hoặc xoá từ khoá tìm kiếm.' : 'Tạo Test Case đầu tiên hoặc import từ file Excel sẵn có.'}
            action={!testCases.length ? <>
              <button className="btn btn-primary" onClick={() => setEditor(blankCase())}><Icon name="plus" size={14} /> Tạo Test Case</button>
              <button className="btn" onClick={() => setImportOpen(true)}>Import Excel</button>
            </> : undefined} />
        ) : (
          <table className="grid-table">
            <thead>
              <tr>
                <th style={{ width: 34 }}>
                  <input type="checkbox" aria-label="Chọn tất cả"
                    checked={paged.every((c) => sel.includes(c.id))}
                    onChange={(e) => setSel(e.target.checked
                      ? Array.from(new Set([...sel, ...paged.map((c) => c.id)]))
                      : sel.filter((id) => !paged.some((c) => c.id === id)))} />
                </th>
                <th>ID</th><th>Module</th><th>Feature</th><th>Title</th>
                <th>Priority</th><th>Status</th><th>Issue</th><th>Tester</th><th>Cập nhật</th><th></th>
              </tr>
            </thead>
            <tbody>
              {paged.map((c) => {
                const e = execMap[c.id];
                const st: ExecStatus = e?.status || 'NOT RUN';
                const linked = issues.filter((i) => i.testCaseIds.includes(c.id));
                return (
                  <tr key={c.id} className={cx(sel.includes(c.id) && 'row-selected')}>
                    <td><input type="checkbox" checked={sel.includes(c.id)} aria-label={`Chọn ${c.caseCode}`}
                      onChange={(ev) => setSel(ev.target.checked ? [...sel, c.id] : sel.filter((x) => x !== c.id))} /></td>
                    <td><button className="code link" onClick={() => setDetail(c)}>{c.caseCode}</button></td>
                    <td className="muted whitespace-nowrap">{modName(c.moduleId)}</td>
                    <td className="muted whitespace-nowrap max-w-[150px] truncate">{featName(c.featureId)}</td>
                    <td className="max-w-[380px]">
                      <button className="text-left hover:underline" onClick={() => setDetail(c)}>{c.title}</button>
                      {c.tags?.length > 0 && <span className="ml-2">{c.tags.map((t) => <span key={t} className="tag mr-1">{t}</span>)}</span>}
                    </td>
                    <td><span className={PRIORITY_STYLE[c.priority]}>{c.priority}</span></td>
                    <td><span className={EXEC_STYLE[st]}>{EXEC_ICON[st]} {st}</span></td>
                    <td className="code">{linked.length ? linked.map((i) => i.issueCode).join(', ') : ''}</td>
                    <td className="muted whitespace-nowrap">{e?.tester || c.owner || ''}</td>
                    <td className="muted whitespace-nowrap text-[12px]">{fmtDateTime(c.updatedAt)}</td>
                    <td>
                      <div className="flex gap-0.5">
                        <button className="btn btn-ghost btn-sm" onClick={() => setEditor(c)} aria-label="Sửa"><Icon name="edit" size={14} /></button>
                        <button className="btn btn-ghost btn-sm" onClick={() => duplicate(c)} aria-label="Nhân bản"><Icon name="duplicate" size={14} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-between px-4 py-2 border-t" style={{ borderColor: 'var(--border)' }}>
          <span className="text-[12.5px] muted">Trang {page}/{pages} · {fmtNum(filtered.length)} Test Case</span>
          <div className="flex gap-1">
            <button className="btn btn-sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}><Icon name="chevronLeft" size={14} /></button>
            <button className="btn btn-sm" disabled={page === pages} onClick={() => setPage((p) => p + 1)}><Icon name="chevronRight" size={14} /></button>
          </div>
        </div>
      )}

      {editor && <TestCaseEditor draft={editor} onClose={() => setEditor(null)} />}
      <TestCaseImport open={importOpen} onClose={() => setImportOpen(false)} />
      {detail && <TestCaseDetail tc={detail} onClose={closeDetail} onEdit={() => { setEditor(detail); closeDetail(); }} />}

      <ConfirmDialog open={confirmDel} danger title="Xoá Test Case"
        message={<>Xoá {sel.length} Test Case đã chọn và toàn bộ kết quả thực thi của chúng?</>}
        confirmLabel="Xoá" onCancel={() => setConfirmDel(false)} onConfirm={removeSelected} />
    </div>
  );
}

/* ---------------------------- Test Case detail ---------------------------- */
function TestCaseDetail({ tc, onClose, onEdit }: { tc: TestCase; onClose: () => void; onEdit: () => void }) {
  const { modules, features, cycles, issues } = useApp();
  const [tab, setTab] = useState<'case' | 'exec' | 'issue' | 'activity'>('case');
  const [execs, setExecs] = useState<any[]>([]);
  const [acts, setActs] = useState<any[]>([]);

  useEffect(() => {
    executionRepo.byCase(tc.id).then(setExecs);
    activityRepo.byEntity(tc.id).then(setActs);
  }, [tc.id]);

  const linked = issues.filter((i) => i.testCaseIds.includes(tc.id));
  const cycleName = (id: string) => cycles.find((c) => c.id === id)?.name || '—';

  const TABS = [
    ['case', 'Test Case'], ['exec', `Lịch sử thực thi (${execs.length})`],
    ['issue', `Issue (${linked.length})`], ['activity', 'Hoạt động'],
  ] as const;

  return (
    <Modal open lockOutside={false} width="max-w-3xl" onClose={onClose}
      title={<span className="flex items-center gap-2"><span className="code" style={{ color: 'var(--accent)' }}>{tc.caseCode}</span> {tc.title}</span>}
      subtitle={`${modules.find((m) => m.id === tc.moduleId)?.name || ''}${tc.featureId ? ` · ${features.find((f) => f.id === tc.featureId)?.name}` : ''}`}
      footer={<>
        <button className="btn" onClick={onClose}>Đóng</button>
        <button className="btn btn-primary" onClick={onEdit}><Icon name="edit" size={14} /> Sửa Test Case</button>
      </>}>
      <div className="flex gap-1 mb-4 border-b" style={{ borderColor: 'var(--border)' }}>
        {TABS.map(([k, label]) => (
          <button key={k} onClick={() => setTab(k as any)}
            className={cx('px-3 py-2 text-[13px] font-medium border-b-2 -mb-px',
              tab === k ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-transparent muted')}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'case' && (
        <div className="space-y-4 text-[13px]">
          <div className="flex gap-2 flex-wrap">
            <span className={PRIORITY_STYLE[tc.priority]}>{tc.priority}</span>
            {tc.testTypes?.map((t) => <span key={t} className="tag">{t}</span>)}
            {tc.tags?.map((t) => <span key={t} className="tag">{t}</span>)}
          </div>
          {tc.preconditions && <div><p className="eyebrow mb-1">Pre-condition</p><p className="whitespace-pre-wrap leading-6">{tc.preconditions}</p></div>}
          {tc.testData && <div><p className="eyebrow mb-1">Test Data</p><pre className="code whitespace-pre-wrap leading-6">{tc.testData}</pre></div>}
          <div>
            <p className="eyebrow mb-1">Các bước</p>
            <ol className="space-y-1">
              {tc.steps?.map((s, i) => (
                <li key={i} className="flex gap-2">
                  <span className="code muted w-4 shrink-0">{i + 1}</span>
                  <span className="leading-6">{s.action}{s.expectedResult && <span className="muted"> → {s.expectedResult}</span>}</span>
                </li>
              ))}
            </ol>
          </div>
          <div><p className="eyebrow mb-1">Expected Result</p><p className="whitespace-pre-wrap leading-6">{tc.expectedResult}</p></div>
          {tc.configKey && <div><p className="eyebrow mb-1">Config liên quan</p><span className="code">{tc.configKey}</span></div>}
        </div>
      )}

      {tab === 'exec' && (
        execs.length ? (
          <table className="grid-table">
            <thead><tr><th>Vòng UAT</th><th>Kết quả</th><th>Actual Result</th><th>Tester</th><th>Thời điểm</th></tr></thead>
            <tbody>
              {execs.sort((a, b) => (b.executedAt || 0) - (a.executedAt || 0)).map((e) => (
                <tr key={e.id}>
                  <td>{cycleName(e.uatCycleId)}</td>
                  <td><span className={EXEC_STYLE[e.status]}>{EXEC_ICON[e.status]} {e.status}</span></td>
                  <td className="max-w-[280px] muted">{e.actualResult || ''}</td>
                  <td className="muted">{e.tester || ''}</td>
                  <td className="muted whitespace-nowrap text-[12px]">{e.executedAt ? fmtDateTime(e.executedAt) : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p className="text-[13px] muted">Test Case này chưa được thực thi ở vòng UAT nào.</p>
      )}

      {tab === 'issue' && (
        linked.length ? (
          <div className="space-y-2">
            {linked.map((i) => (
              <div key={i.id} className="panel p-3" style={{ background: 'var(--panel-2)' }}>
                <div className="flex items-center gap-2">
                  <span className="code" style={{ color: 'var(--accent)' }}>{i.issueCode}</span>
                  <span className="st st-neutral">{i.status}</span>
                  <span className={PRIORITY_STYLE[i.severity]}>{i.severity}</span>
                </div>
                <p className="text-[13px] mt-1">{i.title}</p>
              </div>
            ))}
          </div>
        ) : <p className="text-[13px] muted">Chưa có Issue nào gắn với Test Case này.</p>
      )}

      {tab === 'activity' && (
        acts.length ? (
          <ul className="space-y-2">
            {acts.map((a) => (
              <li key={a.id} className="flex gap-3 text-[13px]">
                <span className="code faint whitespace-nowrap">{fmtDateTime(a.createdAt)}</span>
                <span>{a.action}{a.detail ? <span className="muted"> · {a.detail}</span> : null}</span>
              </li>
            ))}
          </ul>
        ) : <p className="text-[13px] muted">Chưa có hoạt động nào được ghi nhận.</p>
      )}
    </Modal>
  );
}
