import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";
import OnboardingWizard from "./pages/onboarding/OnboardingWizard";
import DashboardHome from "./pages/dashboard/DashboardHome";
import ProfileSettings from "./pages/dashboard/ProfileSettings";
import ServicesSettings from "./pages/dashboard/ServicesSettings";
import ShopSettings from "./pages/dashboard/ShopSettings";
import InviteBarber from "./pages/dashboard/InviteBarber";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const barber = localStorage.getItem("barber");
  if (!barber) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

function OnboardingRoute({ children }: { children: React.ReactNode }) {
  const barber = JSON.parse(localStorage.getItem("barber") || "{}");
  if (!barber.id) {
    return <Navigate to="/login" replace />;
  }
  if (barber.onboarding_completed) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}

function App() {
  return (
    <Router>
      <Routes>
        {/* Auth Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Onboarding */}
        <Route
          path="/onboarding"
          element={
            <OnboardingRoute>
              <OnboardingWizard />
            </OnboardingRoute>
          }
        />

        {/* Dashboard Routes */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardHome />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/profile"
          element={
            <ProtectedRoute>
              <ProfileSettings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/services"
          element={
            <ProtectedRoute>
              <ServicesSettings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/shop-settings"
          element={
            <ProtectedRoute>
              <ShopSettings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/invite"
          element={
            <ProtectedRoute>
              <InviteBarber />
            </ProtectedRoute>
          }
        />

        {/* Default redirect */}
        <Route path="/" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
