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
  const { route, ready, dbError, toasts, dismissToast } = useApp();
  const base = route.split('?')[0];

  if (!ready) {
    return <div className="h-full flex items-center justify-center muted text-[13px]">Đang mở dữ liệu ASC-UAT…</div>;
  }

  if (dbError) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="panel p-5 max-w-lg">
          <h1 className="text-[15px] font-semibold mb-2">Không mở được kho dữ liệu</h1>
          <p className="text-[13px] leading-6 mb-3">{dbError}</p>
          <p className="eyebrow mb-1">Cách xử lý</p>
          <ul className="text-[13px] leading-6 muted list-disc pl-5">
            <li>Không mở ứng dụng bằng đường dẫn <span className="code">file://</span>; hãy phục vụ qua HTTP.</li>
            <li>Tắt chế độ ẩn danh / duyệt web riêng tư.</li>
            <li>Cho phép trang này lưu dữ liệu trong phần cài đặt quyền của trình duyệt (Cookies and site data).</li>
            <li>Thử trình duyệt khác: Chrome, Edge hoặc Firefox bản mới.</li>
          </ul>
          <button className="btn btn-primary mt-4" onClick={() => window.location.reload()}>Tải lại</button>
        </div>
      </div>
    );
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
