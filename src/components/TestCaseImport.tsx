import React, { useState } from 'react';
import { Icon, Modal } from './ui';
import { parseImportFile, rowToSteps, type ImportRow } from '../lib/excel';
import { featureRepo, moduleRepo, testCaseRepo } from '../db';
import { useApp } from '../store';
import { cx, slugCode } from '../utils';
import type { Priority } from '../types';

export function TestCaseImport({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { project, modules, features, refreshProject, toast } = useApp();
  const [rows, setRows] = useState<ImportRow[] | null>(null);
  const [fileName, setFileName] = useState('');
  const [createModules, setCreateModules] = useState(true);
  const [busy, setBusy] = useState(false);

  const reset = () => { setRows(null); setFileName(''); };

  const pick = async (file?: File) => {
    if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      const parsed = parseImportFile(buf);
      if (!parsed.length) { toast('File không có dòng dữ liệu nào đọc được.', 'error'); return; }
      setRows(parsed);
      setFileName(file.name);
    } catch {
      toast('Không đọc được file. Kiểm tra lại định dạng .xlsx hoặc .csv.', 'error');
    }
  };

  const valid = rows?.filter((r) => !r.errors.length) || [];
  const invalid = rows?.filter((r) => r.errors.length) || [];
  const newModules = Array.from(new Set(valid
    .map((r) => r.module!.trim())
    .filter((name) => !modules.some((m) => m.name.toLowerCase() === name.toLowerCase()))));

  const doImport = async () => {
    if (!project) return;
    setBusy(true);
    try {
      const modMap: Record<string, string> = {};
      modules.forEach((m) => { modMap[m.name.toLowerCase()] = m.id; });
      let order = modules.length;
      for (const name of newModules) {
        if (!createModules) continue;
        const m = await moduleRepo.create({ projectId: project.id, name, code: slugCode(name), order: order++ });
        modMap[name.toLowerCase()] = m.id;
      }

      const featMap: Record<string, string> = {};
      features.forEach((f) => { featMap[`${f.moduleId}|${f.name.toLowerCase()}`] = f.id; });

      const payload: any[] = [];
      const counters: Record<string, number> = {};
      const existing = await testCaseRepo.byProject(project.id);

      for (const r of valid) {
        const moduleId = modMap[r.module!.trim().toLowerCase()];
        if (!moduleId) continue;
        let featureId: string | undefined;
        if (r.feature?.trim()) {
          const key = `${moduleId}|${r.feature.trim().toLowerCase()}`;
          if (!featMap[key]) {
            const fe = await featureRepo.create({ projectId: project.id, moduleId, name: r.feature.trim() });
            featMap[key] = fe.id;
          }
          featureId = featMap[key];
        }
        const modCode = slugCode(r.module!);
        if (counters[modCode] === undefined) {
          const prefix = `${project.code}-${modCode}-TC`;
          counters[modCode] = existing.filter((c) => c.caseCode.startsWith(prefix)).length;
        }
        counters[modCode] += 1;
        const code = r.caseCode?.trim() || `${project.code}-${modCode}-TC${String(counters[modCode]).padStart(3, '0')}`;
        const pr = (['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].includes(r.priority || '') ? r.priority : 'MEDIUM') as Priority;
        payload.push({
          caseCode: code, projectId: project.id, moduleId, featureId,
          title: r.title!.trim(), priority: pr, testTypes: [],
          preconditions: r.precondition || '', testData: r.testData || '',
          steps: rowToSteps(r.steps), expectedResult: r.expected || '',
          tags: (r.tags || '').split(',').map((t) => t.trim().toUpperCase()).filter(Boolean),
        });
      }

      await testCaseRepo.bulkCreate(payload);
      await refreshProject();
      toast(`Đã import ${payload.length} Test Case.`);
      reset();
      onClose();
    } catch (e: any) {
      toast(`Import thất bại: ${e?.message || 'lỗi không xác định'}. Thử lại với file khác.`, 'error');
    } finally { setBusy(false); }
  };

  return (
    <Modal open={open} lockOutside width="max-w-3xl" title="Import Test Case từ Excel"
      subtitle="Hệ thống đọc dòng đầu tiên làm tiêu đề cột và tự nhận diện các cột thông dụng."
      onClose={() => { reset(); onClose(); }}
      footer={<>
        <button className="btn" onClick={() => { reset(); onClose(); }}>Huỷ</button>
        {rows && <button className="btn" onClick={reset}>Chọn file khác</button>}
        <button className="btn btn-primary" disabled={!valid.length || busy} onClick={doImport}>
          {busy ? 'Đang import…' : `Import ${valid.length} Test Case`}
        </button>
      </>}>
      {!rows ? (
        <div>
          <div className="rounded-lg border border-dashed p-8 text-center cursor-pointer"
            style={{ borderColor: 'var(--border)', background: 'var(--panel-2)' }}
            onClick={() => document.getElementById('tc-import-input')?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files?.[0]); }}>
            <div className="flex justify-center mb-2 faint"><Icon name="upload" size={26} /></div>
            <p className="text-[13px]">Kéo thả file .xlsx / .csv vào đây, hoặc bấm để chọn file</p>
            <input id="tc-import-input" type="file" accept=".xlsx,.xls,.csv" className="hidden"
              onChange={(e) => { pick(e.target.files?.[0]); e.currentTarget.value = ''; }} />
          </div>
          <div className="mt-4">
            <p className="eyebrow mb-1">Cột được nhận diện</p>
            <p className="text-[12.5px] muted leading-6">
              Test Case ID · Module · Feature · Title · Pre-condition · Steps · Expected Result · Priority · Test Data · Tags.
              Cột <b>Title</b> và <b>Module</b> là bắt buộc. Mỗi dòng Steps xuống dòng sẽ thành một bước.
            </p>
          </div>
        </div>
      ) : (
        <div>
          <div className="flex flex-wrap items-center gap-3 mb-3">
            <span className="code text-[12px] muted">{fileName}</span>
            <span className="st st-neutral">{rows.length} dòng</span>
            <span className="st st-pass">Hợp lệ {valid.length}</span>
            {invalid.length > 0 && <span className="st st-fail">Lỗi {invalid.length}</span>}
          </div>

          {newModules.length > 0 && (
            <label className="flex items-start gap-2 panel p-3 mb-3 cursor-pointer" style={{ background: 'var(--panel-2)' }}>
              <input type="checkbox" checked={createModules} onChange={(e) => setCreateModules(e.target.checked)} className="mt-0.5" />
              <span className="text-[13px]">
                File có {newModules.length} Module chưa tồn tại: <b>{newModules.join(', ')}</b>. Tạo mới các Module này khi import?
                {!createModules && <span className="block muted mt-1">Nếu không tạo, các dòng thuộc Module này sẽ bị bỏ qua.</span>}
              </span>
            </label>
          )}

          {invalid.length > 0 && (
            <div className="panel p-3 mb-3" style={{ borderColor: 'var(--fail)' }}>
              <p className="text-[12.5px] font-semibold mb-1" style={{ color: 'var(--fail)' }}>Dòng sẽ bị bỏ qua</p>
              <ul className="text-[12.5px] muted space-y-0.5 max-h-28 overflow-auto">
                {invalid.slice(0, 20).map((r) => <li key={r.rowIndex}>Dòng {r.rowIndex}: {r.errors.join(', ')}</li>)}
              </ul>
            </div>
          )}

          <div className="panel overflow-auto" style={{ maxHeight: 300 }}>
            <table className="grid-table">
              <thead><tr><th>#</th><th>Module</th><th>Feature</th><th>Title</th><th>Priority</th><th>Expected</th></tr></thead>
              <tbody>
                {rows.slice(0, 100).map((r) => (
                  <tr key={r.rowIndex} className={cx(r.errors.length && 'opacity-50')}>
                    <td className="code muted">{r.rowIndex}</td>
                    <td>{r.module}</td>
                    <td className="muted">{r.feature}</td>
                    <td className="max-w-[280px] truncate">{r.title}</td>
                    <td className="code">{r.priority || 'MEDIUM'}</td>
                    <td className="max-w-[220px] truncate muted">{r.expected}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Modal>
  );
}
