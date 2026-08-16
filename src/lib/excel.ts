import * as XLSX from 'xlsx';
import type { Feature, Issue, Module, Project, TestCase, TestExecution, UATCycle } from '../types';
import { fmtDate, fmtDateTime, stepsToText, textToSteps } from '../utils';
import { countByModule, countCases, countIssues } from './stats';

const nameOf = (list: { id: string; name: string }[], id?: string) => list.find((x) => x.id === id)?.name || '';

function autoWidth(rows: any[][]): { wch: number }[] {
  const widths: number[] = [];
  for (const row of rows) {
    row.forEach((cell, i) => {
      const len = String(cell ?? '').split('\n').reduce((m, l) => Math.max(m, l.length), 0);
      widths[i] = Math.min(60, Math.max(widths[i] || 10, len + 2));
    });
  }
  return widths.map((wch) => ({ wch }));
}

function sheet(rows: any[][]) {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = autoWidth(rows);
  return ws;
}

/* --------------------------- Export Test Cases --------------------------- */
export function exportTestCases(project: Project, cases: TestCase[], modules: Module[], features: Feature[]) {
  const header = ['STT', 'Test Case ID', 'Module', 'Feature', 'Title', 'Priority', 'Test Type',
    'Pre-condition', 'Test Data', 'Steps', 'Expected Result', 'Tags', 'Owner'];
  const rows = [header, ...cases.map((c, i) => [
    i + 1, c.caseCode, nameOf(modules, c.moduleId), nameOf(features as any, c.featureId), c.title,
    c.priority, (c.testTypes || []).join(', '), c.preconditions || '', c.testData || '',
    stepsToText(c.steps), c.expectedResult || '', (c.tags || []).join(', '), c.owner || '',
  ])];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet(rows), 'TEST_CASES');
  XLSX.writeFile(wb, `${project.code}-TestCases-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/* ----------------------------- Import parsing ---------------------------- */
export interface ImportRow {
  rowIndex: number;
  caseCode?: string; module?: string; feature?: string; title?: string;
  precondition?: string; steps?: string; expected?: string; priority?: string;
  testData?: string; tags?: string;
  errors: string[];
}

const KEYS: Record<string, string[]> = {
  caseCode: ['testcaseid', 'caseid', 'id', 'macase', 'testcase'],
  module: ['module', 'phanhe', 'phânhệ'],
  feature: ['feature', 'chucnang', 'chứcnăng'],
  title: ['title', 'tencase', 'tên', 'noidung', 'nộidung', 'tieude', 'tiêuđề'],
  precondition: ['precondition', 'dieukien', 'điềukiện', 'tienquyet'],
  steps: ['steps', 'step', 'cacbuoc', 'cácbước', 'buoc'],
  expected: ['expected', 'expectedresult', 'ketquamongdoi', 'kếtquảmongđợi'],
  priority: ['priority', 'doiuutien', 'độưutiên', 'muctdouutien'],
  testData: ['testdata', 'dulieu', 'dữliệu'],
  tags: ['tags', 'tag', 'nhan', 'nhãn'],
};

const norm = (s: string) => String(s || '').toLowerCase().replace(/[\s_\-./]/g, '');

export function parseImportFile(data: ArrayBuffer): ImportRow[] {
  const wb = XLSX.read(data, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, blankrows: false, defval: '' });
  if (!raw.length) return [];
  const head = raw[0].map((h: any) => norm(h));
  const idx: Record<string, number> = {};
  Object.entries(KEYS).forEach(([field, aliases]) => {
    const i = head.findIndex((h: string) => aliases.some((a) => h === a || h.includes(a)));
    if (i >= 0) idx[field] = i;
  });

  return raw.slice(1).map((r, i) => {
    const get = (f: string) => (idx[f] !== undefined ? String(r[idx[f]] ?? '').trim() : '');
    const row: ImportRow = {
      rowIndex: i + 2,
      caseCode: get('caseCode'), module: get('module'), feature: get('feature'), title: get('title'),
      precondition: get('precondition'), steps: get('steps'), expected: get('expected'),
      priority: get('priority').toUpperCase(), testData: get('testData'), tags: get('tags'),
      errors: [],
    };
    if (!row.title) row.errors.push('Thiếu Title');
    if (!row.module) row.errors.push('Thiếu Module');
    return row;
  }).filter((r) => r.title || r.module || r.caseCode);
}

export const rowToSteps = (s?: string) => textToSteps(s || '');

/* ---------------------------- Export UAT Report -------------------------- */
export function exportUATReport(opts: {
  project: Project; cycle: UATCycle; cases: TestCase[]; execMap: Record<string, TestExecution>;
  modules: Module[]; features: Feature[]; issues: Issue[];
}) {
  const { project, cycle, cases, execMap, modules, features, issues } = opts;
  const counts = countCases(cases, execMap);
  const istat = countIssues(issues);
  const wb = XLSX.utils.book_new();

  /* SUMMARY */
  const summary: any[][] = [
    ['BÁO CÁO UAT'], [],
    ['Dự án', `${project.code} — ${project.name}`],
    ['Khách hàng', project.customer || ''],
    ['Vòng UAT', cycle.name],
    ['Môi trường', cycle.environment],
    ['Version', cycle.version || project.version || ''],
    ['Thời gian', `${fmtDate(cycle.startDate)} → ${fmtDate(cycle.endDate)}`],
    ['Xuất lúc', fmtDateTime(Date.now())],
    [],
    ['CHỈ SỐ', 'GIÁ TRỊ'],
    ['Tổng Test Case', counts.total],
    ['PASS', counts.pass],
    ['FAIL', counts.fail],
    ['BLOCKED', counts.blocked],
    ['SKIPPED', counts.skipped],
    ['N/A', counts.na],
    ['NOT RUN', counts.notRun],
    ['Đã thực hiện', counts.executed],
    ['Tiến độ', `${counts.progress.toFixed(1)}%`],
    ['Pass Rate', `${counts.passRate.toFixed(1)}%`],
    [],
    ['Issue đang mở', istat.open],
    ['Issue Critical đang mở', istat.critical],
    ['Chờ Retest', istat.waitingRetest],
    ['Đã Reopen', istat.reopened],
  ];
  XLSX.utils.book_append_sheet(wb, sheet(summary), 'SUMMARY');

  /* MODULE */
  const modStats = countByModule(cases, execMap, modules);
  const modRows: any[][] = [
    ['Module', 'Total', 'Pass', 'Fail', 'Blocked', 'Not Run', 'Progress', 'Pass Rate'],
    ...modStats.map((m) => [m.name, m.counts.total, m.counts.pass, m.counts.fail, m.counts.blocked,
      m.counts.notRun, `${m.counts.progress.toFixed(1)}%`, `${m.counts.passRate.toFixed(1)}%`]),
  ];
  XLSX.utils.book_append_sheet(wb, sheet(modRows), 'MODULE');

  /* TEST_CASES + EXECUTION */
  const tcRows: any[][] = [[
    'STT', 'Test Case ID', 'Module', 'Feature', 'Title', 'Priority', 'Pre-condition', 'Steps',
    'Expected Result', 'Actual Result', 'Status', 'Issue', 'Tester', 'Test Date', 'Note',
  ]];
  cases.forEach((c, i) => {
    const e = execMap[c.id];
    const linked = issues.filter((is) => is.testCaseIds.includes(c.id)).map((is) => is.issueCode).join(', ');
    tcRows.push([
      i + 1, c.caseCode, nameOf(modules, c.moduleId), nameOf(features as any, c.featureId), c.title,
      c.priority, c.preconditions || '', stepsToText(c.steps), c.expectedResult || '',
      e?.actualResult || '', e?.status || 'NOT RUN', linked, e?.tester || '',
      e?.executedAt ? fmtDateTime(e.executedAt) : '', e?.note || '',
    ]);
  });
  XLSX.utils.book_append_sheet(wb, sheet(tcRows), 'TEST_CASES');

  const execRows: any[][] = [['Test Case ID', 'Title', 'Status', 'Actual Result', 'Tester', 'Executed At', 'Evidence']];
  cases.forEach((c) => {
    const e = execMap[c.id];
    if (!e || e.status === 'NOT RUN') return;
    execRows.push([c.caseCode, c.title, e.status, e.actualResult || '', e.tester || '',
      e.executedAt ? fmtDateTime(e.executedAt) : '', (e.evidence || []).length]);
  });
  XLSX.utils.book_append_sheet(wb, sheet(execRows), 'EXECUTION');

  /* ISSUES */
  const issueRows: any[][] = [[
    'Issue ID', 'Module', 'Feature', 'Title', 'Severity', 'Status', 'Assignee',
    'Related Test Case', 'Expected', 'Actual', 'Reopen', 'Created', 'Updated',
  ]];
  issues.forEach((i) => {
    const rel = i.testCaseIds.map((id) => cases.find((c) => c.id === id)?.caseCode || '').filter(Boolean).join(', ');
    issueRows.push([i.issueCode, nameOf(modules, i.moduleId), nameOf(features as any, i.featureId), i.title,
      i.severity, i.status, i.assignee || '', rel, i.expectedResult || '', i.actualResult || '',
      i.reopenCount, fmtDateTime(i.createdAt), fmtDateTime(i.updatedAt)]);
  });
  XLSX.utils.book_append_sheet(wb, sheet(issueRows), 'ISSUES');

  /* RETEST_PENDING */
  const retestRows: any[][] = [['Issue ID', 'Title', 'Severity', 'Status', 'Fixed At', 'Related Test Case', 'Assignee']];
  issues.filter((i) => i.status === 'FIXED' || i.status === 'READY FOR RETEST').forEach((i) => {
    const rel = i.testCaseIds.map((id) => cases.find((c) => c.id === id)?.caseCode || '').filter(Boolean).join(', ');
    retestRows.push([i.issueCode, i.title, i.severity, i.status, i.fixedAt ? fmtDateTime(i.fixedAt) : '', rel, i.assignee || '']);
  });
  XLSX.utils.book_append_sheet(wb, sheet(retestRows), 'RETEST_PENDING');

  XLSX.writeFile(wb, `${project.code}-UAT-${cycle.name.replace(/\s+/g, '')}-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/* --------------------------- Copy daily report --------------------------- */
export function dailyReportText(opts: {
  project: Project; cycle: UATCycle; counts: any; issues: Issue[]; date?: Date;
}) {
  const { project, cycle, counts, issues, date = new Date() } = opts;
  const istat = countIssues(issues);
  const d = date.toLocaleDateString('vi-VN');
  return [
    `${project.code} - UAT ${d}`,
    `Vòng: ${cycle.name}${cycle.version ? ` | Version: ${cycle.version}` : ''}`,
    ``,
    `Tổng Test Case: ${counts.total}`,
    `Đã test: ${counts.executed}`,
    `PASS: ${counts.pass}`,
    `FAIL: ${counts.fail}`,
    `BLOCKED: ${counts.blocked}`,
    `Chưa test: ${counts.notRun}`,
    ``,
    `Open Issue: ${istat.open}`,
    `Critical: ${istat.critical}`,
    `Waiting Retest: ${istat.waitingRetest}`,
    ``,
    `Tiến độ: ${counts.progress.toFixed(1)}%`,
    `Pass Rate: ${counts.passRate.toFixed(1)}%`,
  ].join('\n');
}
