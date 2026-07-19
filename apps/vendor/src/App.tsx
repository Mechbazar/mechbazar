import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import axios from 'axios';
import { useDispatch } from 'react-redux';
import { useSelector } from 'react-redux';
import type { RootState } from './store';
import { updateVendorProfile, logout } from './store/slices/authSlice';
import Login from './pages/Login';
import Register from './pages/Register';
import PendingApproval from './pages/PendingApproval';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import Orders from './pages/Orders';
import Inventory from './pages/Inventory';
import Wallet from './pages/Wallet';
import Profile from './pages/Profile';
import Layout from './components/Layout';
import { API_URL } from './config/api';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, vendorProfile } = useSelector((state: RootState) => state.auth);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (vendorProfile?.status !== 'APPROVED') return <Navigate to="/pending-approval" replace />;
  return <>{children}</>;
};

function App() {
  const dispatch = useDispatch();
  const { token } = useSelector((state: RootState) => state.auth);

  useEffect(() => {
    if (!token) return;

    const syncVendorProfile = async () => {
      try {
        const res = await axios.get(`${API_URL}/vendors/profile`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        dispatch(updateVendorProfile(res.data));
      } catch (error: any) {
        if (error?.response?.status === 401 || error?.response?.status === 403) {
          dispatch(logout());
        }
      }
    };

    syncVendorProfile();
  }, [token, dispatch]);

  const Wrapped = (Page: React.ComponentType) => (
    <ProtectedRoute><Layout><Page /></Layout></ProtectedRoute>
  );

  return (
    <>
      <Toaster toastOptions={{ style: { background: '#171717', color: '#fff', border: '1px solid #262626' } }} />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/pending-approval" element={<PendingApproval />} />
          <Route path="/dashboard" element={Wrapped(Dashboard)} />
          <Route path="/products" element={Wrapped(Products)} />
          <Route path="/orders" element={Wrapped(Orders)} />
          <Route path="/inventory" element={Wrapped(Inventory)} />
          <Route path="/wallet" element={Wrapped(Wallet)} />
          <Route path="/profile" element={Wrapped(Profile)} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </>
  );
}

export default App;
