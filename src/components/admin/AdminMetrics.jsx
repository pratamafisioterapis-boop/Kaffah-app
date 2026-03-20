import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Settings, DollarSign } from 'lucide-react'; // Example icons
import { Helmet } from 'react-helmet';

const AdminMetrics = () => {
  return (
    <>
      <Helmet>
        <title>Admin Dashboard - Overview</title>
        <meta name="description" content="Admin dashboard for operational and financial overview." />
      </Helmet>
      <div className="space-y-8 py-4 px-2 md:px-4 lg:px-6">
        {/* Header Section */}
        <div className="pb-4 border-b border-gray-200">
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-500 mt-1">Sistem manajemen klinik terpadu.</p>
        </div>

        {/* Operational Section */}
        <Card className="rounded-xl shadow-lg border border-gray-100 bg-white p-6">
          <CardHeader className="p-0 mb-4">
            <CardTitle className="text-2xl font-bold text-blue-700 flex items-center gap-3">
              <Settings className="w-6 h-6" />
              Operational Dashboard
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="min-h-[200px] flex items-center justify-center bg-blue-50/50 border border-blue-100 rounded-lg text-blue-400 text-lg font-medium italic">
              Area untuk konten operasional akan ditampilkan di sini.
            </div>
          </CardContent>
        </Card>

        {/* Finance Section */}
        <Card className="rounded-xl shadow-lg border border-gray-100 bg-white p-6">
          <CardHeader className="p-0 mb-4">
            <CardTitle className="text-2xl font-bold text-emerald-700 flex items-center gap-3">
              <DollarSign className="w-6 h-6" />
              Finance Dashboard
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="min-h-[200px] flex items-center justify-center bg-emerald-50/50 border border-emerald-100 rounded-lg text-emerald-400 text-lg font-medium italic">
              Area untuk konten finansial akan ditampilkan di sini.
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default AdminMetrics;