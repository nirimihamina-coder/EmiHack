import { Route, Routes } from 'react-router-dom';
import './App.css';
import Index from './pages';
import LoginPage from './pages/auth/Login';
import Layout from './pages/layouts/Layout';
import DashboardPage from './pages/Dashboard';
import Settings from './pages/settings/Settings';
import RegisterPage from './pages/auth/Register';
import VerifyOtpPage from './pages/auth/VerifyOtp';
import AuthCallback from './pages/auth/AuthCallback';
import VerifyEmailPage from './pages/auth/VerifyEmail';
import ProtectedRoute from './pages/auth/ProtectedRoute';
import SettingsIndex from './pages/settings/SettingsIndex';
import ResetPasswordPage from './pages/auth/ResetPassword';
import TermsAndConditions from './pages/TermsAndConditions';
import ForgotPasswordPage from './pages/auth/ForgotPassword';
import SettingsProfile from './pages/settings/SettingsProfile';
import SettingsPassword from './pages/settings/SettingsPassword';
import SettingsNotifications from './pages/settings/SettingsNotifications';
import SettingsFaceScan from './pages/settings/SettingsFaceScan';
import CartePage from './pages/carte/Carte';
import DeviationPage from './pages/deviation/DeviationPage';
import MapCollector from './pages/deviation/MapCollector';
import FokontanyPage from './pages/fokontany/FokontanyPage';
import Simulation from './pages/simulation/Simulation';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/verify-otp" element={<VerifyOtpPage />} />
      <Route path="/terms" element={<TermsAndConditions />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/dashboard/success" element={<AuthCallback />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="settings" element={<Settings />}>
          <Route index element={<SettingsIndex />} />
          <Route path="profil" element={<SettingsProfile />} />
          <Route path="password" element={<SettingsPassword />} />
          <Route path="notifications" element={<SettingsNotifications />} />
          <Route path="scan-facial" element={<SettingsFaceScan />} />
        </Route>
        <Route path="carte" element={<CartePage />} />
        <Route path="deviation" element={<DeviationPage />} />
        <Route path="mapcollector" element={<MapCollector />} />
        <Route path="fokontany" element={<FokontanyPage />} />
        <Route path="simulation" element={<Simulation />} />
      </Route>
    </Routes>
  );
}

export default App;
