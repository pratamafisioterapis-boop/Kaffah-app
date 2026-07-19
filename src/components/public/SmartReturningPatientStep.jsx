import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { differenceInYears } from 'date-fns';
import { ArrowLeft, ArrowRight, Search, Users, CheckCircle2, AlertTriangle, Phone, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { searchPatientByBirthDateAndLastName, getPatientTherapistHistory } from '@/lib/api';

const SmartReturningPatientStep = ({ onBack, onSwitchToNew, onNext }) => {
  const [lastName, setLastName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [searching, setSearching] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [patient, setPatient] = useState(null);
  const [phone, setPhone] = useState('');
  const [preferredTherapists, setPreferredTherapistsState] = useState([]);
  const [error, setError] = useState('');

  const handleSearch = async () => {
    if (!lastName.trim() || !birthDate) {
      setError('Nama belakang dan tanggal lahir wajib diisi.');
      return;
    }
    setError('');
    setSearching(true);
    setNotFound(false);
    setPatient(null);

    const { data } = await searchPatientByBirthDateAndLastName(lastName, birthDate);
    const found = data && data[0];

    if (!found) {
      setNotFound(true);
      setSearching(false);
      return;
    }

    setPatient(found);
    setPhone(found.phone || '');

    const historyRes = await getPatientTherapistHistory(found.id);
    setPreferredTherapistsState(
      (historyRes.data || []).sort((a, b) => b.count - a.count).slice(0, 2)
    );
    setSearching(false);
  };

  const handleContinue = () => {
    if (!phone.trim()) {
      setError('Nomor WhatsApp wajib diisi.');
      return;
    }
    const age = patient.birth_date ? differenceInYears(new Date(), new Date(patient.birth_date)) : '';
    onNext({
      patientId: patient.id,
      patientData: {
        full_name: patient.full_name,
        phone: phone.trim(),
        age: String(age),
        gender: (patient.gender || '').toLowerCase().startsWith('p') || patient.gender === 'female' ? 'female' : 'male'
      },
      preferredTherapistIds: preferredTherapists.map(t => t.id)
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="w-full max-w-2xl mx-auto px-4 py-2 sm:py-4"
    >
      <Button variant="ghost" onClick={onBack} className="mb-4 sm:mb-6 pl-0 text-[#1e3a8a] hover:bg-transparent">
        <ArrowLeft className="w-4 h-4 mr-2" /> Kembali
      </Button>

      <div className="bg-white rounded-3xl shadow-[0_20px_60px_-25px_rgba(30,58,138,0.25)] overflow-hidden border border-slate-100">
        <div className="bg-gradient-to-br from-[#1e3a8a] to-[#1e40af] p-6 sm:p-8 text-white relative overflow-hidden">
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
          <div className="relative z-10 flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Cari Data Anda</h2>
              <p className="text-blue-100 text-sm mt-0.5">Langkah 1 dari 3 — Smart Booking</p>
            </div>
          </div>
        </div>

        <div className="p-6 sm:p-8 space-y-5 sm:space-y-6">
          {!patient && (
            <>
              <div>
                <Label className="text-sm font-semibold text-slate-700 mb-1.5 block">Nama Belakang</Label>
                <Input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="h-11 sm:h-12 rounded-xl border-slate-200 focus-visible:ring-2 focus-visible:ring-[#1e3a8a]/40"
                />
              </div>
              <div>
                <Label className="text-sm font-semibold text-slate-700 mb-1.5 block">Tanggal Lahir</Label>
                <Input
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  className="h-11 sm:h-12 rounded-xl border-slate-200 focus-visible:ring-2 focus-visible:ring-[#1e3a8a]/40"
                />
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5">{error}</p>
              )}

              <Button
                type="button"
                onClick={handleSearch}
                disabled={searching}
                className="w-full h-12 rounded-xl bg-[#1e3a8a] hover:bg-[#172554] gap-2 font-bold"
              >
                <Search className="w-4 h-4" />
                {searching ? 'Mencari...' : 'Cari Data Pasien'}
              </Button>

              {notFound && (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-4 space-y-3">
                  <p className="text-red-600 font-semibold flex items-center gap-2 text-sm">
                    <AlertTriangle className="w-4 h-4" /> Data tidak ditemukan
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full rounded-xl border-slate-200"
                    onClick={onSwitchToNew}
                  >
                    Daftar Sebagai Pasien Baru
                  </Button>
                </div>
              )}
            </>
          )}

          {patient && (
            <>
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="font-semibold text-emerald-700 text-sm">Pasien Terverifikasi</p>
                  <p className="text-emerald-600 text-sm">{patient.full_name}</p>
                </div>
              </div>

              {preferredTherapists.length > 0 && (
                <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex items-start gap-3">
                  <History className="w-4 h-4 text-[#1e3a8a] shrink-0 mt-0.5" />
                  <p className="text-sm text-[#1e3a8a]">
                    Terapis yang pernah menangani Anda: <span className="font-bold">{preferredTherapists.map(t => t.name).join(', ')}</span> — akan kami prioritaskan di rekomendasi.
                  </p>
                </div>
              )}

              <div>
                <Label className="text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-[#1e3a8a]" /> Nomor WhatsApp
                </Label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="h-11 sm:h-12 rounded-xl border-slate-200 focus-visible:ring-2 focus-visible:ring-[#1e3a8a]/40"
                />
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5">{error}</p>
              )}

              <Button
                type="button"
                onClick={handleContinue}
                className="w-full h-12 sm:h-13 text-base sm:text-lg font-bold rounded-full bg-[#1e3a8a] hover:bg-[#172554] shadow-lg shadow-blue-900/20 hover:shadow-xl transition-all hover:-translate-y-0.5"
              >
                Lanjutkan <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default SmartReturningPatientStep;
