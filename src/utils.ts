import type { ExecStatus, IssueStatus, Priority, Severity } from './types';

export const cx = (...parts: (string | false | null | undefined)[]) =>
  parts.filter(Boolean).join(' ');

export const fmtNum = (n: number) => new Intl.NumberFormat('vi-VN').format(n || 0);

export const pct = (num: number, den: number) => (den ? (num / den) * 100 : 0);

export const fmtPct = (num: number, den: number) => `${pct(num, den).toFixed(1)}%`;

export const fmtDate = (t?: number | string) => {
  if (!t) return '—';
  const d = new Date(t);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('vi-VN');
};

export const fmtDateTime = (t?: number) => {
  if (!t) return '—';
  const d = new Date(t);
  return `${d.toLocaleDateString('vi-VN')} ${d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`;
};

export const todayISO = () => new Date().toISOString().slice(0, 10);

export const relTime = (t: number) => {
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 60) return 'vừa xong';
  if (s < 3600) return `${Math.floor(s / 60)} phút trước`;
  if (s < 86400) return `${Math.floor(s / 3600)} giờ trước`;
  return `${Math.floor(s / 86400)} ngày trước`;
};

export const daysOpen = (t: number) => Math.floor((Date.now() - t) / 86400000);

/* -------- Status styling (màu KHÔNG phải phương thức nhận biết duy nhất) ---- */
export const EXEC_STYLE: Record<ExecStatus, string> = {
  'PASS': 'st st-pass',
  'FAIL': 'st st-fail',
  'BLOCKED': 'st st-blocked',
  'NOT RUN': 'st st-neutral',
  'SKIPPED': 'st st-neutral',
  'N/A': 'st st-neutral',
};

export const EXEC_ICON: Record<ExecStatus, string> = {
  'PASS': '\u2713', 'FAIL': '\u2715', 'BLOCKED': '\u2298', 'NOT RUN': '\u25cb', 'SKIPPED': '\u00bb', 'N/A': '\u2013',
};

export const PRIORITY_STYLE: Record<Priority, string> = {
  CRITICAL: 'st st-fail',
  HIGH: 'st st-blocked',
  MEDIUM: 'st st-amber',
  LOW: 'st st-info',
};

export const SEVERITY_STYLE: Record<Severity, string> = PRIORITY_STYLE as any;

export const ISSUE_STYLE: Record<IssueStatus, string> = {
  'OPEN': 'st st-fail',
  'ANALYZING': 'st st-amber',
  'IN PROGRESS': 'st st-amber',
  'FIXED': 'st st-info',
  'READY FOR RETEST': 'st st-accent',
  'REOPENED': 'st st-blocked',
  'CLOSED': 'st st-pass',
  'REJECTED': 'st st-neutral',
  'DUPLICATE': 'st st-neutral',
  'NOT A BUG': 'st st-neutral',
};

export const OPEN_ISSUE_STATUSES: IssueStatus[] = [
  'OPEN', 'ANALYZING', 'IN PROGRESS', 'FIXED', 'READY FOR RETEST', 'REOPENED',
];

export const RETEST_STATUSES: IssueStatus[] = ['FIXED', 'READY FOR RETEST'];

/* ------------------------------- IO helpers -------------------------------- */
export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  }
}

export function fileToDataUrl(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new Error('Không đọc được file.'));
    r.readAsDataURL(file);
  });
}

export const slugCode = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toUpperCase().replace(/[^A-Z0-9]+/g, '').slice(0, 6) || 'MOD';

export const stepsToText = (steps: { order: number; action: string }[]) =>
  (steps || []).map((s, i) => `${i + 1}. ${s.action}`).join('\n');

export const textToSteps = (text: string) =>
  (text || '')
    .split('\n')
    .map((l) => l.replace(/^\s*\d+[.)]\s*/, '').trim())
    .filter(Boolean)
    .map((action, i) => ({ order: i + 1, action }));
