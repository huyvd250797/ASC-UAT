import Dexie, { Table } from 'dexie';
import type {
  Activity, Evidence, Feature, Issue, Module, Project, Settings, TestCase, TestExecution, UATCycle,
} from './types';

/**
 * Repository Layer.
 * V1 = IndexedDB (Dexie). V2 = REST API.
 * Component KHÔNG được gọi thẳng Dexie — chỉ đi qua các repository bên dưới.
 */
class ASCUATDatabase extends Dexie {
  projects!: Table<Project, string>;
  cycles!: Table<UATCycle, string>;
  modules!: Table<Module, string>;
  features!: Table<Feature, string>;
  testCases!: Table<TestCase, string>;
  executions!: Table<TestExecution, string>;
  issues!: Table<Issue, string>;
  activities!: Table<Activity, string>;
  settings!: Table<Settings, string>;

  constructor() {
    super('asc-uat');
    this.version(1).stores({
      projects: 'id, code, name, status, updatedAt',
      cycles: 'id, projectId, status, updatedAt',
      modules: 'id, projectId, order',
      features: 'id, projectId, moduleId',
      testCases: 'id, projectId, moduleId, featureId, caseCode, priority, updatedAt',
      executions: 'id, projectId, uatCycleId, testCaseId, status, executedAt, [uatCycleId+testCaseId]',
      issues: 'id, projectId, issueCode, status, severity, updatedAt',
      activities: 'id, projectId, entityId, createdAt',
      settings: 'key',
    });
  }
}

export const db = new ASCUATDatabase();

export const uid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 9);

/** Đồng hồ đơn điệu: hai bản ghi tạo trong cùng 1ms vẫn có createdAt khác nhau,
 *  nhờ vậy thứ tự vòng UAT / Test Case luôn xác định. */
let lastTick = 0;
const now = () => {
  const t = Math.max(Date.now(), lastTick + 1);
  lastTick = t;
  return t;
};

/* ------------------------------------------------------------------ */
/* Project                                                             */
/* ------------------------------------------------------------------ */
export const projectRepo = {
  all: () => db.projects.orderBy('updatedAt').reverse().toArray(),
  get: (id: string) => db.projects.get(id),
  async create(p: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>) {
    const rec: Project = { ...p, id: uid(), createdAt: now(), updatedAt: now() };
    await db.projects.add(rec);
    return rec;
  },
  async update(id: string, patch: Partial<Project>) {
    await db.projects.update(id, { ...patch, updatedAt: now() });
    return db.projects.get(id);
  },
  async remove(id: string) {
    await db.transaction('rw',
      [db.projects, db.cycles, db.modules, db.features, db.testCases, db.executions, db.issues, db.activities],
      async () => {
        await db.projects.delete(id);
        await db.cycles.where('projectId').equals(id).delete();
        await db.modules.where('projectId').equals(id).delete();
        await db.features.where('projectId').equals(id).delete();
        await db.testCases.where('projectId').equals(id).delete();
        await db.executions.where('projectId').equals(id).delete();
        await db.issues.where('projectId').equals(id).delete();
        await db.activities.where('projectId').equals(id).delete();
      });
  },
};

/* ------------------------------------------------------------------ */
/* UAT Cycle                                                           */
/* ------------------------------------------------------------------ */
export const cycleRepo = {
  byProject: (projectId: string) => db.cycles.where('projectId').equals(projectId).toArray(),
  get: (id: string) => db.cycles.get(id),
  async create(c: Omit<UATCycle, 'id' | 'createdAt' | 'updatedAt'>) {
    const rec: UATCycle = { ...c, id: uid(), createdAt: now(), updatedAt: now() };
    await db.cycles.add(rec);
    return rec;
  },
  async update(id: string, patch: Partial<UATCycle>) {
    await db.cycles.update(id, { ...patch, updatedAt: now() });
    return db.cycles.get(id);
  },
  async remove(id: string) {
    await db.transaction('rw', [db.cycles, db.executions], async () => {
      await db.cycles.delete(id);
      await db.executions.where('uatCycleId').equals(id).delete();
    });
  },
};

/* ------------------------------------------------------------------ */
/* Module & Feature                                                    */
/* ------------------------------------------------------------------ */
export const moduleRepo = {
  byProject: (projectId: string) => db.modules.where('projectId').equals(projectId).toArray(),
  async create(m: Omit<Module, 'id'>) {
    const rec: Module = { ...m, id: uid() };
    await db.modules.add(rec);
    return rec;
  },
  update: (id: string, patch: Partial<Module>) => db.modules.update(id, patch),
  async remove(id: string) {
    await db.transaction('rw', [db.modules, db.features], async () => {
      await db.modules.delete(id);
      await db.features.where('moduleId').equals(id).delete();
    });
  },
};

export const featureRepo = {
  byProject: (projectId: string) => db.features.where('projectId').equals(projectId).toArray(),
  async create(f: Omit<Feature, 'id'>) {
    const rec: Feature = { ...f, id: uid() };
    await db.features.add(rec);
    return rec;
  },
  update: (id: string, patch: Partial<Feature>) => db.features.update(id, patch),
  remove: (id: string) => db.features.delete(id),
};

/* ------------------------------------------------------------------ */
/* Test Case                                                           */
/* ------------------------------------------------------------------ */
export const testCaseRepo = {
  byProject: (projectId: string) => db.testCases.where('projectId').equals(projectId).toArray(),
  byModule: (moduleId: string) => db.testCases.where('moduleId').equals(moduleId).toArray(),
  get: (id: string) => db.testCases.get(id),
  bulkGet: (ids: string[]) => db.testCases.bulkGet(ids),
  async nextCode(projectCode: string, moduleCode: string, projectId: string) {
    const prefix = `${projectCode}-${moduleCode}-TC`;
    const cases = await db.testCases.where('projectId').equals(projectId).toArray();
    let max = 0;
    for (const c of cases) {
      if (c.caseCode?.startsWith(prefix)) {
        const n = parseInt(c.caseCode.slice(prefix.length), 10);
        if (!isNaN(n) && n > max) max = n;
      }
    }
    return `${prefix}${String(max + 1).padStart(3, '0')}`;
  },
  async create(tc: Omit<TestCase, 'id' | 'createdAt' | 'updatedAt'>) {
    const rec: TestCase = { ...tc, id: uid(), createdAt: now(), updatedAt: now() };
    await db.testCases.add(rec);
    return rec;
  },
  async bulkCreate(list: Omit<TestCase, 'id' | 'createdAt' | 'updatedAt'>[]) {
    const recs: TestCase[] = list.map((tc) => ({ ...tc, id: uid(), createdAt: now(), updatedAt: now() }));
    await db.testCases.bulkAdd(recs);
    return recs;
  },
  async update(id: string, patch: Partial<TestCase>) {
    await db.testCases.update(id, { ...patch, updatedAt: now() });
    return db.testCases.get(id);
  },
  async remove(ids: string[]) {
    await db.transaction('rw', [db.testCases, db.executions], async () => {
      await db.testCases.bulkDelete(ids);
      for (const id of ids) await db.executions.where('testCaseId').equals(id).delete();
    });
  },
};

/* ------------------------------------------------------------------ */
/* Execution                                                           */
/* ------------------------------------------------------------------ */
export const executionRepo = {
  byCycle: (cycleId: string) => db.executions.where('uatCycleId').equals(cycleId).toArray(),
  byCase: (testCaseId: string) => db.executions.where('testCaseId').equals(testCaseId).toArray(),
  byProject: (projectId: string) => db.executions.where('projectId').equals(projectId).toArray(),
  find: (cycleId: string, testCaseId: string) =>
    db.executions.where('[uatCycleId+testCaseId]').equals([cycleId, testCaseId]).first(),
  async save(exec: Partial<TestExecution> & { uatCycleId: string; testCaseId: string; projectId: string }) {
    const existing = await executionRepo.find(exec.uatCycleId, exec.testCaseId);
    if (existing) {
      const patch = { ...exec, updatedAt: now() };
      await db.executions.update(existing.id, patch);
      return { ...existing, ...patch } as TestExecution;
    }
    const rec: TestExecution = {
      id: uid(),
      status: 'NOT RUN',
      evidence: [],
      createdAt: now(),
      updatedAt: now(),
      ...exec,
    } as TestExecution;
    await db.executions.add(rec);
    return rec;
  },
  async bulkSave(list: TestExecution[]) { await db.executions.bulkPut(list); },
};

/* ------------------------------------------------------------------ */
/* Issue                                                               */
/* ------------------------------------------------------------------ */
export const issueRepo = {
  byProject: (projectId: string) => db.issues.where('projectId').equals(projectId).toArray(),
  get: (id: string) => db.issues.get(id),
  async nextCode(projectCode: string, projectId: string) {
    const list = await db.issues.where('projectId').equals(projectId).toArray();
    const prefix = `${projectCode}-BUG-`;
    let max = 0;
    for (const i of list) {
      if (i.issueCode?.startsWith(prefix)) {
        const n = parseInt(i.issueCode.slice(prefix.length), 10);
        if (!isNaN(n) && n > max) max = n;
      }
    }
    return `${prefix}${String(max + 1).padStart(3, '0')}`;
  },
  async create(i: Omit<Issue, 'id' | 'createdAt' | 'updatedAt'>) {
    const rec: Issue = { ...i, id: uid(), createdAt: now(), updatedAt: now() };
    await db.issues.add(rec);
    return rec;
  },
  async update(id: string, patch: Partial<Issue>) {
    await db.issues.update(id, { ...patch, updatedAt: now() });
    return db.issues.get(id);
  },
  remove: (id: string) => db.issues.delete(id),
};

/* ------------------------------------------------------------------ */
/* Activity                                                            */
/* ------------------------------------------------------------------ */
export const activityRepo = {
  byProject: async (projectId: string, limit = 50) => {
    const list = await db.activities.where('projectId').equals(projectId).toArray();
    return list.sort((a, b) => b.createdAt - a.createdAt).slice(0, limit);
  },
  byEntity: async (entityId: string) => {
    const list = await db.activities.where('entityId').equals(entityId).toArray();
    return list.sort((a, b) => b.createdAt - a.createdAt);
  },
  async log(a: Omit<Activity, 'id' | 'createdAt'>) {
    const rec: Activity = { ...a, id: uid(), createdAt: now() };
    await db.activities.add(rec);
    return rec;
  },
};

/* ------------------------------------------------------------------ */
/* Settings / Backup                                                   */
/* ------------------------------------------------------------------ */
export const settingsRepo = {
  async get<T = any>(key: string, fallback: T): Promise<T> {
    const rec = await db.settings.get(key);
    return rec ? (rec.value as T) : fallback;
  },
  set: (key: string, value: any) => db.settings.put({ key, value }),
};

export const backupRepo = {
  async export() {
    const [projects, cycles, modules, features, testCases, executions, issues, activities] =
      await Promise.all([
        db.projects.toArray(), db.cycles.toArray(), db.modules.toArray(), db.features.toArray(),
        db.testCases.toArray(), db.executions.toArray(), db.issues.toArray(), db.activities.toArray(),
      ]);
    return {
      app: 'ASC-UAT', version: 1, exportedAt: new Date().toISOString(),
      data: { projects, cycles, modules, features, testCases, executions, issues, activities },
    };
  },
  async import(payload: any, mode: 'replace' | 'merge' = 'replace') {
    const d = payload?.data;
    if (!d) throw new Error('File backup không đúng định dạng ASC-UAT.');
    await db.transaction('rw',
      [db.projects, db.cycles, db.modules, db.features, db.testCases, db.executions, db.issues, db.activities],
      async () => {
        if (mode === 'replace') {
          await Promise.all([
            db.projects.clear(), db.cycles.clear(), db.modules.clear(), db.features.clear(),
            db.testCases.clear(), db.executions.clear(), db.issues.clear(), db.activities.clear(),
          ]);
        }
        await db.projects.bulkPut(d.projects || []);
        await db.cycles.bulkPut(d.cycles || []);
        await db.modules.bulkPut(d.modules || []);
        await db.features.bulkPut(d.features || []);
        await db.testCases.bulkPut(d.testCases || []);
        await db.executions.bulkPut(d.executions || []);
        await db.issues.bulkPut(d.issues || []);
        await db.activities.bulkPut(d.activities || []);
      });
  },
};
