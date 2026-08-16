import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../store';
import { Empty, EvidenceBox, Field, Icon, Modal } from '../components/ui';
import { activityRepo, executionRepo, issueRepo } from '../db';
import type { Evidence, Issue, TestCase } from '../types';
import { EXEC_ICON, EXEC_STYLE, PRIORITY_STYLE, fmtDateTime, fmtNum, RETEST_STATUSES } from '../utils';

export function RetestView() {
  const {
    project, cycle, issues, testCases, execMap, executions,
    refreshIssues, refreshExecutions, toast, navigate,
  } = useApp();
  const [active, setActive] = useState<Issue | null>(null);

  const queue = useMemo(
    () => issues.filter((i) => RETEST_STATUSES.includes(i.status)).sort((a, b) => (b.fixedAt || 0) - (a.fixedAt || 0)),
    [issues]);

  if (!project) return <Empty title="Chưa chọn dự án" hint="Chọn dự án ở thanh trên."
    action={<button className="btn btn-primary" onClick={() => navigate('projects')}>Tới danh sách dự án</button>} />;

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b flex items-center gap-2" style={{ borderColor: 'var(--border)' }}>
        <div>
          <p className="eyebrow">{project.code}{cycle ? ` · ${cycle.name}` : ''}</p>
          <h1 className="text-lg font-semibold tracking-tight">Chờ Retest</h1>
        </div>
        <span className="st st-accent ml-1">{fmtNum(queue.length)} Issue</span>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {!queue.length ? (
          <Empty icon="check" title="Không có Issue nào chờ Retest"
            hint="Issue chuyển sang FIXED hoặc READY FOR RETEST sẽ xuất hiện ở đây. FIXED chưa đồng nghĩa PASS — Test Case chỉ PASS sau khi retest đạt." />
        ) : (
          <div className="grid gap-3 lg:grid-cols-2 max-w-6xl">
            {queue.map((i) => {
              const rel = testCases.filter((c) => i.testCaseIds.includes(c.id));
              return (
                <div key={i.id} className="panel p-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="code font-semibold" style={{ color: 'var(--accent)' }}>{i.issueCode}</span>
                    <span className={PRIORITY_STYLE[i.severity]}>{i.severity}</span>
                    <span className="st st-info">{i.status}</span>
                    {i.reopenCount > 0 && <span className="st st-blocked">reopen ×{i.reopenCount}</span>}
                  </div>
                  <p className="font-medium mt-1.5 leading-snug">{i.title}</p>
                  <p className="text-[12.5px] muted mt-1">
                    Fixed: {i.fixedAt ? fmtDateTime(i.fixedAt) : '—'}{i.assignee ? ` · ${i.assignee}` : ''}
                  </p>
                  {i.fixNote && <p className="text-[12.5px] mt-2 p-2 rounded" style={{ background: 'var(--panel-2)' }}>{i.fixNote}</p>}
                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    <span className="text-[12px] muted">Test Case:</span>
                    {rel.length ? rel.map((c) => {
                      const st = execMap[c.id]?.status || 'NOT RUN';
                      return <span key={c.id} className="code text-[12px]">{c.caseCode} <span className={EXEC_STYLE[st]}>{EXEC_ICON[st]}</span></span>;
                    }) : <span className="text-[12px] faint">chưa liên kết Test Case</span>}
                    <div className="flex-1" />
                    <button className="btn btn-sm btn-primary" onClick={() => setActive(i)} disabled={!rel.length || !cycle}>
                      <Icon name="retest" size={13} /> Retest
                    </button>
                  </div>
                  {!cycle && <p className="text-[12px] mt-2" style={{ color: 'var(--blocked)' }}>Cần chọn vòng UAT để ghi nhận kết quả retest.</p>}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {active && (
        <RetestRunner issue={active} onClose={() => setActive(null)} />
      )}
    </div>
  );
}

function RetestRunner({ issue, onClose }: { issue: Issue; onClose: () => void }) {
  const { project, cycle, testCases, execMap, refreshIssues, refreshExecutions, toast } = useApp();
  const rel = testCases.filter((c) => issue.testCaseIds.includes(c.id));
  const [i, setI] = useState(0);
  const [actual, setActual] = useState('');
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [prev, setPrev] = useState<any>(null);
  const tc: TestCase | undefined = rel[i];

  useEffect(() => {
    setActual('');
    setEvidence([]);
    if (tc) executionRepo.byCase(tc.id).then((list) => {
      setPrev(list.filter((e) => e.status === 'FAIL').sort((a, b) => (b.executedAt || 0) - (a.executedAt || 0))[0] || null);
    });
  }, [tc?.id]);

  const finish = async (pass: boolean) => {
    if (!tc || !cycle || !project) return;
    if (!pass && !actual.trim()) { toast('Nhập kết quả thực tế khi retest chưa đạt.', 'error'); return; }
    await executionRepo.save({
      projectId: project.id, uatCycleId: cycle.id, testCaseId: tc.id,
      status: pass ? 'PASS' : 'FAIL',
      actualResult: actual.trim() || (pass ? 'Retest đạt, kết quả đúng như mong đợi.' : ''),
      evidence, tester: cycle.tester || 'Tôi', executedAt: Date.now(),
      note: `Retest ${issue.issueCode}`,
    } as any);
    await activityRepo.log({
      projectId: project.id, entityType: 'EXECUTION', entityId: tc.id, entityCode: tc.caseCode,
      action: `Retest ${issue.issueCode}: ${pass ? 'PASS' : 'FAIL'}`, user: cycle.tester || 'Tôi',
    });

    const last = i >= rel.length - 1;
    if (!pass) {
      await issueRepo.update(issue.id, { status: 'REOPENED', reopenCount: (issue.reopenCount || 0) + 1 });
      await activityRepo.log({
        projectId: project.id, entityType: 'ISSUE', entityId: issue.id, entityCode: issue.issueCode,
        action: 'Retest không đạt → REOPENED', user: 'Tôi',
      });
      toast(`${issue.issueCode} đã REOPEN.`, 'error');
      await Promise.all([refreshIssues(), refreshExecutions()]);
      onClose();
      return;
    }

    if (last) {
      await issueRepo.update(issue.id, { status: 'CLOSED', closedAt: Date.now() });
      await activityRepo.log({
        projectId: project.id, entityType: 'ISSUE', entityId: issue.id, entityCode: issue.issueCode,
        action: 'Retest đạt → CLOSED', user: 'Tôi',
      });
      toast(`Retest đạt. ${issue.issueCode} đã CLOSED.`);
      await Promise.all([refreshIssues(), refreshExecutions()]);
      onClose();
    } else {
      toast(`${tc.caseCode} retest PASS.`);
      await refreshExecutions();
      setI((x) => x + 1);
    }
  };

  return (
    <Modal open lockOutside width="max-w-3xl" onClose={onClose}
      title={<span className="flex items-center gap-2">Retest <span className="code" style={{ color: 'var(--accent)' }}>{issue.issueCode}</span></span>}
      subtitle={rel.length > 1 ? `Test Case ${i + 1} / ${rel.length}` : undefined}
      footer={<>
        <button className="btn" onClick={onClose}>Để sau</button>
        <button className="btn btn-fail" onClick={() => finish(false)}>Retest FAIL → Reopen</button>
        <button className="btn btn-pass" onClick={() => finish(true)}>Retest PASS</button>
      </>}>
      {tc && (
        <div className="space-y-3">
          <div className="panel p-3" style={{ background: 'var(--panel-2)' }}>
            <div className="flex items-center gap-2">
              <span className="code" style={{ color: 'var(--accent)' }}>{tc.caseCode}</span>
              <span className={PRIORITY_STYLE[tc.priority]}>{tc.priority}</span>
            </div>
            <p className="font-medium mt-1">{tc.title}</p>
            <p className="eyebrow mt-3 mb-1">Expected Result</p>
            <p className="text-[13px] leading-6 whitespace-pre-wrap">{tc.expectedResult}</p>
          </div>

          {prev && (
            <div className="panel p-3" style={{ borderColor: 'var(--fail)' }}>
              <p className="eyebrow mb-1">Kết quả FAIL trước đó</p>
              <p className="text-[13px] leading-6 whitespace-pre-wrap">{prev.actualResult || '—'}</p>
              <p className="text-[12px] faint mt-1">{prev.executedAt ? fmtDateTime(prev.executedAt) : ''}</p>
            </div>
          )}

          {issue.fixNote && (
            <div className="panel p-3" style={{ borderColor: 'var(--info)' }}>
              <p className="eyebrow mb-1">Ghi chú xử lý từ Dev</p>
              <p className="text-[13px] leading-6 whitespace-pre-wrap">{issue.fixNote}</p>
            </div>
          )}

          <Field label="Kết quả retest">
            <textarea className="textarea" value={actual} onChange={(e) => setActual(e.target.value)}
              placeholder="Bắt buộc nhập nếu retest chưa đạt." />
          </Field>
          <Field label="Evidence">
            <EvidenceBox items={evidence} onChange={setEvidence} compact />
          </Field>
        </div>
      )}
    </Modal>
  );
}
