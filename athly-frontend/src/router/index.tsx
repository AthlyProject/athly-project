/* eslint-disable react-refresh/only-export-components */
import { createBrowserRouter, Navigate } from "react-router-dom";
import { MainLayout } from "@/layouts/MainLayout";
import { AuthLayout } from "@/layouts/AuthLayout";
import { useAuthStore } from "@/store/authStore";
import { LandingPage } from "@/pages/landing/LandingPage";
import { REGISTRATION_ENABLED } from "@/config/features";

// Pages - lazy loaded for better performance
import { LoginPage } from "@/pages/LoginPage";
import { RegisterPage } from "@/pages/RegisterPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { PlanPage } from "@/pages/PlanPage";
import { WorkoutPage } from "@/pages/WorkoutPage";
import { FeedbackPage } from "@/pages/FeedbackPage";
import { HistoryPage } from "@/pages/HistoryPage";
import { ProfilePage } from "@/pages/ProfilePage";
import { SettingsPage } from "@/pages/SettingsPage";
import { TrainingPlanCalendarPage } from "@/pages/TrainingPlanCalendarPage";
import { DesignSystemPage } from "@/pages/DesignSystemPage";
import { AssessmentPage } from "@/pages/AssessmentPage";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user && !user.assessmentCompleted) return <Navigate to="/assessment" replace />;
  return <>{children}</>;
}

function AssessmentGuard({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user && user.assessmentCompleted) return <Navigate to="/app/dashboard" replace />;
  return <>{children}</>;
}

export const router = createBrowserRouter([
  {
    path: "/",
    element: <LandingPage />,
  },
  {
    path: "/login",
    element: (
      <AuthLayout>
        <LoginPage />
      </AuthLayout>
    ),
  },
  ...(REGISTRATION_ENABLED
    ? [
        {
          path: "/register",
          element: (
            <AuthLayout>
              <RegisterPage />
            </AuthLayout>
          ),
        },
      ]
    : []),
  {
    path: "/assessment",
    element: (
      <AssessmentGuard>
        <AuthLayout>
          <AssessmentPage />
        </AuthLayout>
      </AssessmentGuard>
    ),
  },
  {
    path: "/app",
    element: (
      <ProtectedRoute>
        <MainLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Navigate to="/app/dashboard" replace /> },
      { path: "dashboard", element: <DashboardPage /> },
      { path: "plan", element: <PlanPage /> },
      { path: "training-plan", element: <TrainingPlanCalendarPage /> },
      { path: "workout/:id", element: <WorkoutPage /> },
      { path: "feedback/:id", element: <FeedbackPage /> },
      { path: "history", element: <HistoryPage /> },
      { path: "profile", element: <ProfilePage /> },
      { path: "settings", element: <SettingsPage /> },
    ],
  },
  { path: "design-system", element: <DesignSystemPage /> },
  { path: "*", element: <Navigate to="/" replace /> },
]);
