import React from 'react';
import { AppProvider, useApp } from './store';
import { Layout } from './components/Layout';
import { ToastHost } from './components/ui';
import { ProjectsView } from './views/Projects';
import { DashboardView } from './views/Dashboard';
import { TestCasesView } from './views/TestCases';
import { RunUATView } from './views/RunUAT';
import { IssuesView } from './views/Issues';
import { RetestView } from './views/Retest';
import { ReportsView } from './views/Reports';
import { SettingsView } from './views/Settings';

function Router() {
  const { route, ready, toasts, dismissToast } = useApp();
  const base = route.split('?')[0];

  if (!ready) {
    return <div className="h-full flex items-center justify-center muted text-[13px]">Đang mở dữ liệu ASC-UAT…</div>;
  }

  const view = () => {
    switch (base) {
      case 'projects': return <ProjectsView />;
      case 'dashboard': return <DashboardView />;
      case 'testcases': return <TestCasesView />;
      case 'run': return <RunUATView />;
      case 'issues': return <IssuesView />;
      case 'retest': return <RetestView />;
      case 'reports': return <ReportsView />;
      case 'settings': return <SettingsView />;
      default: return <ProjectsView />;
    }
  };

  return (
    <>
      <Layout>{view()}</Layout>
      <ToastHost toasts={toasts} dismiss={dismissToast} />
    </>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Router />
    </AppProvider>
  );
}
