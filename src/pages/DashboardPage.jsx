import React from 'react';
import OwnerOperationalMetrics from '@/components/owner/OwnerOperationalMetrics';
import { LayoutDashboard } from 'lucide-react';
import { Helmet } from 'react-helmet';

const DashboardPage = () => {
  return (
    <>
      <Helmet>
        <title>Dashboard Overview | Kaffah Physiotherapy</title>
        <meta name="description" content="Comprehensive overview of operational performance for Kaffah Physiotherapy." />
      </Helmet>
      <div className="space-y-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Dashboard Overview</h1>
          <p className="text-slate-500">Comprehensive view of operational performance.</p>
        </div>
        <OwnerOperationalMetrics />
      </div>
    </>
  );
};

export default DashboardPage;