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
  const [selectedTherapistId, setSelectedTherapistId] = useState('all');
  const [templateMode, setTemplateMode] = useState('named'); // 'named' | 'global'

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

  // Terapis yang tampil di filter, sudah diurutkan: hijau → merah → abu-abu
  const sortedTherapists = useMemo(() => {
    return [...therapists].sort((a, b) => {
      const orderA = STATUS_ORDER[getTherapistBadgeColor(a)];
      const orderB = STATUS_ORDER[getTherapistBadgeColor(b)];
      return orderA - orderB;
    });
  }, [therapists, schedulesMap, therapistLeaveStatus]);

  const selectedTherapists = useMemo(() => {
    if (selectedTherapistId === 'all') return therapists;
    return therapists.filter(t => t.id === selectedTherapistId);
  }, [selectedTherapistId, therapists]);

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
          <div className="flex gap-2 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => setTemplateMode('named')}
              className={`flex-1 px-2 sm:px-3 py-1.5 rounded-md text-[11px] sm:text-xs font-semibold transition-colors ${
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
              className={`flex-1 px-2 sm:px-3 py-1.5 rounded-md text-[11px] sm:text-xs font-semibold transition-colors ${
                templateMode === 'global'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Tanpa Nama Terapis (Global)
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

          {/* Filter Terapis */}
          <div className="flex flex-wrap gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => setSelectedTherapistId('all')}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-medium border transition-colors ${
                selectedTherapistId === 'all'
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              Semua Terapis
            </button>
            {sortedTherapists.map(t => {
              const color = getTherapistBadgeColor(t);
              const isActive = selectedTherapistId === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelectedTherapistId(t.id)}
                  className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-medium border transition-colors ${
                    isActive
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full shrink-0 ${badgeDotClass[color]}`} />
                  <span className="truncate max-w-[140px] sm:max-w-none">{t.name}</span>
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