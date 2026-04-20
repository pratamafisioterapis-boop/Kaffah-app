import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, AlertTriangle, CheckCircle2 } from 'lucide-react';
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
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="w-full max-w-3xl mx-auto px-4 py-10"
    >
      <Button variant="ghost" onClick={onBack} className="mb-6 text-[#1e3a8a]">
        <ArrowLeft className="w-4 h-4 mr-2" /> Kembali
      </Button>

      <Card className="rounded-2xl shadow-2xl overflow-hidden border">
        <div className="bg-gradient-to-r from-[#1e3a8a] to-blue-600 p-6 text-white">
          <h2 className="text-2xl font-bold">Data Pasien</h2>
          <p className="text-blue-100 text-sm">
            Pilih jenis pasien
          </p>
        </div>

        <CardContent className="p-8 space-y-8">

          {/* MODE SELECTOR */}
          <div className="grid grid-cols-2 bg-slate-100 rounded-xl p-1">
            <button
              onClick={() => {
                setMode('new');
                setFoundPatient(null);
                setNotFound(false);
              }}
              className={`rounded-lg py-3 text-sm font-semibold transition ${
                mode === 'new'
                  ? 'bg-white shadow text-[#1e3a8a]'
                  : 'text-slate-500'
              }`}
            >
              Pasien Baru
            </button>

            <button
              onClick={() => {
                setMode('old');
                setFoundPatient(null);
                setNotFound(false);
              }}
              className={`rounded-lg py-3 text-sm font-semibold transition ${
                mode === 'old'
                  ? 'bg-white shadow text-[#1e3a8a]'
                  : 'text-slate-500'
              }`}
            >
              Pasien Lama
            </button>
          </div>

          {/* PASIEN LAMA */}
          {mode === 'old' && (
            <div className="space-y-6 bg-slate-50 p-6 rounded-xl border">
              <div>
                <Label>Nama Belakang</Label>
                <Input
                  name="full_name"
                  value={formData.full_name}
                  onChange={handleChange}
                />
              </div>

              <div>
                <Label>Tanggal Lahir</Label>
                <Input
                  type="date"
                  name="birth_date"
                  value={formData.birth_date}
                  onChange={handleChange}
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
                className="w-full h-11 bg-blue-600 hover:bg-blue-700"
              >
                {searching ? "Mencari..." : "Cari Data Pasien"}
              </Button>

              {foundPatient && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
                  <CheckCircle2 className="text-green-600" />
                  <div>
                    <p className="font-semibold text-green-700">
                      Pasien Terverifikasi
                    </p>
                    <p className="text-green-600 text-sm">
                      {foundPatient.full_name}
                    </p>
                  </div>
                </div>
              )}

              {notFound && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-3">
                  <p className="text-red-600 font-semibold">
                    Data tidak ditemukan
                  </p>

                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => setMode('new')}
                    >
                      Daftar Pasien Baru
                    </Button>

                    <Button
                      className="flex-1 bg-red-600 hover:bg-red-700"
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
            <form onSubmit={handleSubmit} className="space-y-6">

              {mode === 'new' && (
  <>
    <div>
      <Label>Nama Lengkap Pasien</Label>
      <Input
        name="full_name"
        value={formData.full_name}
        onChange={handleChange}
      />
    </div>
                  <div>
                    <Label>Nomor WhatsApp</Label>
                    <Input
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                    />
                  </div>

                  <div>
                    <Label>Tanggal Lahir</Label>
                    <Input
                      type="date"
                      name="birth_date"
                      value={formData.birth_date}
                      onChange={handleChange}
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
                <Label>Keluhan</Label>
                <Textarea
                  name="complaint"
                  value={formData.complaint}
                  onChange={handleChange}
                />
              </div>

              <Button
                type="submit"
                className="w-full h-12 text-lg font-semibold rounded-xl bg-[#1e3a8a] hover:bg-[#172554]"
              >
                Lanjut ke Konfirmasi
              </Button>
            </form>
          )}

        </CardContent>
      </Card>
    </motion.div>
  );
};

export default PatientSelectionStep;