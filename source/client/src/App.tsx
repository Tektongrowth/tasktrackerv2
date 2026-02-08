import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { useTheme } from './hooks/useTheme';
import { RunningTimerProvider } from './hooks/useTimeEntries';
import { Layout } from './components/Layout';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LoginPage } from './pages/LoginPage';
import { RateLimitPage } from './pages/RateLimitPage';
import { ClientPortalPreview } from './pages/ClientPortalPreview';
import { DashboardPage } from './pages/DashboardPage';
import { KanbanPage } from './pages/KanbanPage';
import { ListPage } from './pages/ListPage';
import { TimeTrackingPage } from './pages/TimeTrackingPage';
import { SettingsPage } from './pages/SettingsPage';
import { MySettingsPage } from './pages/MySettingsPage';
import { TemplatesPage } from './pages/TemplatesPage';
import { TaskSubmissionsPage } from './pages/TaskSubmissionsPage';
import { HelpPage } from './pages/HelpPage';
import ChatPage from './pages/ChatPage';
import { ClientPortalLogin } from './pages/ClientPortalLogin';
import { ClientPortalVerify } from './pages/ClientPortalVerify';
import { ClientPortalDashboard } from './pages/ClientPortalDashboard';
import { EmbedSubmitPage } from './pages/EmbedSubmitPage';
import { EmbedLocationPage } from './pages/EmbedLocationPage';
import { SeoIntelligencePage } from './pages/SeoIntelligencePage';
import { Toaster } from './components/ui/toaster';
import { ConfirmDialogProvider } from './components/ConfirmDialog';
import { GuideProvider, WelcomeWizard, SpotlightTour, HelpButton } from './components/guide';
import { DeployBanner } from './components/DeployBanner';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function App() {
  // Load and apply theme on startup
  useTheme();

  return (
    <ErrorBoundary>
      <DeployBanner />
      <ConfirmDialogProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/rate-limited" element={<RateLimitPage />} />

        {/* Client Portal Routes */}
        <Route path="/client-portal" element={<ClientPortalLogin />} />
        <Route path="/client-portal/verify/:token" element={<ClientPortalVerify />} />
        <Route path="/client-portal/dashboard" element={<ClientPortalDashboard />} />

        {/* Embed Routes (public, for iframe embedding) */}
        <Route path="/embed/submit/:token" element={<EmbedSubmitPage />} />
        <Route path="/embed/location/:locationId" element={<EmbedLocationPage />} />

        <Route
          path="/"
          element={
            <ProtectedRoute>
              <RunningTimerProvider>
                <GuideProvider>
                  <Layout />
                  <WelcomeWizard />
                  <SpotlightTour />
                  <HelpButton />
                </GuideProvider>
              </RunningTimerProvider>
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="kanban" element={<KanbanPage />} />
          <Route path="list" element={<ListPage />} />
          <Route path="time" element={<TimeTrackingPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="my-settings" element={<MySettingsPage />} />
          <Route path="templates" element={<TemplatesPage />} />
          <Route path="submissions" element={<TaskSubmissionsPage />} />
          <Route path="chat" element={<ChatPage />} />
          <Route path="help" element={<HelpPage />} />
          <Route path="client-portal-preview" element={<ClientPortalPreview />} />
          <Route path="seo-intelligence" element={<SeoIntelligencePage />} />
        </Route>
      </Routes>
      <Toaster />
      </ConfirmDialogProvider>
    </ErrorBoundary>
  );
}

export default App;
