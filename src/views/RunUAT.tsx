import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../store';
import { Empty, EvidenceBox, Field, Icon } from '../components/ui';
import { IssueForm } from '../components/IssueForm';
import { activityRepo, executionRepo } from '../db';
import type { ExecStatus, Evidence, Issue, TestCase } from '../types';
import { EXEC_ICON, EXEC_STYLE, PRIORITY_STYLE, cx, fmtNum } from '../utils';

const BLOCK_REASONS = [
  'Không có tài khoản test',
  'Chưa có dữ liệu',
  'Server lỗi / môi trường không truy cập được',
  'Chức năng phụ thuộc chưa hoàn thành',
  'Không đủ quyền',
];

export function RunUATView() {
  const {
    project, cycle, loading, planCases, execMap, modules, features, issues,
    refreshExecutions, refreshIssues, toast, navigate,
  } = useApp();

  const [scope, setScope] = useState<'ALL' | 'NOT RUN' | 'FAIL' | 'BLOCKED'>('NOT RUN');
  const [fModule, setFModule] = useState('');
  const [idx, setIdx] = useState(0);
  const [actual, setActual] = useState('');
  const [note, setNote] = useState('');
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [failPanel, setFailPanel] = useState(false);
  const [blockPanel, setBlockPanel] = useState(false);
  const [issueDraft, setIssueDraft] = useState<Partial<Issue> | null>(null);

  /** Hàng đợi được chốt lại khi đổi bộ lọc / vòng UAT, KHÔNG lọc lại theo kết quả vừa ghi.
   *  Nhờ vậy sau khi bấm FAIL, Test Case vẫn hiển thị để kịp tạo Issue. */
  const execMapRef = useRef(execMap);
  execMapRef.current = execMap;
  const [queueIds, setQueueIds] = useState<string[]>([]);

  useEffect(() => {
    let list = planCases;
    if (fModule) list = list.filter((c) => c.moduleId === fModule);
    if (scope !== 'ALL') list = list.filter((c) => (execMapRef.current[c.id]?.status || 'NOT RUN') === scope);
    setQueueIds(list.map((c) => c.id));
    setIdx(0);
  }, [planCases, fModule, scope, cycle?.id]);

  const queue = useMemo(
    () => queueIds.map((id) => planCases.find((c) => c.id === id)).filter(Boolean) as TestCase[],
    [queueIds, planCases]);

  const current: TestCase | undefined = queue[Math.min(idx, queue.length - 1)];
  const exec = current ? execMap[current.id] : undefined;

  useEffect(() => {
    setActual(exec?.actualResult || '');
    setNote(exec?.note || '');
    setEvidence(exec?.evidence || []);
    setFailPanel(exec?.status === 'FAIL');
    setBlockPanel(exec?.status === 'BLOCKED');
  }, [current?.id, exec?.id]);

  const saveResult = useCallback(async (status: ExecStatus, extra?: { actual?: string; note?: string }) => {
    if (!current || !cycle || !project) return;
    const actualText = extra?.actual ?? actual;
    if (status === 'FAIL' && !actualText.trim()) {
      setFailPanel(true);
      toast('Nhập Actual Result trước khi ghi nhận FAIL.', 'error');
      return;
    }
    if (status === 'BLOCKED' && !(extra?.note ?? note).trim()) {
      setBlockPanel(true);
      toast('Nhập lý do BLOCKED.', 'error');
      return;
    }
    await executionRepo.save({
      projectId: project.id, uatCycleId: cycle.id, testCaseId: current.id,
      status,
      actualResult: status === 'PASS' && !actualText.trim() ? 'Kết quả đúng như mong đợi.' : actualText,
      note: extra?.note ?? note,
      evidence,
      caseSnapshot: { title: current.title, steps: current.steps, expectedResult: current.expectedResult },
      tester: cycle.tester || 'Tôi',
      executedAt: Date.now(),
    } as any);
    await activityRepo.log({
      projectId: project.id, entityType: 'EXECUTION', entityId: current.id, entityCode: current.caseCode,
      action: `${cycle.name}: ${status}`, detail: actualText?.slice(0, 120), user: cycle.tester || 'Tôi',
    });
    await refreshExecutions();
    if (status === 'PASS' || status === 'SKIPPED') {
      toast(`${current.caseCode} · ${status}`);
      next();
    }
  }, [current, cycle, project, actual, note, evidence, refreshExecutions, toast]);

  const next = () => setIdx((i) => Math.min(i + 1, Math.max(0, queue.length - 1)));
  const prev = () => setIdx((i) => Math.max(0, i - 1));

  /* keyboard shortcuts */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === 'p') { e.preventDefault(); saveResult('PASS'); }
      else if (k === 'f') { e.preventDefault(); setFailPanel(true); }
      else if (k === 'b') { e.preventDefault(); setBlockPanel(true); }
      else if (k === 'n') { e.preventDefault(); next(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [saveResult, queue.length]);

  const createIssue = () => {
    if (!current) return;
    setIssueDraft({
      projectId: project!.id, moduleId: current.moduleId, featureId: current.featureId,
      uatCycleId: cycle!.id,
      title: current.title,
      severity: current.priority === 'CRITICAL' ? 'CRITICAL' : current.priority === 'HIGH' ? 'HIGH' : 'MEDIUM',
      priority: current.priority, status: 'OPEN',
      environment: cycle!.environment, version: cycle!.version || project!.version,
      stepsToReproduce: (current.steps || []).map((s, i) => `${i + 1}. ${s.action}`).join('\n'),
      expectedResult: current.expectedResult,
      actualResult: actual,
      reporter: cycle!.tester || 'Tôi',
      testCaseIds: [current.id], evidence, reopenCount: 0,
    });
  };

  if (!project) return <Empty title="Chưa chọn dự án" hint="Chọn dự án ở thanh trên để bắt đầu."
    action={<button className="btn btn-primary" onClick={() => navigate('projects')}>Tới danh sách dự án</button>} />;

  if (loading) return <div className="p-6 text-[13px] muted">Đang tải dữ liệu dự án…</div>;

  if (!cycle) return <Empty icon="run" title="Chưa có vòng UAT"
    hint="Run UAT cần một vòng UAT để lưu kết quả riêng cho từng đợt kiểm thử."
    action={<button className="btn btn-primary" onClick={() => navigate('settings')}>Tạo vòng UAT</button>} />;

  const linkedIssues = current ? issues.filter((i) => i.testCaseIds.includes(current.id)) : [];

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b flex items-center gap-2 flex-wrap" style={{ borderColor: 'var(--border)' }}>
        <div>
          <p className="eyebrow">{project.code} · {cycle.name} · {cycle.environment}</p>
          <h1 className="text-lg font-semibold tracking-tight">Run UAT</h1>
        </div>
        <div className="flex-1" />
        <select className="select w-auto" value={fModule} onChange={(e) => setFModule(e.target.value)}>
          <option value="">Tất cả Module</option>
          {modules.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <select className="select w-auto" value={scope} onChange={(e) => setScope(e.target.value as any)}>
          <option value="NOT RUN">Chưa test</option>
          <option value="ALL">Toàn bộ Case trong vòng</option>
          <option value="FAIL">Đang FAIL</option>
          <option value="BLOCKED">Đang BLOCKED</option>
        </select>
      </div>

      {!queue.length ? (
        <Empty icon="check" title="Không còn Test Case nào trong hàng đợi"
          hint={scope === 'NOT RUN'
            ? 'Tất cả Test Case thuộc bộ lọc này đã được thực thi. Đổi bộ lọc để chạy lại hoặc xem Dashboard.'
            : 'Đổi bộ lọc để chọn nhóm Test Case khác.'}
          action={<button className="btn btn-primary" onClick={() => navigate('dashboard')}>Xem Dashboard</button>} />
      ) : current && (
        <div className="flex-1 overflow-auto">
          <div className="max-w-5xl mx-auto p-4 space-y-3">
            {/* progress bar of queue */}
            <div className="flex items-center gap-3">
              <button className="btn btn-sm" onClick={prev} disabled={idx === 0} aria-label="Case trước"><Icon name="chevronLeft" size={14} /></button>
              <div className="flex-1">
                <div className="bar"><div style={{ width: `${((idx + 1) / queue.length) * 100}%`, background: 'var(--accent)' }} /></div>
              </div>
              <span className="code text-[12.5px] muted whitespace-nowrap">CASE {idx + 1} / {fmtNum(queue.length)}</span>
              <button className="btn btn-sm" onClick={next} disabled={idx >= queue.length - 1} aria-label="Case tiếp theo"><Icon name="chevronRight" size={14} /></button>
            </div>

            <div className="grid lg:grid-cols-2 gap-3">
              {/* left: case */}
              <div className="panel p-4">
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <span className="code font-semibold" style={{ color: 'var(--accent)' }}>{current.caseCode}</span>
                  <span className={PRIORITY_STYLE[current.priority]}>{current.priority}</span>
                  {exec && <span className={EXEC_STYLE[exec.status]}>{EXEC_ICON[exec.status]} {exec.status}</span>}
                </div>
                <h2 className="text-[15px] font-semibold leading-snug">{current.title}</h2>
                <p className="text-[12.5px] muted mt-0.5">
                  {modules.find((m) => m.id === current.moduleId)?.name}
                  {current.featureId ? ` · ${features.find((f) => f.id === current.featureId)?.name}` : ''}
                </p>

                {current.preconditions && (
                  <div className="mt-3">
                    <p className="eyebrow mb-1">Pre-condition</p>
                    <p className="text-[13px] whitespace-pre-wrap leading-6">{current.preconditions}</p>
                  </div>
                )}
                {current.testData && (
                  <div className="mt-3">
                    <p className="eyebrow mb-1">Test Data</p>
                    <pre className="code text-[12px] whitespace-pre-wrap leading-6">{current.testData}</pre>
                  </div>
                )}
                <div className="mt-3">
                  <p className="eyebrow mb-1">Các bước</p>
                  <ol className="space-y-1">
                    {current.steps?.map((s, i) => (
                      <li key={i} className="flex gap-2 text-[13px]">
                        <span className="code muted w-4 shrink-0">{i + 1}</span>
                        <span className="leading-6">{s.action}</span>
                      </li>
                    ))}
                  </ol>
                </div>
                <div className="mt-3 rounded-lg p-3" style={{ background: 'var(--accent-soft)' }}>
                  <p className="eyebrow mb-1">Expected Result</p>
                  <p className="text-[13px] whitespace-pre-wrap leading-6">{current.expectedResult}</p>
                </div>
              </div>

              {/* right: result */}
              <div className="panel p-4 flex flex-col">
                <p className="eyebrow mb-2">Kết quả thực tế</p>
                <textarea className="textarea" style={{ minHeight: 110 }} value={actual}
                  onChange={(e) => setActual(e.target.value)}
                  placeholder={failPanel
                    ? 'Bắt buộc khi FAIL. Ví dụ: Hệ thống vẫn cho đăng ký, tổng tín chỉ lên 27.'
                    : 'PASS không bắt buộc nhập. Ghi lại nếu cần lưu vết.'} />

                {blockPanel && (
                  <div className="mt-3">
                    <Field label="Lý do BLOCKED" required>
                      <input className="input" value={note} onChange={(e) => setNote(e.target.value)}
                        placeholder="Vì sao chưa test được?" />
                    </Field>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {BLOCK_REASONS.map((r) => (
                        <button key={r} className="chip" style={{ height: 24, fontSize: 11.5 }} onClick={() => setNote(r)}>{r}</button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-3">
                  <p className="eyebrow mb-1.5">Evidence</p>
                  <EvidenceBox items={evidence} onChange={setEvidence} compact />
                </div>

                {linkedIssues.length > 0 && (
                  <div className="mt-3">
                    <p className="eyebrow mb-1">Issue liên quan</p>
                    <div className="flex flex-wrap gap-1.5">
                      {linkedIssues.map((i) => (
                        <button key={i.id} className="chip" onClick={() => navigate(`issues?issue=${i.id}`)}>
                          <span className="code">{i.issueCode}</span> · {i.status}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex-1" />

                <div className="grid grid-cols-3 gap-2 mt-4">
                  <button className="btn btn-lg btn-pass" onClick={() => saveResult('PASS')}>PASS</button>
                  <button className="btn btn-lg btn-fail" onClick={() => {
                    if (!failPanel) { setFailPanel(true); return; }
                    saveResult('FAIL');
                  }}>FAIL</button>
                  <button className="btn btn-lg btn-blocked" onClick={() => {
                    if (!blockPanel) { setBlockPanel(true); return; }
                    saveResult('BLOCKED');
                  }}>BLOCKED</button>
                </div>

                <div className="flex gap-2 mt-2">
                  <button className="btn btn-sm" onClick={() => saveResult('SKIPPED')}>Bỏ qua vòng này</button>
                  {(failPanel || exec?.status === 'FAIL') && (
                    <button className="btn btn-sm btn-primary" onClick={createIssue} disabled={!actual.trim()}>
                      <Icon name="bug" size={13} /> Tạo Issue
                    </button>
                  )}
                  <div className="flex-1" />
                  <button className="btn btn-sm" onClick={next}>Case tiếp <Icon name="chevronRight" size={13} /></button>
                </div>

                <p className="text-[11.5px] faint mt-2 hidden lg:block">
                  Phím tắt: <span className="kbd">P</span> PASS · <span className="kbd">F</span> FAIL · <span className="kbd">B</span> BLOCKED · <span className="kbd">N</span> Case tiếp
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {issueDraft && (
        <IssueForm draft={issueDraft} onClose={() => setIssueDraft(null)}
          onSaved={async () => { await refreshIssues(); await saveResult('FAIL'); }} />
      )}
    </div>
  );
}
