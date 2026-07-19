import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, UserPlus, Phone, Cake, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

const GENDERS = [
  { id: 'male', label: 'Laki-laki' },
  { id: 'female', label: 'Perempuan' },
];

const SmartPatientStep = ({ initialData, onBack, onNext }) => {
  const [formData, setFormData] = useState(initialData || { full_name: '', phone: '', age: '', gender: '' });
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.full_name.trim()) return setError('Nama lengkap wajib diisi.');
    if (!formData.phone.trim()) return setError('Nomor WhatsApp wajib diisi.');
    if (!formData.age || parseInt(formData.age, 10) <= 0) return setError('Usia wajib diisi dengan angka yang valid.');
    if (!formData.gender) return setError('Jenis kelamin wajib dipilih.');
    setError('');
    onNext(formData);
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
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Data Diri Anda</h2>
              <p className="text-blue-100 text-sm mt-0.5">Langkah 1 dari 3 — Smart Booking</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-5 sm:space-y-6">
          <div>
            <Label className="text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <UserPlus className="w-3.5 h-3.5 text-[#1e3a8a]" /> Nama Lengkap
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Cake className="w-3.5 h-3.5 text-[#1e3a8a]" /> Usia
              </Label>
              <Input
                type="number"
                min={0}
                name="age"
                value={formData.age}
                onChange={handleChange}
                placeholder="Tahun"
                className="h-11 sm:h-12 rounded-xl border-slate-200 focus-visible:ring-2 focus-visible:ring-[#1e3a8a]/40"
              />
            </div>
            <div>
              <Label className="text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-[#1e3a8a]" /> Jenis Kelamin
              </Label>
              <div className="grid grid-cols-2 gap-2">
                {GENDERS.map(g => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, gender: g.id }))}
                    className={cn(
                      "h-11 sm:h-12 rounded-xl border text-sm font-semibold transition-all",
                      formData.gender === g.id
                        ? "bg-[#1e3a8a] border-[#1e3a8a] text-white"
                        : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                    )}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5">{error}</p>
          )}

          <Button
            type="submit"
            className="w-full h-12 sm:h-13 text-base sm:text-lg font-bold rounded-full bg-[#1e3a8a] hover:bg-[#172554] shadow-lg shadow-blue-900/20 hover:shadow-xl transition-all hover:-translate-y-0.5"
          >
            Lanjutkan <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </form>
      </div>
    </motion.div>
  );
};

export default SmartPatientStep;
