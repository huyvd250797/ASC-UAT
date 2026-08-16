import React, { useMemo, useState } from 'react';
import { useApp } from '../store';
import { Empty, Icon, ProgressBar } from '../components/ui';
import { countByFeature, countByModule, countCases, countIssues, dailyStats, uatHealth } from '../lib/stats';
import { cx, copyText, fmtNum, relTime, todayISO, EXEC_STYLE } from '../utils';
import { dailyReportText } from '../lib/excel';

const HEALTH_STYLE: Record<string, string> = { GOOD: 'st st-pass', ATTENTION: 'st st-amber', RISK: 'st st-fail' };

function Card({ label, value, tone, hint }: { label: string; value: React.ReactNode; tone?: string; hint?: string }) {
  return (
    <div className="panel p-3">
      <p className="eyebrow">{label}</p>
      <p className="code text-2xl font-semibold mt-1 leading-none" style={{ color: tone }}>{value}</p>
      {hint && <p className="text-[11.5px] muted mt-1.5">{hint}</p>}
    </div>
  );
}

export function DashboardView() {
  const {
    project, cycle, loading, planCases, execMap, modules, features, issues, activities,
    executions, navigate, toast,
  } = useApp();
  const [openModule, setOpenModule] = useState<string | null>(null);

  const counts = useMemo(() => countCases(planCases, execMap), [planCases, execMap]);
  const istat = useMemo(() => countIssues(issues), [issues]);
  const modStats = useMemo(() => countByModule(planCases, execMap, modules), [planCases, execMap, modules]);
  const health = uatHealth(counts, istat);
  const today = useMemo(() => dailyStats(executions, issues, todayISO()), [executions, issues]);

  if (!project) return (
    <Empty title="Chưa chọn dự án" hint="Chọn một dự án ở thanh trên, hoặc tạo dự án mới để bắt đầu."
      action={<button className="btn btn-primary" onClick={() => navigate('projects')}>Tới danh sách dự án</button>} />
  );

  if (loading) return <div className="p-6 text-[13px] muted">Đang tải dữ liệu dự án…</div>;

  const copyDaily = async () => {
    if (!cycle) return;
    const ok = await copyText(dailyReportText({ project, cycle, counts, issues }));
    toast(ok ? 'Đã copy báo cáo, dán thẳng vào Teams/Zalo/Email.' : 'Trình duyệt chặn clipboard. Mở tab Báo cáo để copy thủ công.', ok ? 'ok' : 'error');
  };

  return (
    <div className="p-4 lg:p-5 space-y-4 max-w-7xl">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <p className="eyebrow">{project.code} — {project.customer || project.name}</p>
          <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
            {cycle ? cycle.name : 'Chưa có vòng UAT'}
            {cycle && <span className={HEALTH_STYLE[health]}>{health}</span>}
          </h1>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button className="btn" onClick={() => navigate('testcases')}><Icon name="plus" size={14} /> Test Case</button>
          <button className="btn" onClick={copyDaily} disabled={!cycle}><Icon name="copy" size={14} /> Copy báo cáo ngày</button>
          <button className="btn btn-primary" onClick={() => navigate('run')}><Icon name="run" size={13} /> Run UAT</button>
        </div>
      </div>

      {!cycle ? (
        <div className="panel">
          <Empty icon="run" title="Dự án chưa có vòng UAT"
            hint="Tạo vòng UAT (Round 1, Round 2, Final…) để kết quả từng đợt được lưu riêng, không ghi đè lên nhau."
            action={<button className="btn btn-primary" onClick={() => navigate('settings')}>Tạo vòng UAT</button>} />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            <Card label="Tổng Test Case" value={fmtNum(counts.total)} hint={`${fmtNum(counts.executed)} đã thực hiện`} />
            <Card label="Pass" value={fmtNum(counts.pass)} tone="var(--pass)" />
            <Card label="Fail" value={fmtNum(counts.fail)} tone={counts.fail ? 'var(--fail)' : undefined} />
            <Card label="Blocked" value={fmtNum(counts.blocked)} tone={counts.blocked ? 'var(--blocked)' : undefined} />
            <Card label="Chưa test" value={fmtNum(counts.notRun)} />
            <Card label="Pass Rate" value={`${counts.passRate.toFixed(1)}%`} tone="var(--accent)" hint={`Tiến độ ${counts.progress.toFixed(1)}%`} />
          </div>

          <div className="panel p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="eyebrow">Tiến độ vòng UAT</p>
              <span className="code text-[13px]">{counts.progress.toFixed(1)}%</span>
            </div>
            <ProgressBar segments={[
              { value: counts.pass, color: 'var(--pass)', label: 'PASS' },
              { value: counts.fail, color: 'var(--fail)', label: 'FAIL' },
              { value: counts.blocked, color: 'var(--blocked)', label: 'BLOCKED' },
              { value: counts.skipped + counts.na, color: 'var(--neutral)', label: 'SKIPPED/NA' },
              { value: counts.notRun, color: 'var(--panel-3)', label: 'NOT RUN' },
            ]} />
            <div className="flex flex-wrap gap-3 mt-2 text-[12px] muted">
              {[['PASS', counts.pass, 'var(--pass)'], ['FAIL', counts.fail, 'var(--fail)'],
              ['BLOCKED', counts.blocked, 'var(--blocked)'], ['NOT RUN', counts.notRun, 'var(--faint)']].map(([l, v, c]) => (
                <span key={l as string} className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm" style={{ background: c as string }} />{l as string} {fmtNum(v as number)}
                </span>
              ))}
            </div>
          </div>

          {istat.critical > 0 && (
            <div className="panel p-3 flex items-center gap-3" style={{ borderColor: 'var(--fail)', background: 'var(--fail-bg)' }}>
              <span style={{ color: 'var(--fail)' }}><Icon name="alert" size={18} /></span>
              <p className="text-[13px] font-medium">
                {istat.critical} Issue mức CRITICAL đang mở. UAT chưa nên sign-off cho tới khi các lỗi này được đóng.
              </p>
              <div className="flex-1" />
              <button className="btn btn-sm" onClick={() => navigate('issues')}>Xem Issue</button>
            </div>
          )}

          <div className="grid lg:grid-cols-3 gap-4">
            {/* module progress */}
            <div className="panel p-4 lg:col-span-2">
              <div className="flex items-center justify-between mb-3">
                <p className="eyebrow">Tiến độ theo Module</p>
                <span className="text-[12px] muted">Bấm để xem chi tiết Feature</span>
              </div>
              {!modStats.length ? (
                <p className="text-[13px] muted">Chưa có Test Case nào trong vòng UAT này.</p>
              ) : (
                <div className="space-y-2.5">
                  {modStats.map((m) => (
                    <div key={m.id}>
                      <button className="w-full text-left" onClick={() => setOpenModule(openModule === m.id ? null : m.id)}>
                        <div className="flex items-center gap-2 text-[13px] mb-1">
                          <Icon name={openModule === m.id ? 'chevronDown' : 'chevronRight'} size={13} />
                          <span className="font-medium flex-1 truncate">{m.name}</span>
                          <span className="muted text-[12px]">
                            {m.counts.pass}/{m.counts.total} PASS
                            {m.counts.fail > 0 && <span style={{ color: 'var(--fail)' }}> · {m.counts.fail} FAIL</span>}
                          </span>
                          <span className="code w-12 text-right">{m.counts.progress.toFixed(0)}%</span>
                        </div>
                        <ProgressBar segments={[
                          { value: m.counts.pass, color: 'var(--pass)', label: 'PASS' },
                          { value: m.counts.fail, color: 'var(--fail)', label: 'FAIL' },
                          { value: m.counts.blocked, color: 'var(--blocked)', label: 'BLOCKED' },
                          { value: m.counts.notRun + m.counts.skipped + m.counts.na, color: 'var(--panel-3)', label: 'Chưa test' },
                        ]} />
                      </button>
                      {openModule === m.id && (
                        <div className="mt-2 ml-5 space-y-1.5">
                          {countByFeature(planCases, execMap, features, m.id).map((f) => (
                            <div key={f.id} className="flex items-center gap-2 text-[12.5px]">
                              <span className="flex-1 truncate muted">{f.name}</span>
                              <span className="muted">{f.counts.pass}/{f.counts.total}</span>
                              <div className="w-24"><ProgressBar segments={[
                                { value: f.counts.pass, color: 'var(--pass)', label: 'PASS' },
                                { value: f.counts.fail, color: 'var(--fail)', label: 'FAIL' },
                                { value: f.counts.total - f.counts.pass - f.counts.fail, color: 'var(--panel-3)', label: 'Khác' },
                              ]} /></div>
                              <button className="link text-[12px]" onClick={() => navigate(`testcases?module=${m.id}`)}>Xem</button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="panel p-4">
                <p className="eyebrow mb-3">Issue</p>
                <div className="space-y-2 text-[13px]">
                  {[
                    ['Đang mở', istat.open, 'issues'],
                    ['Critical đang mở', istat.critical, 'issues'],
                    ['Chờ Retest', istat.waitingRetest, 'retest'],
                    ['Đã Reopen', istat.reopened, 'issues'],
                    ['Tồn > 3 ngày', istat.aging3, 'issues'],
                    ['Tồn > 7 ngày', istat.aging7, 'issues'],
                  ].map(([label, v, to]) => (
                    <button key={label as string} className="flex items-center w-full hover:underline" onClick={() => navigate(to as string)}>
                      <span className="muted flex-1 text-left">{label as string}</span>
                      <span className="code font-semibold">{fmtNum(v as number)}</span>
                    </button>
                  ))}
                </div>
                {istat.waitingRetest > 0 && (
                  <button className="btn btn-sm btn-primary w-full mt-3" onClick={() => navigate('retest')}>
                    <Icon name="retest" size={13} /> Vào hàng đợi Retest
                  </button>
                )}
              </div>

              <div className="panel p-4">
                <p className="eyebrow mb-3">Hôm nay</p>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div><p className="code text-lg font-semibold">{today.tested}</p><p className="text-[11px] muted">Đã test</p></div>
                  <div><p className="code text-lg font-semibold" style={{ color: 'var(--pass)' }}>{today.pass}</p><p className="text-[11px] muted">PASS</p></div>
                  <div><p className="code text-lg font-semibold" style={{ color: 'var(--fail)' }}>{today.fail}</p><p className="text-[11px] muted">FAIL</p></div>
                  <div><p className="code text-lg font-semibold" style={{ color: 'var(--blocked)' }}>{today.blocked}</p><p className="text-[11px] muted">BLOCKED</p></div>
                  <div><p className="code text-lg font-semibold">{today.issuesCreated}</p><p className="text-[11px] muted">Issue mới</p></div>
                  <div><p className="code text-lg font-semibold">{today.issuesClosed}</p><p className="text-[11px] muted">Issue đóng</p></div>
                </div>
              </div>
            </div>
          </div>

          <div className="panel p-4">
            <p className="eyebrow mb-3">Hoạt động gần đây</p>
            {!activities.length ? (
              <p className="text-[13px] muted">Chưa có hoạt động nào. Kết quả test và thay đổi Issue sẽ được ghi lại ở đây.</p>
            ) : (
              <ul className="space-y-1.5">
                {activities.slice(0, 12).map((a) => (
                  <li key={a.id} className="flex gap-3 text-[13px] items-baseline">
                    <span className="code faint w-24 shrink-0">{relTime(a.createdAt)}</span>
                    {a.entityCode && <span className="code" style={{ color: 'var(--accent)' }}>{a.entityCode}</span>}
                    <span className="flex-1">{a.action}{a.detail ? <span className="muted"> · {a.detail}</span> : null}</span>
                    <span className="faint text-[12px] hidden sm:block">{a.user}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
