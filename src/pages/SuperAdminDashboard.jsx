import React, { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import SuperAdminLayout from '@/components/superadmin/SuperAdminLayout';
import { PageHead, Spinner } from '@/components/superadmin/ui';
const SuperAdminOverview = React.lazy(() => import('@/pages/SuperAdminOverview'));
const SuperAdminClinics = React.lazy(() => import('@/pages/SuperAdminClinics'));
const SuperAdminClinicViewer = React.lazy(() => import('@/pages/SuperAdminClinicViewer'));
const SuperAdminRegistrationLinks = React.lazy(() => import('@/pages/SuperAdminRegistrationLinks'));
const SuperAdminUsers = React.lazy(() => import('@/pages/SuperAdminUsers'));
const SuperAdminCsTickets = React.lazy(() => import('@/pages/SuperAdminCsTickets'));
const SuperAdminSubscriptions = React.lazy(() => import('@/pages/SuperAdminSubscriptions'));
const JournalKnowledgeBaseManager = React.lazy(() => import('@/components/owner/JournalKnowledgeBaseManager'));
const ExerciseVideoManager = React.lazy(() => import('@/components/superadmin/ExerciseVideoManager'));

const SuperAdminDashboard = () => (
  <SuperAdminLayout userName="Super Admin">
    <Suspense fallback={<Spinner />}>
    <Routes>
      <Route path="/" element={<Navigate to="/super-admin/overview" replace />} />
      <Route path="/overview" element={<SuperAdminOverview />} />
      <Route path="/clinics" element={<SuperAdminClinics />} />
      <Route path="/registration-links" element={<SuperAdminRegistrationLinks />} />
      <Route path="/clinic-viewer" element={<SuperAdminClinicViewer />} />
      <Route path="/users" element={<SuperAdminUsers />} />
      <Route path="/subscriptions" element={<SuperAdminSubscriptions />} />
      <Route path="/cs-tickets" element={<SuperAdminCsTickets />} />
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
    </Suspense>
  </SuperAdminLayout>
);

export default SuperAdminDashboard;
