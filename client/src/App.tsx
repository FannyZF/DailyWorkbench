import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, Spin } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import AppLayout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import LoginPage from './pages/Login';
import { useAuth } from './hooks/useAuth';
import { UnitProvider } from './hooks/useUnit';

const UploadPage = lazy(() => import('./pages/WorkArchive/UploadPage'));
const BrowsePage = lazy(() => import('./pages/WorkArchive/BrowsePage'));
const StatsPage = lazy(() => import('./pages/WorkArchive/StatsPage'));
const DraftPage = lazy(() => import('./pages/WorkArchive/DraftPage'));
const CategoriesPage = lazy(() => import('./pages/Categories'));
const UsersPage = lazy(() => import('./pages/Users'));
const SettingsPage = lazy(() => import('./pages/Settings'));

const PageLoading = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
    <Spin size="large" tip="加载中..." />
  </div>
);

const Lazy: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Suspense fallback={<PageLoading />}>{children}</Suspense>
);

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isLoggedIn } = useAuth();
  if (!isLoggedIn) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAdmin } = useAuth();
  if (!isAdmin) return <Navigate to="/archive/upload" replace />;
  return <>{children}</>;
};

const App: React.FC = () => {
  return (
    <ConfigProvider locale={zhCN} theme={{ token: { colorPrimary: '#d4380d' } }}>
      <ErrorBoundary>
        <UnitProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <AppLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<Navigate to="/archive/upload" replace />} />
            <Route path="archive/upload" element={<Lazy><UploadPage /></Lazy>} />
            <Route path="archive/browse" element={<Lazy><BrowsePage /></Lazy>} />
            <Route path="archive/stats" element={<AdminRoute><Lazy><StatsPage /></Lazy></AdminRoute>} />
            <Route path="archive/draft" element={<AdminRoute><Lazy><DraftPage /></Lazy></AdminRoute>} />
            <Route path="categories" element={<AdminRoute><Lazy><CategoriesPage /></Lazy></AdminRoute>} />
            <Route path="users" element={<AdminRoute><Lazy><UsersPage /></Lazy></AdminRoute>} />
            <Route path="settings" element={<AdminRoute><Lazy><SettingsPage /></Lazy></AdminRoute>} />
          </Route>
        </Routes>
          </BrowserRouter>
        </UnitProvider>
      </ErrorBoundary>
    </ConfigProvider>
  );
};

export default App;
