import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../store';
import { Icon, Modal } from './ui';
import { cx, EXEC_STYLE, ISSUE_STYLE } from '../utils';
import { settingsRepo } from '../db';

const NAV = [
  { key: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
  { key: 'testcases', label: 'Test Case', icon: 'cases' },
  { key: 'run', label: 'Run UAT', icon: 'run' },
  { key: 'issues', label: 'Issue', icon: 'bug' },
  { key: 'retest', label: 'Retest', icon: 'retest' },
  { key: 'reports', label: 'Báo cáo', icon: 'report' },
  { key: 'settings', label: 'Thiết lập', icon: 'settings' },
];

export function HelpModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const steps = [
    'Tạo hoặc chọn dự án.',
    'Tạo vòng UAT (Round 1, Round 2, Final…).',
    'Tạo Test Case hoặc Import từ Excel.',
    'Bấm Run UAT để chạy lần lượt từng Test Case.',
    'Chọn PASS, FAIL hoặc BLOCKED cho từng Case.',
    'Với Case FAIL: nhập Actual Result rồi Tạo Issue.',
    'Khi Issue được Fix, vào màn hình Retest để kiểm tra lại.',
    'Theo dõi tiến độ ở Dashboard.',
    'Export báo cáo UAT khi cần gửi khách hàng.',
  ];
  const glossary: [string, string][] = [
    ['PASS', 'Kết quả đúng như mong đợi.'],
    ['FAIL', 'Kết quả sai so với mong đợi.'],
    ['BLOCKED', 'Không thể test tiếp do phụ thuộc hoặc sự cố.'],
    ['NOT RUN', 'Chưa thực hiện trong vòng UAT này.'],
    ['FIXED', 'Đã xử lý nhưng chưa được xác nhận bằng Retest.'],
    ['CLOSED', 'Đã Retest đạt và đóng Issue.'],
  ];
  return (
    <Modal open={open} onClose={onClose} width="max-w-2xl" lockOutside
      title="Hướng dẫn sử dụng ASC-UAT"
      subtitle="Quản lý Test Case, UAT Execution, Issue và Retest trong một luồng thống nhất."
      footer={<button className="btn btn-primary" onClick={onClose}>Đóng</button>}>
      <ol className="space-y-2">
        {steps.map((s, i) => (
          <li key={i} className="flex gap-3">
            <span className="code shrink-0 w-6 h-6 rounded flex items-center justify-center"
              style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>{i + 1}</span>
            <span className="text-[13px] leading-6">{s}</span>
          </li>
        ))}
      </ol>

      <div className="mt-5 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
        <p className="eyebrow mb-2">Quy ước trạng thái</p>
        <div className="grid sm:grid-cols-2 gap-2">
          {glossary.map(([k, v]) => (
            <div key={k} className="flex gap-2 items-start">
              <span className={cx('shrink-0', EXEC_STYLE[k as never] || ISSUE_STYLE[k as never] || 'st st-neutral')}>{k}</span>
              <span className="text-[12.5px] muted leading-5">{v}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
        <p className="eyebrow mb-2">Nguyên tắc quan trọng</p>
        <ul className="text-[13px] leading-6 muted list-disc pl-5">
          <li>Kết quả được lưu riêng theo từng vòng UAT — Round 1 FAIL không bị ghi đè khi Round 2 PASS.</li>
          <li>Issue ở trạng thái FIXED chưa đồng nghĩa Test Case đã PASS. Bắt buộc phải Retest.</li>
          <li>Trong Run UAT: <span className="kbd">P</span> PASS · <span className="kbd">F</span> FAIL · <span className="kbd">B</span> BLOCKED · <span className="kbd">N</span> Case tiếp theo.</li>
        </ul>
      </div>
    </Modal>
  );
}

function GlobalSearch({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { testCases, issues, features, navigate } = useApp();
  const [q, setQ] = useState('');
  useEffect(() => { if (open) setQ(''); }, [open]);

  const res = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (s.length < 1) return { cases: [], issues: [], feats: [] };
    const m = (t?: string) => (t || '').toLowerCase().includes(s);
    return {
      cases: testCases.filter((c) => m(c.caseCode) || m(c.title) || m(c.expectedResult)).slice(0, 8),
      issues: issues.filter((i) => m(i.issueCode) || m(i.title)).slice(0, 6),
      feats: features.filter((f) => m(f.name)).slice(0, 5),
    };
  }, [q, testCases, issues, features]);

  return (
    <Modal open={open} onClose={onClose} width="max-w-xl" lockOutside={false} title="Tìm nhanh"
      subtitle="Test Case ID, tiêu đề, Issue ID, tên Feature">
      <input className="input" autoFocus placeholder="Ví dụ: EPU-DKH-TC003, tín chỉ, BUG-001…"
        value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="mt-3 space-y-3 max-h-[50vh] overflow-auto">
        {res.cases.length > 0 && (
          <div>
            <p className="eyebrow mb-1">Test Case</p>
            {res.cases.map((c) => (
              <button key={c.id} className="w-full text-left px-2 py-1.5 rounded hover:bg-[var(--panel-2)] flex gap-2"
                onClick={() => { navigate(`testcases?case=${c.id}`); onClose(); }}>
                <span className="code" style={{ color: 'var(--accent)' }}>{c.caseCode}</span>
                <span className="text-[13px] truncate">{c.title}</span>
              </button>
            ))}
          </div>
        )}
        {res.issues.length > 0 && (
          <div>
            <p className="eyebrow mb-1">Issue</p>
            {res.issues.map((i) => (
              <button key={i.id} className="w-full text-left px-2 py-1.5 rounded hover:bg-[var(--panel-2)] flex gap-2"
                onClick={() => { navigate(`issues?issue=${i.id}`); onClose(); }}>
                <span className="code" style={{ color: 'var(--accent)' }}>{i.issueCode}</span>
                <span className="text-[13px] truncate">{i.title}</span>
              </button>
            ))}
          </div>
        )}
        {res.feats.length > 0 && (
          <div>
            <p className="eyebrow mb-1">Feature</p>
            {res.feats.map((f) => (
              <div key={f.id} className="px-2 py-1.5 text-[13px]">{f.name}</div>
            ))}
          </div>
        )}
        {q && !res.cases.length && !res.issues.length && !res.feats.length && (
          <p className="text-[13px] muted px-1 py-4">Không có kết quả cho “{q}”.</p>
        )}
      </div>
    </Modal>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const { project, projects, cycle, cycles, selectProject, selectCycle, route, navigate, theme, toggleTheme } = useApp();
  const [help, setHelp] = useState(false);
  const [search, setSearch] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const base = route.split('?')[0];

  useEffect(() => {
    (async () => {
      const seen = await settingsRepo.get('hasSeenUATGuide', false);
      if (!seen) { setHelp(true); settingsRepo.set('hasSeenUATGuide', true); }
    })();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setSearch(true); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const go = (k: string) => { navigate(k); setMobileNav(false); };

  const nav = (
    <nav className="flex flex-col gap-0.5 p-2">
      {NAV.map((n) => (
        <button key={n.key} onClick={() => go(n.key)}
          className={cx('flex items-center gap-2.5 px-3 h-9 rounded-md text-[13px] font-medium transition-colors',
            base === n.key ? 'text-[var(--accent)]' : 'muted hover:text-[var(--text)]')}
          style={base === n.key ? { background: 'var(--accent-soft)' } : undefined}>
          <Icon name={n.icon} />
          <span>{n.label}</span>
        </button>
      ))}
    </nav>
  );

  return (
    <div className="h-full flex flex-col">
      {/* ------------------------------ Header ------------------------------ */}
      <header className="flex items-center gap-2 px-3 h-14 border-b shrink-0"
        style={{ borderColor: 'var(--border)', background: 'var(--panel)' }}>
        <button className="btn btn-ghost btn-sm lg:hidden" onClick={() => setMobileNav((v) => !v)} aria-label="Menu">
          <Icon name="menu" />
        </button>

        <button className="flex items-center gap-2 pr-2" onClick={() => go('projects')}>
          <span className="w-7 h-7 rounded-md flex items-center justify-center font-bold text-[13px]"
            style={{ background: 'var(--accent)', color: 'var(--accent-text)' }}>UA</span>
          <span className="font-semibold tracking-tight hidden sm:block">ASC-UAT</span>
        </button>

        <div className="h-6 w-px hidden md:block" style={{ background: 'var(--border)' }} />

        <select className="select w-auto max-w-[170px] hidden md:block" value={project?.id || ''}
          onChange={(e) => selectProject(e.target.value || undefined)} aria-label="Dự án">
          <option value="">— Chọn dự án —</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.code} · {p.name}</option>)}
        </select>

        <select className="select w-auto max-w-[160px] hidden md:block" value={cycle?.id || ''}
          onChange={(e) => selectCycle(e.target.value || undefined)} aria-label="Vòng UAT" disabled={!cycles.length}>
          {!cycles.length && <option value="">— Chưa có vòng UAT —</option>}
          {cycles.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        <div className="flex-1" />

        <button className="btn btn-ghost btn-sm" onClick={() => setSearch(true)} title="Tìm nhanh (Ctrl+K)" aria-label="Tìm nhanh">
          <Icon name="search" />
        </button>
        <button className="btn btn-ghost btn-sm" onClick={() => setHelp(true)} title="Hướng dẫn sử dụng" aria-label="Hướng dẫn sử dụng">
          <Icon name="help" />
        </button>
        <button className="btn btn-ghost btn-sm" onClick={toggleTheme} aria-label="Đổi giao diện sáng/tối">
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
        </button>
        <span className="code faint hidden lg:block pl-1">v1.0</span>
      </header>

      {/* Mobile project/cycle selector */}
      <div className="md:hidden flex gap-2 px-3 py-2 border-b" style={{ borderColor: 'var(--border)', background: 'var(--panel)' }}>
        <select className="select flex-1" value={project?.id || ''} onChange={(e) => selectProject(e.target.value || undefined)}>
          <option value="">— Dự án —</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.code}</option>)}
        </select>
        <select className="select flex-1" value={cycle?.id || ''} onChange={(e) => selectCycle(e.target.value || undefined)}>
          {!cycles.length && <option value="">— Vòng UAT —</option>}
          {cycles.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <div className="flex-1 flex min-h-0">
        {/* ----------------------------- Sidebar ---------------------------- */}
        <aside className="w-52 shrink-0 border-r hidden lg:flex flex-col"
          style={{ borderColor: 'var(--border)', background: 'var(--panel)' }}>
          {nav}
          <div className="flex-1" />
          <div className="p-3 border-t text-[12px]" style={{ borderColor: 'var(--border)' }}>
            <p className="eyebrow">Đang làm việc</p>
            <p className="mt-1 font-semibold truncate">{project ? `${project.code} — ${project.name}` : 'Chưa chọn dự án'}</p>
            <p className="muted truncate">{cycle ? cycle.name : 'Chưa chọn vòng UAT'}</p>
          </div>
        </aside>

        {mobileNav && (
          <div className="fixed inset-0 z-50 lg:hidden" onClick={() => setMobileNav(false)}>
            <div className="absolute inset-0" style={{ background: 'rgba(2,6,16,.6)' }} />
            <div className="absolute left-0 top-0 bottom-0 w-56 panel rounded-none" onClick={(e) => e.stopPropagation()}
              style={{ background: 'var(--panel)' }}>
              {nav}
            </div>
          </div>
        )}

        <main className="flex-1 min-w-0 overflow-auto">{children}</main>
      </div>

      <HelpModal open={help} onClose={() => setHelp(false)} />
      <GlobalSearch open={search} onClose={() => setSearch(false)} />
    </div>
  );
}
