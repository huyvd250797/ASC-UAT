import type { ExecStatus, Feature, Issue, Module, TestCase, TestExecution } from '../types';
import { OPEN_ISSUE_STATUSES, RETEST_STATUSES, pct } from '../utils';

export interface Counts {
  total: number;
  pass: number; fail: number; blocked: number; notRun: number; skipped: number; na: number;
  executed: number;      // PASS + FAIL + BLOCKED + SKIPPED
  applicable: number;    // total - N/A
  progress: number;      // executed / applicable
  passRate: number;      // pass / executed
}

export const emptyCounts = (): Counts => ({
  total: 0, pass: 0, fail: 0, blocked: 0, notRun: 0, skipped: 0, na: 0,
  executed: 0, applicable: 0, progress: 0, passRate: 0,
});

export function countCases(cases: TestCase[], execMap: Record<string, TestExecution>): Counts {
  const c = emptyCounts();
  c.total = cases.length;
  for (const tc of cases) {
    const st: ExecStatus = execMap[tc.id]?.status || 'NOT RUN';
    if (st === 'PASS') c.pass++;
    else if (st === 'FAIL') c.fail++;
    else if (st === 'BLOCKED') c.blocked++;
    else if (st === 'SKIPPED') c.skipped++;
    else if (st === 'N/A') c.na++;
    else c.notRun++;
  }
  c.executed = c.pass + c.fail + c.blocked + c.skipped;
  c.applicable = c.total - c.na;
  c.progress = pct(c.executed, c.applicable);
  c.passRate = pct(c.pass, c.executed);
  return c;
}

export interface GroupStat { id: string; name: string; counts: Counts }

export function countByModule(cases: TestCase[], execMap: Record<string, TestExecution>, modules: Module[]): GroupStat[] {
  return modules
    .map((m) => ({ id: m.id, name: m.name, counts: countCases(cases.filter((c) => c.moduleId === m.id), execMap) }))
    .filter((g) => g.counts.total > 0);
}

export function countByFeature(cases: TestCase[], execMap: Record<string, TestExecution>, features: Feature[], moduleId: string): GroupStat[] {
  const list = features.filter((f) => f.moduleId === moduleId);
  const stats = list.map((f) => ({
    id: f.id, name: f.name, counts: countCases(cases.filter((c) => c.featureId === f.id), execMap),
  })).filter((g) => g.counts.total > 0);
  const orphan = cases.filter((c) => c.moduleId === moduleId && !c.featureId);
  if (orphan.length) stats.push({ id: '_none', name: '(Chưa gán Feature)', counts: countCases(orphan, execMap) });
  return stats;
}

export interface IssueStats {
  open: number; critical: number; waitingRetest: number; reopened: number;
  closed: number; total: number; aging3: number; aging7: number; blocker: number;
}

export function countIssues(issues: Issue[]): IssueStats {
  const open = issues.filter((i) => OPEN_ISSUE_STATUSES.includes(i.status));
  return {
    total: issues.length,
    open: open.length,
    critical: open.filter((i) => i.severity === 'CRITICAL').length,
    blocker: open.filter((i) => i.severity === 'CRITICAL').length,
    waitingRetest: issues.filter((i) => RETEST_STATUSES.includes(i.status)).length,
    reopened: issues.filter((i) => i.status === 'REOPENED').length,
    closed: issues.filter((i) => i.status === 'CLOSED').length,
    aging3: open.filter((i) => Date.now() - i.createdAt > 3 * 86400000).length,
    aging7: open.filter((i) => Date.now() - i.createdAt > 7 * 86400000).length,
  };
}

export type Health = 'GOOD' | 'ATTENTION' | 'RISK';

export function uatHealth(counts: Counts, iss: IssueStats): Health {
  if (iss.critical > 0 || counts.blocked > 0 || counts.progress < 50) return 'RISK';
  if (counts.progress >= 95 && counts.fail === 0 && iss.open === 0) return 'GOOD';
  if (counts.fail > 0 || iss.open > 0) return 'ATTENTION';
  return 'GOOD';
}

export function dailyStats(executions: TestExecution[], issues: Issue[], dayISO: string) {
  const start = new Date(dayISO + 'T00:00:00').getTime();
  const end = start + 86400000;
  const inDay = (t?: number) => !!t && t >= start && t < end;
  const done = executions.filter((e) => inDay(e.executedAt));
  return {
    tested: done.length,
    pass: done.filter((e) => e.status === 'PASS').length,
    fail: done.filter((e) => e.status === 'FAIL').length,
    blocked: done.filter((e) => e.status === 'BLOCKED').length,
    issuesCreated: issues.filter((i) => inDay(i.createdAt)).length,
    issuesClosed: issues.filter((i) => inDay(i.closedAt)).length,
  };
}
