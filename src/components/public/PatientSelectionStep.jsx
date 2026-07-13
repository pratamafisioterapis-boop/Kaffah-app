import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, AlertTriangle, CheckCircle2, UserPlus, Users, Search, Phone, Calendar, MessageCircle, ShieldCheck } from 'lucide-react';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { searchPatientByBirthDateAndLastName } from '@/lib/api';

const PatientSelectionStep = ({
  onBack,
  onComplete,
  selectedDate,
  selectedTherapistName,
  selectedSlot
}) => {

  const [mode, setMode] = useState('new');
  const [searching, setSearching] = useState(false);
  const [foundPatient, setFoundPatient] = useState(null);
  const [notFound, setNotFound] = useState(false);

  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    complaint: '',
    birth_date: '',
    isNew: true
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSearchOldPatient = async () => {
    if (!formData.full_name || !formData.birth_date) return;

    setSearching(true);
    setNotFound(false);
    setFoundPatient(null);

    const { data } = await searchPatientByBirthDateAndLastName(
      formData.full_name,
      formData.birth_date
    );

    setSearching(false);

    if (!data || data.length === 0) {
      setNotFound(true);
      return;
    }

    const patient = data[0];
    setFoundPatient(patient);

    setFormData(prev => ({
  ...prev,
  patient_id: patient.id,
  full_name: patient.full_name,
  birth_date: patient.birth_date,
  phone: patient.phone || '',
  isNew: false
}));
  };

  const handleContactAdmin = () => {
    if (!selectedDate) return;

    const hari = format(selectedDate, 'EEEE', { locale: idLocale });
    const tanggal = format(selectedDate, 'dd MMMM yyyy', { locale: idLocale });
    const jam = selectedSlot?.time || '-';

    const message = `
Halo Admin Kaffah Physio

Saya ingin reservasi:
• Hari: ${hari}
• Tanggal: ${tanggal}
• Jam: ${jam}
• Fisioterapis: ${selectedTherapistName}
• Nama Pasien: ${formData.full_name}

Terimakasih Atas Perhatiannya
    `.trim();

    const encoded = encodeURIComponent(message);
    window.open(`https://wa.me/6285245965745?text=${encoded}`, '_blank');
  };

  const handleSubmit = (e) => {
  e.preventDefault();

  if (mode === 'new' && !formData.full_name) {
    alert('Nama pasien wajib diisi');
    return;
  }

 if (mode === 'new' && !formData.phone) {
  alert('Nomor WhatsApp wajib diisi');
  return;
}

  if (!formData.birth_date) {
    alert('Tanggal lahir wajib diisi');
    return;
  }

  onComplete(formData);
};

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="w-full max-w-3xl mx-auto px-4 py-2 sm:py-4"
    >
      <Button variant="ghost" onClick={onBack} className="mb-4 sm:mb-6 pl-0 text-[#1e3a8a] hover:bg-transparent">
        <ArrowLeft className="w-4 h-4 mr-2" /> Kembali
      </Button>

      <Card className="rounded-3xl shadow-[0_20px_60px_-25px_rgba(30,58,138,0.25)] overflow-hidden border border-slate-100">
        <div className="bg-gradient-to-br from-[#1e3a8a] to-[#1e40af] p-6 sm:p-8 text-white relative overflow-hidden">
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
          <div className="relative z-10 flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center shrink-0">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Data Pasien</h2>
              <p className="text-blue-100 text-sm mt-0.5">
                Pilih jenis pasien untuk melanjutkan
              </p>
            </div>
          </div>
        </div>

        <CardContent className="p-6 sm:p-8 space-y-7 sm:space-y-8">

          {/* MODE SELECTOR */}
          <div className="grid grid-cols-2 bg-slate-100 rounded-2xl p-1.5 gap-1">
            <button
              onClick={() => {
                setMode('new');
                setFoundPatient(null);
                setNotFound(false);
              }}
              className={`flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-all ${
                mode === 'new'
                  ? 'bg-white shadow-md text-[#1e3a8a]'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <UserPlus className="w-4 h-4" /> Pasien Baru
            </button>

            <button
              onClick={() => {
                setMode('old');
                setFoundPatient(null);
                setNotFound(false);
              }}
              className={`flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-all ${
                mode === 'old'
                  ? 'bg-white shadow-md text-[#1e3a8a]'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Users className="w-4 h-4" /> Pasien Lama
            </button>
          </div>

          {/* PASIEN LAMA */}
          {mode === 'old' && (
            <div className="space-y-5 sm:space-y-6 bg-slate-50 p-5 sm:p-6 rounded-2xl border border-slate-200">
              <div>
                <Label className="text-sm font-semibold text-slate-700 mb-1.5 block">Nama Belakang</Label>
                <Input
                  name="full_name"
                  value={formData.full_name}
                  onChange={handleChange}
                  className="h-11 rounded-xl border-slate-200 focus-visible:ring-2 focus-visible:ring-[#1e3a8a]/40"
                />
              </div>

              <div>
                <Label className="text-sm font-semibold text-slate-700 mb-1.5 block">Tanggal Lahir</Label>
                <Input
                  type="date"
                  name="birth_date"
                  value={formData.birth_date}
                  onChange={handleChange}
                  className="h-11 rounded-xl border-slate-200 focus-visible:ring-2 focus-visible:ring-[#1e3a8a]/40"
                />
                {formData.birth_date && (
                  <p className="text-sm text-slate-500 mt-2">
                    {format(new Date(formData.birth_date), 'dd/MM/yyyy')}
                  </p>
                )}
              </div>

              <Button
                type="button"
                onClick={handleSearchOldPatient}
                disabled={searching}
                className="w-full h-11 rounded-xl bg-[#1e3a8a] hover:bg-[#172554] gap-2 font-semibold"
              >
                <Search className="w-4 h-4" />
                {searching ? "Mencari..." : "Cari Data Pasien"}
              </Button>

              {foundPatient && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-emerald-700 text-sm">
                      Pasien Terverifikasi
                    </p>
                    <p className="text-emerald-600 text-sm">
                      {foundPatient.full_name}
                    </p>
                  </div>
                </div>
              )}

              {notFound && (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-4 space-y-3">
                  <p className="text-red-600 font-semibold flex items-center gap-2 text-sm">
                    <AlertTriangle className="w-4 h-4" /> Data tidak ditemukan
                  </p>

                  <div className="flex flex-col sm:flex-row gap-3">
                    <Button
                      variant="outline"
                      className="flex-1 rounded-xl border-slate-200"
                      onClick={() => setMode('new')}
                    >
                      Daftar Pasien Baru
                    </Button>

                    <Button
                      className="flex-1 rounded-xl bg-red-600 hover:bg-red-700"
                      onClick={handleContactAdmin}
                    >
                      Hubungi Admin
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* FORM */}
          {(mode === 'new' || foundPatient) && (
            <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">

              {mode === 'new' && (
  <>
    <div>
      <Label className="text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
        <UserPlus className="w-3.5 h-3.5 text-[#1e3a8a]" /> Nama Lengkap Pasien
      </Label>
      <Input
        name="full_name"
        value={formData.full_name}
        onChange={handleChange}
        className="h-11 sm:h-12 rounded-xl border-slate-200 focus-visible:ring-2 focus-visible:ring-[#1e3a8a]/40"
      />
    </div>
                  <div>
                    <Label className="text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-[#1e3a8a]" /> Nomor WhatsApp
                    </Label>
                    <Input
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      className="h-11 sm:h-12 rounded-xl border-slate-200 focus-visible:ring-2 focus-visible:ring-[#1e3a8a]/40"
                    />
                  </div>

                  <div>
                    <Label className="text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-[#1e3a8a]" /> Tanggal Lahir
                    </Label>
                    <Input
                      type="date"
                      name="birth_date"
                      value={formData.birth_date}
                      onChange={handleChange}
                      className="h-11 sm:h-12 rounded-xl border-slate-200 focus-visible:ring-2 focus-visible:ring-[#1e3a8a]/40"
                    />
                    {formData.birth_date && (
                      <p className="text-sm text-slate-500 mt-2">
                        {format(new Date(formData.birth_date), 'dd/MM/yyyy')}
                      </p>
                    )}
                  </div>
                </>
              )}

              <div>
                <Label className="text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <MessageCircle className="w-3.5 h-3.5 text-[#1e3a8a]" /> Keluhan
                </Label>
                <Textarea
                  name="complaint"
                  value={formData.complaint}
                  onChange={handleChange}
                  className="rounded-xl border-slate-200 focus-visible:ring-2 focus-visible:ring-[#1e3a8a]/40 min-h-[100px]"
                />
              </div>

              <Button
                type="submit"
                className="w-full h-12 sm:h-13 text-base sm:text-lg font-bold rounded-full bg-[#1e3a8a] hover:bg-[#172554] shadow-lg shadow-blue-900/20 hover:shadow-xl transition-all hover:-translate-y-0.5"
              >
                Lanjut ke Konfirmasi
              </Button>

              <p className="flex items-center justify-center gap-1.5 text-xs text-slate-400 pt-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> Data Anda tersimpan aman dan rahasia
              </p>
            </form>
          )}

        </CardContent>
      </Card>
    </motion.div>
  );
};

export default PatientSelectionStep;
