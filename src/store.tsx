import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  activityRepo, cycleRepo, executionRepo, featureRepo, issueRepo, moduleRepo,
  projectRepo, settingsRepo, testCaseRepo,
} from './db';
import type {
  Activity, Feature, Issue, Module, Project, TestCase, TestExecution, UATCycle,
} from './types';

export interface Toast { id: string; text: string; tone: 'ok' | 'error' | 'info'; action?: { label: string; run: () => void } }

interface Ctx {
  ready: boolean;
  loading: boolean;
  dbError: string | null;
  projects: Project[];
  project?: Project;
  cycles: UATCycle[];
  cycle?: UATCycle;
  modules: Module[];
  features: Feature[];
  testCases: TestCase[];
  executions: TestExecution[];
  issues: Issue[];
  activities: Activity[];
  planCaseIds: string[];
  planCases: TestCase[];
  execMap: Record<string, TestExecution>;
  selectProject: (id?: string) => void;
  selectCycle: (id?: string) => void;
  refreshProjects: () => Promise<void>;
  refreshProject: () => Promise<void>;
  refreshExecutions: () => Promise<void>;
  refreshIssues: () => Promise<void>;
  refreshCycles: () => Promise<void>;
  toasts: Toast[];
  toast: (text: string, tone?: Toast['tone'], action?: Toast['action']) => void;
  dismissToast: (id: string) => void;
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  route: string;
  navigate: (r: string) => void;
}

const AppCtx = createContext<Ctx>(null as any);
export const useApp = () => useContext(AppCtx);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState<string | undefined>();
  const [cycleId, setCycleId] = useState<string | undefined>();
  const [cycles, setCycles] = useState<UATCycle[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [features, setFeatures] = useState<Feature[]>([]);
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [executions, setExecutions] = useState<TestExecution[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [route, setRoute] = useState<string>(() => window.location.hash.replace('#/', '') || 'projects');

  /* ------------------------------ bootstrap ------------------------------ */
  useEffect(() => {
    (async () => {
      try {
        const savedTheme = await settingsRepo.get<'dark' | 'light'>('theme', 'dark');
        setTheme(savedTheme);
        const list = await projectRepo.all();
        setProjects(list);
        const lastProject = await settingsRepo.get<string | null>('lastProjectId', null);
        const pid = list.find((p) => p.id === lastProject)?.id || list[0]?.id;
        setProjectId(pid);
      } catch (e: any) {
        // Trình duyệt chặn IndexedDB: chế độ ẩn danh, mở bằng file://, hoặc chính sách chặn site data.
        setDbError(e?.name === 'MissingAPIError' || /IndexedDB/i.test(e?.message || '')
          ? 'Trình duyệt không cho phép ứng dụng lưu dữ liệu (IndexedDB bị chặn).'
          : `Không mở được kho dữ liệu: ${e?.message || 'lỗi không xác định'}`);
      } finally {
        setLoading(false);
        setReady(true);
      }
    })();
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  useEffect(() => {
    const onHash = () => setRoute(window.location.hash.replace('#/', '') || 'projects');
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const navigate = useCallback((r: string) => {
    window.location.hash = `/${r}`;
    setRoute(r);
  }, []);

  /* ---------------------------- project scope ---------------------------- */
  const refreshProjects = useCallback(async () => {
    setProjects(await projectRepo.all());
  }, []);

  const refreshCycles = useCallback(async () => {
    if (!projectId) { setCycles([]); return; }
    const list = (await cycleRepo.byProject(projectId)).sort((a, b) => a.createdAt - b.createdAt);
    setCycles(list);
    // Mặc định chọn vòng đang chạy, không phải vòng đã đóng.
    const active = [...list].reverse().find((c) => c.status === 'IN PROGRESS' || c.status === 'READY')
      || [...list].reverse().find((c) => c.status !== 'ARCHIVED')
      || list[list.length - 1];
    setCycleId((cur) => (cur && list.some((c) => c.id === cur) ? cur : active?.id));
  }, [projectId]);

  const refreshExecutions = useCallback(async () => {
    if (!cycleId) { setExecutions([]); return; }
    setExecutions(await executionRepo.byCycle(cycleId));
  }, [cycleId]);

  const refreshIssues = useCallback(async () => {
    if (!projectId) { setIssues([]); return; }
    setIssues((await issueRepo.byProject(projectId)).sort((a, b) => b.updatedAt - a.updatedAt));
  }, [projectId]);

  const refreshProject = useCallback(async () => {
    setLoading(true);
    if (!projectId) {
      setLoading(false);
      setModules([]); setFeatures([]); setTestCases([]); setIssues([]); setActivities([]);
      return;
    }
    const [mods, feats, cases, iss, acts] = await Promise.all([
      moduleRepo.byProject(projectId),
      featureRepo.byProject(projectId),
      testCaseRepo.byProject(projectId),
      issueRepo.byProject(projectId),
      activityRepo.byProject(projectId, 40),
    ]);
    setModules(mods.sort((a, b) => a.order - b.order));
    setFeatures(feats);
    setTestCases(cases.sort((a, b) => a.caseCode.localeCompare(b.caseCode)));
    setIssues(iss.sort((a, b) => b.updatedAt - a.updatedAt));
    setActivities(acts);
    await refreshCycles();
    setLoading(false);
  }, [projectId, refreshCycles]);

  useEffect(() => { refreshProject(); }, [refreshProject]);
  useEffect(() => { refreshExecutions(); }, [refreshExecutions]);
  useEffect(() => { if (projectId) settingsRepo.set('lastProjectId', projectId); }, [projectId]);

  /* -------------------------------- toast -------------------------------- */
  const dismissToast = useCallback((id: string) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const toast = useCallback((text: string, tone: Toast['tone'] = 'ok', action?: Toast['action']) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, text, tone, action }]);
    setTimeout(() => dismissToast(id), action ? 8000 : 3200);
  }, [dismissToast]);

  const toggleTheme = useCallback(() => {
    setTheme((t) => {
      const next = t === 'dark' ? 'light' : 'dark';
      settingsRepo.set('theme', next);
      return next;
    });
  }, []);

  /* ------------------------------ derived -------------------------------- */
  const project = useMemo(() => projects.find((p) => p.id === projectId), [projects, projectId]);
  const cycle = useMemo(() => cycles.find((c) => c.id === cycleId), [cycles, cycleId]);

  const planCaseIds = useMemo(() => {
    if (!cycle) return [];
    if (!cycle.planCaseIds?.length) return testCases.map((c) => c.id);
    const set = new Set(testCases.map((c) => c.id));
    return cycle.planCaseIds.filter((id) => set.has(id));
  }, [cycle, testCases]);

  const planCases = useMemo(() => {
    const set = new Set(planCaseIds);
    return testCases.filter((c) => set.has(c.id));
  }, [planCaseIds, testCases]);

  const execMap = useMemo(() => {
    const m: Record<string, TestExecution> = {};
    for (const e of executions) m[e.testCaseId] = e;
    return m;
  }, [executions]);

  const value: Ctx = {
    ready, loading, dbError, projects, project, cycles, cycle, modules, features, testCases, executions, issues,
    activities, planCaseIds, planCases, execMap,
    selectProject: (id) => { setProjectId(id); setCycleId(undefined); },
    selectCycle: (id) => setCycleId(id),
    refreshProjects, refreshProject, refreshExecutions, refreshIssues, refreshCycles,
    toasts, toast, dismissToast, theme, toggleTheme, route, navigate,
  };

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}
