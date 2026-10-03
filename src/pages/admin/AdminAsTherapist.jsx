import React, { useEffect, useState } from 'react';
import { Routes, Route, useParams, Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { Loader2, UserCog, ArrowLeft } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import TherapistMedicalRecords from '@/components/therapist/TherapistMedicalRecords';
import MedicalRecordForm from '@/components/therapist/MedicalRecordForm';
import { getPhysiotherapists } from '@/lib/api';
import { supabase } from '@/lib/customSupabaseClient';

const TherapistPicker = () => {
  const [therapists, setTherapists] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    getPhysiotherapists().then(({ data }) => {
      setTherapists((data || []).filter((t) => t.user_id && t.is_active !== false));
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin w-6 h-6 text-blue-600" /></div>;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Pindah ke Akun Terapis</h1>
        <p className="text-sm text-slate-500">Pilih terapis untuk mengisi evaluasi pasien (SOAP) atas namanya. Data tercatat atas nama terapis dan ditandai "Diisi via Admin".</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {therapists.map((t) => (
          <button
            key={t.id}
            onClick={() => navigate(`/admin/as-therapist/${t.id}/records`)}
            className="flex items-center gap-3 p-4 bg-white border border-slate-200 rounded-xl text-left hover:border-blue-400 hover:shadow-sm transition"
          >
            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center"><UserCog className="w-5 h-5 text-blue-600" /></div>
            <span className="font-medium text-slate-800">{t.name}</span>
          </button>
        ))}
        {therapists.length === 0 && <p className="text-slate-500 text-sm">Belum ada terapis dengan akun login.</p>}
      </div>
    </div>
  );
};

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
        <Link to="/admin/as-therapist" className="underline font-medium">Ganti terapis</Link>
      </div>
      <Routes>
        <Route path="records" element={<TherapistMedicalRecords therapist={therapist} basePath={basePath} />} />
        <Route path="records/new/:patientId" element={<MedicalRecordForm therapist={therapist} basePath={basePath} filledByAdmin />} />
      </Routes>
    </div>
  );
};

const AdminAsTherapist = () => {
  const navItems = [
    { label: 'Evaluasi Pasien', path: '/admin/as-therapist', icon: 'BriefcaseMedical' },
    { label: 'Kembali ke Admin', path: '/admin', icon: 'Home' },
  ];
  return (
    <>
      <Helmet><title>Masuk sebagai Terapis - Kaffah System Care</title></Helmet>
      <DashboardLayout navItems={navItems} role="therapist" userName="Admin (mode terapis)">
        <Routes>
          <Route path="/" element={<TherapistPicker />} />
          <Route path="/:therapistId/*" element={<TherapistSession />} />
        </Routes>
      </DashboardLayout>
    </>
  );
};

export default AdminAsTherapist;
