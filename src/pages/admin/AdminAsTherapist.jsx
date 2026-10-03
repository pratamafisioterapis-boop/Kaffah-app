import React, { useEffect, useState } from 'react';
import { Routes, Route, useParams, useLocation, Link, Navigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { Loader2 } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import TherapistMedicalRecords from '@/components/therapist/TherapistMedicalRecords';
import MedicalRecordForm from '@/components/therapist/MedicalRecordForm';
import { supabase } from '@/lib/customSupabaseClient';

const TherapistSession = () => {
  const { therapistId } = useParams();
  const [therapist, setTherapist] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    supabase.from('physiotherapists').select('*').eq('id', therapistId).maybeSingle()
      .then(({ data }) => { setTherapist(data); setLoading(false); });
  }, [therapistId]);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin w-6 h-6 text-blue-600" /></div>;
  if (!therapist) return <p className="text-red-600">Terapis tidak ditemukan.</p>;

  const basePath = `/admin/as-therapist/${therapistId}/records`;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
        <span>Mode admin: bertindak sebagai <strong>{therapist.name}</strong>. Pengisian SOAP ditandai "Diisi via Admin".</span>
        <Link to="/admin" className="underline font-medium">Kembali ke Admin</Link>
      </div>
      <Routes>
        <Route path="" element={<Navigate to="records" replace />} />
        <Route path="records" element={<TherapistMedicalRecords therapist={therapist} basePath={basePath} />} />
        <Route path="records/new/:patientId" element={<MedicalRecordForm therapist={therapist} basePath={basePath} filledByAdmin />} />
        <Route path="*" element={<Navigate to={basePath} replace />} />
      </Routes>
    </div>
  );
};

const AdminAsTherapist = () => {
  const { pathname } = useLocation();
  const therapistId = pathname.split('/')[3] || '';
  const navItems = [
    { label: 'Evaluasi Pasien', path: `/admin/as-therapist/${therapistId}/records`, icon: 'BriefcaseMedical' },
  ];
  return (
    <>
      <Helmet><title>Masuk sebagai Terapis - Kaffah System Care</title></Helmet>
      <DashboardLayout navItems={navItems} role="therapist" userName="Admin (mode terapis)">
        <Routes>
          <Route path="/" element={<Navigate to="/admin" replace />} />
          <Route path="/:therapistId/*" element={<TherapistSession />} />
        </Routes>
      </DashboardLayout>
    </>
  );
};

export default AdminAsTherapist;
