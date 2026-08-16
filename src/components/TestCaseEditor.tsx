import React, { useEffect, useState } from 'react';
import { Field, Icon, Modal, TagPicker } from './ui';
import { TAGS, TEST_TYPES, type Priority, type TestCase, type TestStep } from '../types';
import { activityRepo, featureRepo, moduleRepo, testCaseRepo } from '../db';
import { useApp } from '../store';
import { slugCode } from '../utils';

const PRIORITIES: Priority[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

export const blankCase = (moduleId?: string): Partial<TestCase> => ({
  title: '', moduleId: moduleId || '', featureId: '', priority: 'MEDIUM', testTypes: ['POSITIVE'],
  preconditions: '', testData: '', expectedResult: '', tags: [], owner: '',
  steps: [{ order: 1, action: '' }],
});

export function TestCaseEditor({
  draft, onClose,
}: { draft: Partial<TestCase> | null; onClose: () => void }) {
  const { project, modules, features, refreshProject, toast } = useApp();
  const [f, setF] = useState<Partial<TestCase> | null>(draft);
  const [dirty, setDirty] = useState(false);
  const [warnClose, setWarnClose] = useState(false);
  const [newModule, setNewModule] = useState('');
  const [newFeature, setNewFeature] = useState('');

  useEffect(() => { setF(draft); setDirty(false); }, [draft]);
  if (!f) return null;

  const set = (k: keyof TestCase, v: any) => { setDirty(true); setF((p) => ({ ...p, [k]: v })); };
  const steps: TestStep[] = f.steps?.length ? f.steps : [{ order: 1, action: '' }];

  const setStep = (i: number, patch: Partial<TestStep>) => {
    const next = steps.map((s, idx) => (idx === i ? { ...s, ...patch } : s));
    set('steps', next);
  };
  const addStep = () => set('steps', [...steps, { order: steps.length + 1, action: '' }]);
  const removeStep = (i: number) => set('steps', steps.filter((_, idx) => idx !== i).map((s, idx) => ({ ...s, order: idx + 1 })));

  const addModule = async () => {
    if (!newModule.trim()) return;
    const m = await moduleRepo.create({
      projectId: project!.id, name: newModule.trim(), code: slugCode(newModule), order: modules.length,
    });
    setNewModule('');
    await refreshProject();
    set('moduleId', m.id);
  };

  const addFeature = async () => {
    if (!newFeature.trim() || !f.moduleId) return;
    const fe = await featureRepo.create({ projectId: project!.id, moduleId: f.moduleId, name: newFeature.trim() });
    setNewFeature('');
    await refreshProject();
    set('featureId', fe.id);
  };

  const validate = () => {
    if (!f.title?.trim()) { toast('Test Case cần có Title.', 'error'); return false; }
    if (!f.moduleId) { toast('Chọn Module cho Test Case.', 'error'); return false; }
    if (!f.expectedResult?.trim()) { toast('Nhập Expected Result — đây là căn cứ để kết luận PASS/FAIL.', 'error'); return false; }
    return true;
  };

  const persist = async () => {
    const clean = { ...f, steps: steps.filter((s) => s.action.trim()).map((s, i) => ({ ...s, order: i + 1 })) };
    if (f.id) {
      await testCaseRepo.update(f.id, clean as any);
      await activityRepo.log({
        projectId: project!.id, entityType: 'TEST_CASE', entityId: f.id, entityCode: f.caseCode,
        action: 'Cập nhật Test Case', user: 'Tôi',
      });
      return f.caseCode!;
    }
    const mod = modules.find((m) => m.id === f.moduleId)!;
    const code = await testCaseRepo.nextCode(project!.code, mod.code || slugCode(mod.name), project!.id);
    const created = await testCaseRepo.create({
      ...blankCase(), ...clean, caseCode: code, projectId: project!.id,
    } as any);
    await activityRepo.log({
      projectId: project!.id, entityType: 'TEST_CASE', entityId: created.id, entityCode: code,
      action: 'Tạo Test Case', detail: created.title, user: 'Tôi',
    });
    return code;
  };

  const save = async (again?: boolean) => {
    if (!validate()) return;
    const code = await persist();
    await refreshProject();
    toast(`Đã lưu ${code}.`);
    if (again) {
      setF({ ...blankCase(f.moduleId), featureId: f.featureId, priority: f.priority, owner: f.owner });
      setDirty(false);
    } else onClose();
  };

  const tryClose = () => (dirty ? setWarnClose(true) : onClose());

  return (
    <>
      <Modal open lockOutside width="max-w-4xl" onClose={tryClose}
        title={f.id ? `Sửa Test Case ${f.caseCode || ''}` : 'Test Case mới'}
        subtitle={f.id ? undefined : 'Test Case ID sinh tự động theo Mã dự án và Module.'}
        footer={<>
          <button className="btn" onClick={tryClose}>Huỷ</button>
          {!f.id && <button className="btn" onClick={() => save(true)}>Lưu &amp; tạo Case tiếp</button>}
          <button className="btn btn-primary" onClick={() => save(false)}>Lưu Test Case</button>
        </>}>
        <div className="space-y-4">
          <section>
            <p className="eyebrow mb-2">Thông tin chung</p>
            <div className="space-y-3">
              <Field label="Title" required hint="mô tả mục tiêu, không viết chung chung như “Test đăng ký”">
                <input className="input" value={f.title || ''} onChange={(e) => set('title', e.target.value)}
                  placeholder="Không cho đăng ký khi vượt giới hạn tín chỉ" autoFocus />
              </Field>
              <div className="grid sm:grid-cols-4 gap-3">
                <Field label="Module" required>
                  <select className="select" value={f.moduleId || ''} onChange={(e) => set('moduleId', e.target.value)}>
                    <option value="">—</option>
                    {modules.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                  <div className="flex gap-1 mt-1">
                    <input className="input" style={{ height: 28, fontSize: 12 }} placeholder="Thêm Module mới"
                      value={newModule} onChange={(e) => setNewModule(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addModule()} />
                    <button className="btn btn-sm" onClick={addModule}><Icon name="plus" size={13} /></button>
                  </div>
                </Field>
                <Field label="Feature">
                  <select className="select" value={f.featureId || ''} onChange={(e) => set('featureId', e.target.value)}>
                    <option value="">—</option>
                    {features.filter((x) => x.moduleId === f.moduleId).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                  </select>
                  <div className="flex gap-1 mt-1">
                    <input className="input" style={{ height: 28, fontSize: 12 }} placeholder="Thêm Feature mới"
                      value={newFeature} onChange={(e) => setNewFeature(e.target.value)} disabled={!f.moduleId}
                      onKeyDown={(e) => e.key === 'Enter' && addFeature()} />
                    <button className="btn btn-sm" onClick={addFeature} disabled={!f.moduleId}><Icon name="plus" size={13} /></button>
                  </div>
                </Field>
                <Field label="Priority">
                  <select className="select" value={f.priority} onChange={(e) => set('priority', e.target.value)}>
                    {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </Field>
                <Field label="Owner">
                  <input className="input" value={f.owner || ''} onChange={(e) => set('owner', e.target.value)} placeholder="Người phụ trách" />
                </Field>
              </div>
              <Field label="Test Type">
                <TagPicker options={TEST_TYPES} value={f.testTypes || []} onChange={(v) => set('testTypes', v)} />
              </Field>
            </div>
          </section>

          <section className="pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
            <p className="eyebrow mb-2">Điều kiện &amp; dữ liệu</p>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Pre-condition">
                <textarea className="textarea" value={f.preconditions || ''} onChange={(e) => set('preconditions', e.target.value)}
                  placeholder="Đợt đăng ký đang mở.&#10;Sinh viên đang ở trạng thái đang học." />
              </Field>
              <Field label="Test Data">
                <textarea className="textarea" value={f.testData || ''} onChange={(e) => set('testData', e.target.value)}
                  placeholder="MSSV: 22110001&#10;Mã học phần: INT123" />
              </Field>
            </div>
          </section>

          <section className="pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center justify-between mb-2">
              <p className="eyebrow">Các bước thực hiện</p>
              <button className="btn btn-sm" onClick={addStep}><Icon name="plus" size={13} /> Thêm bước</button>
            </div>
            <div className="space-y-2">
              {steps.map((s, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <span className="code w-6 h-8 flex items-center justify-center shrink-0 muted">{i + 1}</span>
                  <input className="input flex-1" value={s.action} placeholder="Mô tả thao tác"
                    onChange={(e) => setStep(i, { action: e.target.value })}
                    onKeyDown={(e) => { if (e.key === 'Enter' && i === steps.length - 1) addStep(); }} />
                  <input className="input flex-1 hidden sm:block" value={s.expectedResult || ''} placeholder="Kết quả bước (tuỳ chọn)"
                    onChange={(e) => setStep(i, { expectedResult: e.target.value })} />
                  <button className="btn btn-ghost btn-sm" onClick={() => removeStep(i)} disabled={steps.length === 1}
                    aria-label={`Xoá bước ${i + 1}`}><Icon name="trash" size={14} /></button>
                </div>
              ))}
            </div>
          </section>

          <section className="pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
            <Field label="Expected Result" required hint="căn cứ kết luận PASS/FAIL">
              <textarea className="textarea" value={f.expectedResult || ''} onChange={(e) => set('expectedResult', e.target.value)}
                placeholder="Hệ thống không cho đăng ký và báo vượt số tín chỉ tối đa." />
            </Field>
            <div className="grid sm:grid-cols-2 gap-3 mt-3">
              <Field label="Post-condition">
                <textarea className="textarea" style={{ minHeight: 56 }} value={f.postCondition || ''} onChange={(e) => set('postCondition', e.target.value)} />
              </Field>
              <Field label="Config Key" hint="cho Test Type CONFIG">
                <input className="input code" value={f.configKey || ''} onChange={(e) => set('configKey', e.target.value)} placeholder="DKH_ALLOW_DEBT" />
              </Field>
            </div>
            <div className="mt-3">
              <Field label="Tags">
                <TagPicker options={TAGS} value={f.tags || []} onChange={(v) => set('tags', v)} />
              </Field>
            </div>
          </section>
        </div>
      </Modal>

      <Modal open={warnClose} title="Có thay đổi chưa được lưu" onClose={() => setWarnClose(false)} width="max-w-sm" lockOutside={false}
        footer={<>
          <button className="btn" onClick={() => setWarnClose(false)}>Quay lại</button>
          <button className="btn btn-danger" onClick={() => { setWarnClose(false); onClose(); }}>Đóng và bỏ thay đổi</button>
        </>}>
        <p className="text-[13px]">Test Case đang chỉnh sửa chưa được lưu. Đóng ngay bây giờ sẽ mất các thay đổi.</p>
      </Modal>
    </>
  );
}
