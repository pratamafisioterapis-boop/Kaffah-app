import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';

const SECTIONS = [
  { key: 'subjective', label: 'S - Subjective' },
  { key: 'objective', label: 'O - Objective' },
  { key: 'assessment', label: 'A - Assessment' },
  { key: 'plan', label: 'P - Plan' },
];

// Pratinjau SOAP (baca saja) untuk satu recap, ditampilkan sebagai pop up.
const RecapSoapPreviewDialog = ({ open, onOpenChange, recapId, patientName }) => {
  const [loading, setLoading] = useState(false);
  const [record, setRecord] = useState(null);

  useEffect(() => {
    if (!open || !recapId) return undefined;
    let cancelled = false;
    setLoading(true);
    setRecord(null);
    supabase
      .from('medical_records')
      .select('subjective, objective, assessment, plan')
      .eq('daily_recap_id', recapId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setRecord(data || null);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [open, recapId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>SOAP{patientName ? ` - ${patientName}` : ''}</DialogTitle>
          <DialogDescription>Pratinjau catatan SOAP yang diisi terapis.</DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="py-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
        ) : !record ? (
          <p className="py-6 text-center text-sm text-slate-500">SOAP belum diisi oleh terapis.</p>
        ) : (
          <div className="space-y-4">
            {SECTIONS.map(({ key, label }) => (
              <div key={key}>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">{label}</div>
                <div className="text-sm text-slate-800 whitespace-pre-wrap break-words rounded-app-sm border border-slate-200 bg-slate-50 p-3">
                  {(record[key] || '').trim() || <span className="text-slate-400 italic">-</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default RecapSoapPreviewDialog;
