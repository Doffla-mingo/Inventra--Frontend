import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './components/Toast';
import GrowthPage from './pages/GrowthPage';
import Layout       from './components/Layout';
import LoginPage    from './pages/LoginPage';
import ScannerPage  from './pages/ScannerPage';
import InventoryPage from './pages/InventoryPage';
import TriggersPage from './pages/TriggersPage';
import DiscountsPage from './pages/DiscountsPage';
import SettingsPage from './pages/SettingsPage';
import VerifyEmailPage from './pages/VerifyEmailPage';
import ForecastPage from './pages/ForecastPage';
import './index.css';

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh' }}>
      <div className="spinner" style={{ width:'28px', height:'28px' }} />
    </div>
  );
  return user ? children : <Navigate to="/login" replace />;
}

function AppRoutes() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route index          element={<ScannerPage />} />
        <Route path="inventory" element={<InventoryPage />} />
        <Route path="triggers"  element={<TriggersPage />} />
        <Route path="discounts" element={<DiscountsPage />} />
        <Route path="settings"  element={<SettingsPage />} />
        <Route path="growth" element={<GrowthPage />} />
        <Route path="forecast" element={<ForecastPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <AppRoutes />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}