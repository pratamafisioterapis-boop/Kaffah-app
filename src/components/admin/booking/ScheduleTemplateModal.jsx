import React, { useMemo, useState } from 'react';
import { ClipboardCopy, Check } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';
import {
  getTherapistSlotSummary,
  generateBookingAvailabilityMessage,
  getGlobalSlotSummary,
  generateGlobalAvailabilityMessage
} from '@/lib/scheduleTemplateService';

// Urutan prioritas badge: hijau (masih ada jadwal) → merah (penuh) → abu-abu (cuti/libur)
const STATUS_ORDER = { green: 0, red: 1, gray: 2 };

const ScheduleTemplateModal = ({ open, onOpenChange, date, therapists, schedulesMap, therapistLeaveStatus = {} }) => {
  const { clinicName } = useAuth();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  // 'all' = semua terapis (perilaku lama). Array of id = terapis-terapis yang dipilih (bisa lebih dari 1).
  const [selectedTherapistIds, setSelectedTherapistIds] = useState('all');
  const [templateMode, setTemplateMode] = useState('named'); // 'named' | 'global'
  const [genderFilter, setGenderFilter] = useState('all'); // 'all' | 'male' | 'female'

  const handleGenderFilterChange = (value) => {
    setGenderFilter(value);
    setSelectedTherapistIds('all');
  };

  const toggleTherapistSelection = (id) => {
    setSelectedTherapistIds(prev => {
      if (prev === 'all') return [id];
      if (prev.includes(id)) {
        const next = prev.filter(existingId => existingId !== id);
        return next.length === 0 ? 'all' : next;
      }
      return [...prev, id];
    });
  };

  const getTherapistBadgeColor = (therapist) => {
    const leave = therapistLeaveStatus?.[therapist.id];
    if (leave === 'cuti' || leave === 'libur_mingguan') return 'gray';

    const slots = schedulesMap[therapist.id] || [];
    const hasAvailable = slots.some(s => s.status === 'aktif');
    return hasAvailable ? 'green' : 'red';
  };

  const badgeDotClass = {
    green: 'bg-emerald-500',
    red: 'bg-red-500',
    gray: 'bg-slate-400'
  };

  // Terapis yang sesuai filter jenis kelamin (Semua / Cowok / Cewek)
  const genderFilteredTherapists = useMemo(() => {
    if (genderFilter === 'all') return therapists;
    return therapists.filter(t => t.gender === genderFilter);
  }, [therapists, genderFilter]);

  // Terapis yang tampil di filter, sudah diurutkan: hijau → merah → abu-abu
  const sortedTherapists = useMemo(() => {
    return [...genderFilteredTherapists].sort((a, b) => {
      const orderA = STATUS_ORDER[getTherapistBadgeColor(a)];
      const orderB = STATUS_ORDER[getTherapistBadgeColor(b)];
      return orderA - orderB;
    });
  }, [genderFilteredTherapists, schedulesMap, therapistLeaveStatus]);

  const selectedTherapists = useMemo(() => {
    if (selectedTherapistIds === 'all') return genderFilteredTherapists;
    return genderFilteredTherapists.filter(t => selectedTherapistIds.includes(t.id));
  }, [selectedTherapistIds, genderFilteredTherapists]);

  const message = useMemo(() => {
    if (!open) return '';

    if (templateMode === 'global') {
      const allSlotLists = selectedTherapists.map(t => schedulesMap[t.id] || []);
      const globalSummary = getGlobalSlotSummary(allSlotLists, undefined, date);
      return generateGlobalAvailabilityMessage({ clinicName, date, globalSummary });
    }

    const therapistSummaries = selectedTherapists.map(t => ({
      name: t.name,
      summary: getTherapistSlotSummary(schedulesMap[t.id] || [], undefined, date)
    }));

    return generateBookingAvailabilityMessage({ clinicName, date, therapistSummaries });
  }, [open, templateMode, selectedTherapists, schedulesMap, date, clinicName]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      toast({ title: 'Template disalin', description: 'Pesan siap ditempel ke WhatsApp.' });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({ variant: 'destructive', title: 'Gagal menyalin', description: 'Salin manual dari kotak teks.' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-full sm:max-w-lg bg-white p-4 sm:p-6 rounded-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base sm:text-lg">Template Jadwal Tersedia</DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Salin pesan ini untuk menjawab pasien yang menanyakan jadwal kosong.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* Mode: Dengan Nama Terapis / Global */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => setTemplateMode('named')}
              className={`flex items-center justify-center text-center px-2 sm:px-3 py-2 rounded-md text-[11px] sm:text-xs font-semibold leading-tight transition-colors ${
                templateMode === 'named'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Dengan Nama Terapis
            </button>
            <button
              type="button"
              onClick={() => setTemplateMode('global')}
              className={`flex items-center justify-center text-center px-2 sm:px-3 py-2 rounded-md text-[11px] sm:text-xs font-semibold leading-tight transition-colors ${
                templateMode === 'global'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Tanpa Nama Terapis (Global)
            </button>
          </div>

          {/* Filter Jenis Kelamin: Semua / Cowok / Cewek */}
          <div className="grid grid-cols-3 gap-2 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => handleGenderFilterChange('all')}
              className={`flex items-center justify-center text-center px-2 sm:px-3 py-2 rounded-md text-[11px] sm:text-xs font-semibold leading-tight transition-colors ${
                genderFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Gabungan
            </button>
            <button
              type="button"
              onClick={() => handleGenderFilterChange('male')}
              className={`flex items-center justify-center text-center px-2 sm:px-3 py-2 rounded-md text-[11px] sm:text-xs font-semibold leading-tight transition-colors ${
                genderFilter === 'male'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Terapis Cowok
            </button>
            <button
              type="button"
              onClick={() => handleGenderFilterChange('female')}
              className={`flex items-center justify-center text-center px-2 sm:px-3 py-2 rounded-md text-[11px] sm:text-xs font-semibold leading-tight transition-colors ${
                genderFilter === 'female'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Terapis Cewek
            </button>
          </div>

          {/* Legenda warna */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] sm:text-[11px] text-slate-500 px-0.5">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" /> Masih ada jadwal
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" /> Penuh
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-slate-400 shrink-0" /> Cuti/Libur
            </span>
          </div>

          {genderFilter !== 'all' && sortedTherapists.length === 0 && (
            <p className="text-[11px] sm:text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Belum ada terapis dengan jenis kelamin {genderFilter === 'male' ? 'laki-laki' : 'perempuan'} yang terdaftar. Lengkapi data jenis kelamin terapis di menu Physiotherapist Management.
            </p>
          )}

          {/* Filter Terapis: pilih Semua, atau centang satu/lebih terapis tertentu */}
          <p className="text-[10px] sm:text-[11px] text-slate-400 px-0.5 -mb-1">
            Pilih "Semua Terapis" atau centang terapis tertentu (bisa lebih dari satu).
          </p>
          <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => setSelectedTherapistIds('all')}
              className={`col-span-2 px-2.5 sm:px-3 py-2 rounded-lg text-[11px] sm:text-xs font-medium border transition-colors ${
                selectedTherapistIds === 'all'
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              Semua Terapis
            </button>
            {sortedTherapists.map(t => {
              const color = getTherapistBadgeColor(t);
              const isActive = selectedTherapistIds === 'all'
                ? color === 'green'
                : selectedTherapistIds.includes(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => toggleTherapistSelection(t.id)}
                  aria-pressed={isActive}
                  className={`flex items-center gap-1.5 min-w-0 px-2.5 sm:px-3 py-2 rounded-lg text-[11px] sm:text-xs font-medium border transition-colors ${
                    isActive
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <span className={`w-3.5 h-3.5 rounded-[4px] border shrink-0 flex items-center justify-center ${
                    isActive ? 'bg-white border-white' : 'border-slate-300'
                  }`}>
                    {isActive && <Check className="w-2.5 h-2.5 text-slate-900" strokeWidth={3} />}
                  </span>
                  <span className={`w-2 h-2 rounded-full shrink-0 ${badgeDotClass[color]}`} />
                  <span className="truncate">{t.name}</span>
                </button>
              );
            })}
          </div>

          <Textarea
            readOnly
            value={message}
            className="min-h-[160px] sm:min-h-[220px] text-xs sm:text-sm font-mono bg-slate-50"
          />

          <Button onClick={handleCopy} className="w-full bg-emerald-600 hover:bg-emerald-700">
            {copied ? <Check className="w-4 h-4 mr-2" /> : <ClipboardCopy className="w-4 h-4 mr-2" />}
            {copied ? 'Tersalin' : 'Copy Pesan'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ScheduleTemplateModal;