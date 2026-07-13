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
import { getTherapistSlotSummary, generateBookingAvailabilityMessage } from '@/lib/scheduleTemplateService';

const ScheduleTemplateModal = ({ open, onOpenChange, date, therapists, schedulesMap }) => {
  const { clinicName } = useAuth();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [selectedTherapistId, setSelectedTherapistId] = useState('all');

  const message = useMemo(() => {
    if (!open) return '';

    const list = selectedTherapistId === 'all'
      ? therapists
      : therapists.filter(t => t.id === selectedTherapistId);

    const therapistSummaries = list.map(t => ({
      name: t.name,
      summary: getTherapistSlotSummary(schedulesMap[t.id] || [])
    }));

    return generateBookingAvailabilityMessage({ clinicName, date, therapistSummaries });
  }, [open, selectedTherapistId, therapists, schedulesMap, date, clinicName]);

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
      <DialogContent className="w-full max-w-lg bg-white p-6 rounded-2xl">
        <DialogHeader>
          <DialogTitle>Template Jadwal Tersedia</DialogTitle>
          <DialogDescription>
            Salin pesan ini untuk menjawab pasien yang menanyakan jadwal kosong.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSelectedTherapistId('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                selectedTherapistId === 'all'
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              Semua Terapis
            </button>
            {therapists.map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelectedTherapistId(t.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  selectedTherapistId === t.id
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {t.name}
              </button>
            ))}
          </div>

          <Textarea
            readOnly
            value={message}
            className="min-h-[220px] text-sm font-mono bg-slate-50"
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