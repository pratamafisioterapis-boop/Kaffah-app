import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import SuperAdminOverview from '@/pages/SuperAdminOverview';
import SuperAdminClinics from '@/pages/SuperAdminClinics';
import SuperAdminUsers from '@/pages/SuperAdminUsers';
import SuperAdminSubscriptions from '@/pages/SuperAdminSubscriptions';

const SuperAdminDashboard = () => {
  const navItems = [
    { label: 'Ringkasan', path: '/super-admin/overview', icon: 'Home' },
    { label: 'Manajemen Klinik', path: '/super-admin/clinics', icon: 'Database' },
    { label: 'Manajemen User', path: '/super-admin/users', icon: 'Users' },
    { label: 'Langganan', path: '/super-admin/subscriptions', icon: 'DollarSign' },
  ];

  return (
    <DashboardLayout navItems={navItems} role="super_admin" userName="Super Admin">
      <Routes>
        <Route path="/" element={<Navigate to="/super-admin/overview" replace />} />
        <Route path="/overview" element={<SuperAdminOverview />} />
        <Route path="/clinics" element={<SuperAdminClinics />} />
        <Route path="/users" element={<SuperAdminUsers />} />
        <Route path="/subscriptions" element={<SuperAdminSubscriptions />} />
      </Routes>
    </DashboardLayout>
  );
};

export default SuperAdminDashboard;