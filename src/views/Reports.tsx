import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../store';
import { ConfirmDialog, Empty, Icon, Modal } from '../components/ui';
import { countByModule, countCases, countIssues } from '../lib/stats';
import { dailyReportText, exportUATReport } from '../lib/excel';
import { copyText, fmtDate, fmtNum, OPEN_ISSUE_STATUSES, PRIORITY_STYLE, todayISO } from '../utils';
import { cycleRepo, executionRepo } from '../db';
import type { TestExecution } from '../types';

export function ReportsView() {
  const {
    project, cycle, cycles, loading, planCases, execMap, modules, features, issues, testCases,
    refreshCycles, toast, navigate,
  } = useApp();
  const [compareId, setCompareId] = useState('');
  const [compareExec, setCompareExec] = useState<TestExecution[]>([]);
  const [signOff, setSignOff] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);

  const counts = useMemo(() => countCases(planCases, execMap), [planCases, execMap]);
  const istat = useMemo(() => countIssues(issues), [issues]);
  const modStats = useMemo(() => countByModule(planCases, execMap, modules), [planCases, execMap, modules]);
  const outstanding = issues.filter((i) => OPEN_ISSUE_STATUSES.includes(i.status));

  useEffect(() => {
    if (!compareId) { setCompareExec([]); return; }
    executionRepo.byCycle(compareId).then(setCompareExec);
  }, [compareId]);

  const compare = useMemo(() => {
    if (!compareId) return null;
    const prevMap: Record<string, TestExecution> = {};
    compareExec.forEach((e) => { prevMap[e.testCaseId] = e; });
    let fixed = 0, stillFail = 0, newFail = 0;
    for (const c of planCases) {
      const p = prevMap[c.id]?.status;
      const n = execMap[c.id]?.status;
      if (p === 'FAIL' && n === 'PASS') fixed++;
      else if (p === 'FAIL' && n === 'FAIL') stillFail++;
      else if (p !== 'FAIL' && n === 'FAIL') newFail++;
    }
    return {
      prevFail: compareExec.filter((e) => e.status === 'FAIL').length,
      curFail: counts.fail, fixed, stillFail, newFail,
    };
  }, [compareId, compareExec, planCases, execMap, counts.fail]);

  if (!project) return <Empty title="Chưa chọn dự án" hint="Chọn dự án ở thanh trên."
    action={<button className="btn btn-primary" onClick={() => navigate('projects')}>Tới danh sách dự án</button>} />;
  if (loading) return <div className="p-6 text-[13px] muted">Đang tải dữ liệu dự án…</div>;
  if (!cycle) return <Empty icon="report" title="Chưa có vòng UAT" hint="Báo cáo được lập theo từng vòng UAT."
    action={<button className="btn btn-primary" onClick={() => navigate('settings')}>Tạo vòng UAT</button>} />;

  const blockers = counts.fail > 0 || counts.blocked > 0 || istat.critical > 0;

  const doExport = () => {
    try {
      exportUATReport({ project, cycle, cases: planCases, execMap, modules, features, issues });
      toast('Đã tạo file Excel báo cáo UAT.');
    } catch (e: any) {
      toast(`Không xuất được file: ${e?.message || 'lỗi không xác định'}. Thử lại.`, 'error');
    }
  };

  return (
    <div className="p-4 lg:p-5 space-y-4 max-w-6xl">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <p className="eyebrow">{project.code} · {cycle.name} · {cycle.environment} · {cycle.version || project.version}</p>
          <h1 className="text-xl font-semibold tracking-tight">Báo cáo UAT</h1>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button className="btn" onClick={() => setCopyOpen(true)}><Icon name="copy" size={14} /> Copy báo cáo nhanh</button>
          <button className="btn btn-primary" onClick={doExport}><Icon name="download" size={14} /> Export Excel</button>
        </div>
      </div>

      {/* summary */}
      <div className="panel p-4">
        <p className="eyebrow mb-3">Tổng hợp</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-2 text-[13px]">
          {[
            ['Dự án', `${project.code} — ${project.name}`],
            ['Khách hàng', project.customer || '—'],
            ['Vòng UAT', cycle.name],
            ['Thời gian', `${fmtDate(cycle.startDate)} → ${fmtDate(cycle.endDate)}`],
            ['Tổng Test Case', fmtNum(counts.total)],
            ['Đã thực hiện', fmtNum(counts.executed)],
            ['Tiến độ', `${counts.progress.toFixed(1)}%`],
            ['Pass Rate', `${counts.passRate.toFixed(1)}%`],
          ].map(([k, v]) => (
            <div key={k as string} className="flex justify-between gap-3 border-b pb-1" style={{ borderColor: 'var(--border-soft)' }}>
              <span className="muted">{k as string}</span><span className="font-medium text-right">{v as string}</span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mt-4 text-center">
          {[['PASS', counts.pass, 'var(--pass)'], ['FAIL', counts.fail, 'var(--fail)'],
          ['BLOCKED', counts.blocked, 'var(--blocked)'], ['SKIPPED', counts.skipped, undefined],
          ['N/A', counts.na, undefined], ['NOT RUN', counts.notRun, undefined]].map(([l, v, c]) => (
            <div key={l as string} className="panel p-2" style={{ background: 'var(--panel-2)' }}>
              <p className="code text-lg font-semibold" style={{ color: c as string }}>{fmtNum(v as number)}</p>
              <p className="text-[11px] muted">{l as string}</p>
            </div>
          ))}
        </div>
      </div>

      {/* module */}
      <div className="panel overflow-hidden">
        <p className="eyebrow px-4 pt-4 pb-2">Kết quả theo Module</p>
        <table className="grid-table">
          <thead><tr><th>Module</th><th>Total</th><th>Pass</th><th>Fail</th><th>Blocked</th><th>Not Run</th><th>Progress</th><th>Pass Rate</th></tr></thead>
          <tbody>
            {modStats.map((m) => (
              <tr key={m.id}>
                <td className="font-medium">{m.name}</td>
                <td className="code">{m.counts.total}</td>
                <td className="code" style={{ color: 'var(--pass)' }}>{m.counts.pass}</td>
                <td className="code" style={{ color: m.counts.fail ? 'var(--fail)' : undefined }}>{m.counts.fail}</td>
                <td className="code" style={{ color: m.counts.blocked ? 'var(--blocked)' : undefined }}>{m.counts.blocked}</td>
                <td className="code">{m.counts.notRun}</td>
                <td className="code">{m.counts.progress.toFixed(1)}%</td>
                <td className="code">{m.counts.passRate.toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* outstanding issues */}
      <div className="panel overflow-hidden">
        <p className="eyebrow px-4 pt-4 pb-2">Issue tồn đọng ({outstanding.length})</p>
        {!outstanding.length ? (
          <p className="text-[13px] muted px-4 pb-4">Không còn Issue nào đang mở.</p>
        ) : (
          <table className="grid-table">
            <thead><tr><th>Issue ID</th><th>Module</th><th>Tiêu đề</th><th>Severity</th><th>Trạng thái</th><th>Người xử lý</th><th>Test Case</th></tr></thead>
            <tbody>
              {outstanding.map((i) => (
                <tr key={i.id}>
                  <td className="code" style={{ color: 'var(--accent)' }}>{i.issueCode}</td>
                  <td className="muted">{modules.find((m) => m.id === i.moduleId)?.name || '—'}</td>
                  <td className="max-w-[320px] truncate">{i.title}</td>
                  <td><span className={PRIORITY_STYLE[i.severity]}>{i.severity}</span></td>
                  <td className="text-[12px]">{i.status}</td>
                  <td className="muted">{i.assignee || '—'}</td>
                  <td className="code text-[12px]">{testCases.filter((c) => i.testCaseIds.includes(c.id)).map((c) => c.caseCode).join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* compare */}
      <div className="panel p-4">
        <div className="flex items-center gap-2 mb-3">
          <p className="eyebrow flex-1">So sánh với vòng UAT khác</p>
          <select className="select w-auto" value={compareId} onChange={(e) => setCompareId(e.target.value)}>
            <option value="">— Chọn vòng để so sánh —</option>
            {cycles.filter((c) => c.id !== cycle.id).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        {!compare ? (
          <p className="text-[13px] muted">Chọn một vòng UAT trước đó để xem lỗi đã được xử lý và lỗi mới phát sinh.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
            {[['FAIL vòng trước', compare.prevFail], ['FAIL vòng này', compare.curFail],
            ['Đã fix', compare.fixed], ['Còn lỗi', compare.stillFail], ['Lỗi mới', compare.newFail]].map(([l, v]) => (
              <div key={l as string} className="panel p-3" style={{ background: 'var(--panel-2)' }}>
                <p className="code text-xl font-semibold">{v as number}</p>
                <p className="text-[11.5px] muted mt-1">{l as string}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* sign-off */}
      <div className="panel p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex-1">
            <p className="eyebrow">UAT Sign-off</p>
            <p className="text-[13px] muted mt-1">
              {cycle.status === 'COMPLETED'
                ? `Vòng UAT này đã được đánh dấu hoàn thành${cycle.completedAt ? ` ngày ${fmtDate(cycle.completedAt)}` : ''}.`
                : blockers
                  ? `Còn ${counts.fail} FAIL, ${counts.blocked} BLOCKED và ${istat.critical} Issue CRITICAL đang mở.`
                  : 'Không còn FAIL, BLOCKED hay Issue CRITICAL. Vòng UAT đủ điều kiện đóng.'}
            </p>
          </div>
          <button className="btn btn-primary" disabled={cycle.status === 'COMPLETED'} onClick={() => setSignOff(true)}>
            <Icon name="check" size={14} /> Đánh dấu UAT hoàn thành
          </button>
        </div>
      </div>

      <ConfirmDialog open={signOff} title="Đánh dấu UAT hoàn thành"
        danger={blockers}
        requireText={blockers ? 'HOAN THANH' : undefined}
        confirmLabel="Đánh dấu hoàn thành"
        message={blockers ? (
          <>
            <p>Vòng <b>{cycle.name}</b> vẫn còn:</p>
            <ul className="list-disc pl-5 mt-2 space-y-0.5">
              {counts.fail > 0 && <li>{counts.fail} Test Case FAIL</li>}
              {counts.blocked > 0 && <li>{counts.blocked} Test Case BLOCKED</li>}
              {istat.critical > 0 && <li>{istat.critical} Issue mức CRITICAL đang mở</li>}
              {counts.notRun > 0 && <li>{counts.notRun} Test Case chưa test</li>}
            </ul>
            <p className="mt-2">Bạn vẫn có thể đóng vòng UAT, nhưng cần xác nhận rõ ràng vì báo cáo sẽ ghi nhận trạng thái này.</p>
          </>
        ) : <>Đóng vòng <b>{cycle.name}</b> và ghi nhận UAT hoàn thành?</>}
        onCancel={() => setSignOff(false)}
        onConfirm={async () => {
          await cycleRepo.update(cycle.id, {
            status: 'COMPLETED', completedAt: Date.now(),
            completeNote: blockers ? `Đóng khi còn ${counts.fail} FAIL, ${counts.blocked} BLOCKED, ${istat.critical} Critical Issue.` : '',
          });
          await refreshCycles();
          setSignOff(false);
          toast('Đã đánh dấu vòng UAT hoàn thành.');
        }} />

      <CopyReportModal open={copyOpen} onClose={() => setCopyOpen(false)} counts={counts} />
    </div>
  );
}

function CopyReportModal({ open, onClose, counts }: any) {
  const { project, cycle, issues, toast } = useApp();
  const [date, setDate] = useState(todayISO());
  if (!open || !project || !cycle) return null;
  const text = dailyReportText({ project, cycle, counts, issues, date: new Date(date) });
  return (
    <Modal open lockOutside={false} width="max-w-lg" onClose={onClose}
      title="Báo cáo nhanh" subtitle="Định dạng text để dán vào Teams, Zalo hoặc Email."
      footer={<>
        <button className="btn" onClick={onClose}>Đóng</button>
        <button className="btn btn-primary" onClick={async () => {
          const ok = await copyText(text);
          toast(ok ? 'Đã copy vào clipboard.' : 'Không copy được, bôi đen nội dung để copy thủ công.', ok ? 'ok' : 'error');
        }}><Icon name="copy" size={14} /> Copy</button>
      </>}>
      <div className="mb-3 flex items-center gap-2">
        <span className="text-[13px] muted">Ngày báo cáo</span>
        <input type="date" className="input w-auto" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      <pre className="panel p-3 text-[12.5px] whitespace-pre-wrap leading-6" style={{ background: 'var(--panel-2)' }}>{text}</pre>
    </Modal>
  );
}
