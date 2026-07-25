import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ClientBookingApp } from "./components/ClientBookingApp";
import { BarberAuthProvider } from "./context/BarberAuthContext";
import { BarberLayout } from "./components/barber/BarberLayout";
import { BarberLogin } from "./pages/barber/BarberLogin";
import { BarberRegister } from "./pages/barber/BarberRegister";
import { BarberOnboarding } from "./pages/barber/BarberOnboarding";
import { BarberTimetable } from "./pages/barber/BarberTimetable";
import { BarberClients } from "./pages/barber/BarberClients";
import { BarberSchedule } from "./pages/barber/BarberSchedule";
import { BarberServices } from "./pages/barber/BarberServices";
import { BarberShop } from "./pages/barber/BarberShop";
import { BarberStats } from "./pages/barber/BarberStats";
import { BarberSettings } from "./pages/barber/BarberSettings";
import { BarberTeam } from "./pages/barber/BarberTeam";

export default function App() {
  return (
    <BrowserRouter>
      <BarberAuthProvider>
        <Routes>
          {/* Client Pages (Public, No Login) */}
          <Route path="/" element={<ClientBookingApp />} />
          <Route path="/book" element={<ClientBookingApp />} />
          <Route path="/my-bookings" element={<ClientBookingApp initialStep="bookings" />} />

          {/* Barber Auth Routes */}
          <Route path="/barber/login" element={<BarberLogin />} />
          <Route path="/barber/register" element={<BarberRegister />} />
          <Route path="/barber/onboarding" element={<BarberOnboarding />} />

          {/* Barber Portal Authenticated Routes */}
          <Route path="/barber" element={<BarberLayout />}>
            <Route index element={<Navigate to="/barber/timetable" replace />} />
            <Route path="timetable" element={<BarberTimetable />} />
            <Route path="clients" element={<BarberClients />} />
            <Route path="schedule" element={<BarberSchedule />} />
            <Route path="services" element={<BarberServices />} />
            <Route path="shop" element={<BarberShop />} />
            <Route path="team" element={<BarberTeam />} />
            <Route path="stats" element={<BarberStats />} />
            <Route path="settings" element={<BarberSettings />} />
          </Route>

          {/* Catch-all redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BarberAuthProvider>
    </BrowserRouter>
  );
}
