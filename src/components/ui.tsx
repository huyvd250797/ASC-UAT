import React, { useEffect, useRef, useState } from 'react';
import { cx, fileToDataUrl } from '../utils';
import type { Evidence } from '../types';
import { uid } from '../db';

/* --------------------------------- Icon --------------------------------- */
const PATHS: Record<string, string> = {
  dashboard: 'M3 3h7v7H3zM14 3h7v4h-7zM14 10h7v11h-7zM3 13h7v8H3z',
  cases: 'M4 4h16v4H4zM4 10h16v4H4zM4 16h16v4H4z',
  run: 'M6 4l14 8-14 8z',
  bug: 'M12 3a4 4 0 014 4v1H8V7a4 4 0 014-4zM5 10h14v5a7 7 0 01-14 0zM2 12h3M19 12h3M4 18l2.5-1.5M20 18l-2.5-1.5M4 7l2.5 1M20 7l-2.5 1',
  retest: 'M20 12a8 8 0 11-2.34-5.66M20 3v5h-5',
  report: 'M6 3h9l5 5v13H6zM14 3v6h6M9 13h7M9 17h7',
  settings: 'M12 9a3 3 0 100 6 3 3 0 000-6zM4 12H2m20 0h-2M12 4V2m0 20v-2M6 6L4.5 4.5M19.5 19.5L18 18M18 6l1.5-1.5M4.5 19.5L6 18',
  folder: 'M3 6h6l2 2h10v11H3z',
  plus: 'M12 5v14M5 12h14',
  search: 'M11 4a7 7 0 100 14 7 7 0 000-14zM20 20l-4-4',
  close: 'M6 6l12 12M18 6L6 18',
  help: 'M12 2a10 10 0 100 20 10 10 0 000-20zM9.5 9a2.5 2.5 0 115 .5c0 1.5-2.5 2-2.5 3.5M12 17h.01',
  sun: 'M12 7a5 5 0 100 10 5 5 0 000-10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',
  moon: 'M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z',
  chevronLeft: 'M15 6l-6 6 6 6',
  chevronRight: 'M9 6l6 6-6 6',
  chevronDown: 'M6 9l6 6 6-6',
  check: 'M4 12l5 5L20 6',
  copy: 'M9 9h11v11H9zM4 15V4h11',
  download: 'M12 3v12M7 11l5 5 5-5M4 20h16',
  upload: 'M12 20V8M7 12l5-5 5 5M4 4h16',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  edit: 'M4 20h4L19 9l-4-4L4 16zM15 5l4 4',
  duplicate: 'M8 8h12v12H8zM4 16V4h12',
  filter: 'M3 5h18l-7 8v6l-4 2v-8z',
  menu: 'M4 6h16M4 12h16M4 18h16',
  link: 'M10 13a5 5 0 007 0l2-2a5 5 0 00-7-7l-1 1M14 11a5 5 0 00-7 0l-2 2a5 5 0 007 7l1-1',
  alert: 'M12 3l9 17H3zM12 9v5M12 17h.01',
  clock: 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 7v5l3 2',
};

export function Icon({ name, size = 16, className = '' }: { name: string; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d={PATHS[name] || PATHS.help} />
    </svg>
  );
}

/* --------------------------------- Modal -------------------------------- */
export function Modal({
  open, title, subtitle, children, footer, onClose, width = 'max-w-2xl', lockOutside = true,
}: {
  open: boolean; title: React.ReactNode; subtitle?: React.ReactNode; children: React.ReactNode;
  footer?: React.ReactNode; onClose: () => void; width?: string; lockOutside?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    document.body.classList.add('modal-open');
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !lockOutside) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.classList.remove('modal-open'); window.removeEventListener('keydown', onKey); };
  }, [open, lockOutside, onClose]);

  if (!open) return null;
  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (!lockOutside && e.target === e.currentTarget) onClose(); }}>
      <div className={cx('panel w-full flex flex-col fade-in', width)} style={{ maxHeight: 'calc(100vh - 32px)' }}
        role="dialog" aria-modal="true">
        <div className="flex items-start gap-3 px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="flex-1 min-w-0">
            <h2 className="text-[15px] font-semibold leading-tight">{title}</h2>
            {subtitle && <p className="text-xs muted mt-0.5">{subtitle}</p>}
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Đóng"><Icon name="close" /></button>
        </div>
        <div className="modal-body flex-1 px-4 py-4">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 px-4 py-3 border-t" style={{ borderColor: 'var(--border)' }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------- Confirm -------------------------------- */
export function ConfirmDialog({
  open, title, message, confirmLabel = 'Xác nhận', danger, requireText, onConfirm, onCancel,
}: {
  open: boolean; title: string; message: React.ReactNode; confirmLabel?: string; danger?: boolean;
  requireText?: string; onConfirm: (reason?: string) => void; onCancel: () => void;
}) {
  const [text, setText] = useState('');
  useEffect(() => { if (open) setText(''); }, [open]);
  const ok = !requireText || text.trim() === requireText;
  return (
    <Modal open={open} title={title} onClose={onCancel} width="max-w-md" lockOutside={false}
      footer={<>
        <button className="btn" onClick={onCancel}>Huỷ</button>
        <button className={cx('btn', danger ? 'btn-danger' : 'btn-primary')} disabled={!ok}
          onClick={() => onConfirm(text)}>{confirmLabel}</button>
      </>}>
      <div className="text-[13px] leading-relaxed">{message}</div>
      {requireText && (
        <div className="mt-3">
          <label className="label">Gõ <span className="code" style={{ color: 'var(--text)' }}>{requireText}</span> để xác nhận</label>
          <input className="input" value={text} onChange={(e) => setText(e.target.value)} autoFocus />
        </div>
      )}
    </Modal>
  );
}

/* ------------------------------- Toasts --------------------------------- */
export function ToastHost({ toasts, dismiss }: { toasts: any[]; dismiss: (id: string) => void }) {
  return (
    <div className="fixed z-[80] bottom-4 right-4 flex flex-col gap-2 max-w-[92vw]">
      {toasts.map((t) => (
        <div key={t.id} className="panel fade-in flex items-center gap-3 px-3 py-2.5 shadow-lg"
          style={{ borderColor: t.tone === 'error' ? 'var(--fail)' : 'var(--border)', minWidth: 240 }}>
          <span style={{ color: t.tone === 'error' ? 'var(--fail)' : 'var(--pass)' }}>
            <Icon name={t.tone === 'error' ? 'alert' : 'check'} />
          </span>
          <span className="text-[13px] flex-1">{t.text}</span>
          {t.action && (
            <button className="btn btn-sm" onClick={() => { t.action.run(); dismiss(t.id); }}>{t.action.label}</button>
          )}
          <button className="btn btn-ghost btn-sm" onClick={() => dismiss(t.id)} aria-label="Đóng"><Icon name="close" size={13} /></button>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------ Small bits ------------------------------ */
export const Field = ({ label, hint, required, children }: any) => (
  <div>
    <label className="label">
      {label}{required && <span style={{ color: 'var(--fail)' }}> *</span>}
      {hint && <span className="faint font-normal"> · {hint}</span>}
    </label>
    {children}
  </div>
);

export const Empty = ({ icon = 'folder', title, hint, action }: any) => (
  <div className="flex flex-col items-center justify-center text-center py-16 px-6">
    <div className="mb-3 faint"><Icon name={icon} size={28} /></div>
    <p className="font-semibold">{title}</p>
    {hint && <p className="text-[13px] muted mt-1 max-w-md">{hint}</p>}
    {action && <div className="mt-4 flex gap-2">{action}</div>}
  </div>
);

export function ProgressBar({ segments }: { segments: { value: number; color: string; label?: string }[] }) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  return (
    <div className="bar" role="img" aria-label={segments.map((s) => `${s.label}: ${s.value}`).join(', ')}>
      {segments.map((s, i) => (
        <div key={i} style={{ width: `${(s.value / total) * 100}%`, background: s.color }} title={`${s.label}: ${s.value}`} />
      ))}
    </div>
  );
}

/* ------------------------------- Evidence ------------------------------- */
export function EvidenceBox({
  items, onChange, compact,
}: { items: Evidence[]; onChange: (e: Evidence[]) => void; compact?: boolean }) {
  const [preview, setPreview] = useState<Evidence | null>(null);
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = async (files: FileList | File[] | null) => {
    if (!files) return;
    const next: Evidence[] = [];
    for (const f of Array.from(files)) {
      if (f.size > 6 * 1024 * 1024) continue;
      next.push({
        id: uid(), fileName: f.name || `screenshot-${Date.now()}.png`,
        fileType: f.type, fileSize: f.size, dataUrl: await fileToDataUrl(f), createdAt: Date.now(),
      });
    }
    if (next.length) onChange([...items, ...next]);
  };

  const onPaste = async (e: React.ClipboardEvent) => {
    const files = Array.from(e.clipboardData.files);
    const imgs = Array.from(e.clipboardData.items)
      .filter((i) => i.type.startsWith('image/'))
      .map((i) => i.getAsFile())
      .filter(Boolean) as File[];
    const all = files.length ? files : imgs;
    if (all.length) { e.preventDefault(); await addFiles(all); }
  };

  return (
    <div>
      <div
        tabIndex={0}
        onPaste={onPaste}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files); }}
        className="rounded-lg border border-dashed text-center cursor-pointer"
        style={{
          borderColor: drag ? 'var(--accent)' : 'var(--border)',
          background: drag ? 'var(--accent-soft)' : 'var(--panel-2)',
          padding: compact ? '10px' : '16px',
        }}
        onClick={() => inputRef.current?.click()}
      >
        <p className="text-[12.5px] muted">
          Dán ảnh bằng <span className="kbd">Ctrl</span>+<span className="kbd">V</span>, kéo thả, hoặc bấm để chọn file
        </p>
        <input ref={inputRef} type="file" multiple accept="image/*,.pdf,.txt,.log" className="hidden"
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => { addFiles(e.target.files); e.currentTarget.value = ''; }} />
      </div>

      {items.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {items.map((ev) => (
            <div key={ev.id} className="relative group">
              {ev.fileType?.startsWith('image/') ? (
                <img src={ev.dataUrl} alt={ev.fileName} onClick={() => setPreview(ev)}
                  className="h-16 w-24 object-cover rounded border cursor-zoom-in"
                  style={{ borderColor: 'var(--border)' }} loading="lazy" />
              ) : (
                <div className="h-16 w-24 rounded border flex items-center justify-center text-[10px] muted px-1 text-center"
                  style={{ borderColor: 'var(--border)', background: 'var(--panel-3)' }}>{ev.fileName}</div>
              )}
              <button
                className="absolute -top-1.5 -right-1.5 rounded-full w-5 h-5 flex items-center justify-center"
                style={{ background: 'var(--fail)', color: '#fff' }}
                onClick={() => onChange(items.filter((x) => x.id !== ev.id))}
                aria-label={`Xoá ${ev.fileName}`}>
                <Icon name="close" size={11} />
              </button>
            </div>
          ))}
        </div>
      )}

      {preview && (
        <div className="modal-backdrop" onClick={() => setPreview(null)}>
          <img src={preview.dataUrl} alt={preview.fileName} className="max-h-[88vh] max-w-[92vw] rounded" />
        </div>
      )}
    </div>
  );
}

/* --------------------------- Multi tag selector -------------------------- */
export function TagPicker({ options, value, onChange }: { options: readonly string[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = value.includes(o);
        return (
          <button key={o} type="button" className={cx('chip btn-sm', on && 'chip-on')} style={{ height: 26 }}
            onClick={() => onChange(on ? value.filter((v) => v !== o) : [...value, o])}>
            {o}
          </button>
        );
      })}
    </div>
  );
}
