import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import SuperAdminLayout from '@/components/superadmin/SuperAdminLayout';
import { PageHead } from '@/components/superadmin/ui';
import SuperAdminOverview from '@/pages/SuperAdminOverview';
import SuperAdminClinics from '@/pages/SuperAdminClinics';
import SuperAdminClinicViewer from '@/pages/SuperAdminClinicViewer';
import SuperAdminUsers from '@/pages/SuperAdminUsers';
import SuperAdminSubscriptions from '@/pages/SuperAdminSubscriptions';
import JournalKnowledgeBaseManager from '@/components/owner/JournalKnowledgeBaseManager';
import ExerciseVideoManager from '@/components/superadmin/ExerciseVideoManager';

const SuperAdminDashboard = () => (
  <SuperAdminLayout userName="Super Admin">
    <Routes>
      <Route path="/" element={<Navigate to="/super-admin/overview" replace />} />
      <Route path="/overview" element={<SuperAdminOverview />} />
      <Route path="/clinics" element={<SuperAdminClinics />} />
      <Route path="/clinic-viewer" element={<SuperAdminClinicViewer />} />
      <Route path="/users" element={<SuperAdminUsers />} />
      <Route path="/subscriptions" element={<SuperAdminSubscriptions />} />
      <Route
        path="/exercise-videos"
        element={
          <>
            <PageHead title="Video Latihan" description="Satu video per kode latihan di Plan SOAP. Hanya terlihat di klinik yang mengaktifkan Link Clinara ke pasien." />
            <ExerciseVideoManager />
          </>
        }
      />
      <Route
        path="/journal-knowledge-base"
        element={
          <>
            <PageHead title="Basis Jurnal AI" description="Jurnal dan ebook yang dipakai asisten AI sebagai rujukan saran klinis." />
            <JournalKnowledgeBaseManager />
          </>
        }
      />
    </Routes>
  </SuperAdminLayout>
);

export default SuperAdminDashboard;
