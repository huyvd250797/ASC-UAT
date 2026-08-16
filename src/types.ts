export type ProjectStatus =
  | 'PLANNING' | 'CONFIGURATION' | 'INTERNAL TEST' | 'UAT'
  | 'GO-LIVE PREPARATION' | 'GO-LIVE' | 'CLOSED';

export type CycleStatus = 'DRAFT' | 'READY' | 'IN PROGRESS' | 'COMPLETED' | 'ARCHIVED';
export type Environment = 'DEV' | 'TEST' | 'UAT' | 'STAGING';
export type Priority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type ExecStatus = 'NOT RUN' | 'PASS' | 'FAIL' | 'BLOCKED' | 'SKIPPED' | 'N/A';
export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type IssueStatus =
  | 'OPEN' | 'ANALYZING' | 'IN PROGRESS' | 'FIXED' | 'READY FOR RETEST'
  | 'REOPENED' | 'CLOSED' | 'REJECTED' | 'DUPLICATE' | 'NOT A BUG';

export const TEST_TYPES = [
  'POSITIVE', 'NEGATIVE', 'BOUNDARY', 'PERMISSION', 'CONFIG', 'DATA',
  'WORKFLOW', 'INTEGRATION', 'REGRESSION', 'UI', 'PERFORMANCE', 'OTHER',
] as const;

export const TAGS = [
  'SMOKE', 'REGRESSION', 'CRITICAL_FLOW', 'CUSTOMER_CASE', 'GO_LIVE',
  'PERMISSION', 'CONFIG', 'DATA',
] as const;

export interface Project {
  id: string;
  code: string;
  name: string;
  customer?: string;
  description?: string;
  status: ProjectStatus;
  version?: string;
  pm?: string;
  consultant?: string;
  startDate?: string;
  goLiveDate?: string;
  createdAt: number;
  updatedAt: number;
}

export interface UATCycle {
  id: string;
  projectId: string;
  name: string;
  environment: Environment;
  version?: string;
  build?: string;
  tester?: string;
  startDate?: string;
  endDate?: string;
  status: CycleStatus;
  note?: string;
  /** Rỗng = áp dụng toàn bộ Test Case của dự án */
  planCaseIds: string[];
  completedAt?: number;
  completeNote?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Module {
  id: string; projectId: string; code: string; name: string; order: number;
}

export interface Feature {
  id: string; projectId: string; moduleId: string; code?: string; name: string; description?: string;
}

export interface TestStep { order: number; action: string; expectedResult?: string }

export interface TestCase {
  id: string;
  caseCode: string;
  projectId: string;
  moduleId: string;
  featureId?: string;
  title: string;
  description?: string;
  priority: Priority;
  testTypes: string[];
  preconditions?: string;
  testData?: string;
  steps: TestStep[];
  expectedResult: string;
  postCondition?: string;
  tags: string[];
  owner?: string;
  configKey?: string;
  isTemplate?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Evidence {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  dataUrl: string;
  createdAt: number;
}

export interface TestExecution {
  id: string;
  projectId: string;
  uatCycleId: string;
  testCaseId: string;
  tester?: string;
  status: ExecStatus;
  actualResult?: string;
  note?: string;
  evidence: Evidence[];
  caseSnapshot?: { title: string; steps: TestStep[]; expectedResult: string };
  executedAt?: number;
  createdAt: number;
  updatedAt: number;
}

export interface Issue {
  id: string;
  issueCode: string;
  projectId: string;
  moduleId?: string;
  featureId?: string;
  uatCycleId?: string;
  title: string;
  description?: string;
  severity: Severity;
  priority: Priority;
  status: IssueStatus;
  environment?: Environment;
  version?: string;
  stepsToReproduce?: string;
  expectedResult?: string;
  actualResult?: string;
  fixNote?: string;
  reporter?: string;
  assignee?: string;
  dueDate?: string;
  testCaseIds: string[];
  evidence: Evidence[];
  reopenCount: number;
  fixedAt?: number;
  closedAt?: number;
  createdAt: number;
  updatedAt: number;
}

export interface Activity {
  id: string;
  projectId: string;
  entityType: 'TEST_CASE' | 'EXECUTION' | 'ISSUE' | 'PROJECT' | 'CYCLE';
  entityId: string;
  entityCode?: string;
  action: string;
  detail?: string;
  user?: string;
  createdAt: number;
}

export interface Settings {
  key: string;
  value: any;
}
