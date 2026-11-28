import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Loader2, Star } from 'lucide-react';

// Penanda manual "sudah mengisi Google Review" per pasien. Google tidak menyediakan cara
// memverifikasi review otomatis, jadi admin menandai setelah melihat review masuk / screenshot pasien.
// AI WhatsApp (wa-ai-reply) tidak lagi mengirim link review ke pasien yang berstatus "reviewed",
// atau yang sudah dikirimi link dalam 90 hari terakhir ("link_sent").
const fmt = (iso) => (iso ? new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '');

const GoogleReviewStatus = ({ patientId }) => {
  const { toast } = useToast();
  const [row, setRow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!patientId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('patients')
        .select('google_review_status, google_review_link_sent_at, google_review_marked_at')
        .eq('id', patientId)
        .maybeSingle();
      if (cancelled) return;
      setRow(data || null);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [patientId]);

  const update = async (patch) => {
    setSaving(true);
    const { error } = await supabase.from('patients').update(patch).eq('id', patientId);
    setSaving(false);
    if (error) {
      toast({ variant: 'destructive', title: 'Gagal menyimpan status review', description: error.message });
      return;
    }
    setRow((r) => ({ ...(r || {}), ...patch }));
    toast({ title: 'Status review tersimpan' });
  };

  if (!patientId) return null;
  if (loading) return <Loader2 className="w-4 h-4 animate-spin text-slate-400" />;

  const status = row?.google_review_status || null;
  const reviewed = status === 'reviewed';

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-start gap-2 text-sm">
        <Star className={`w-4 h-4 mt-0.5 ${reviewed ? 'text-amber-500 fill-amber-400' : 'text-slate-400'}`} />
        <div>
          <p className="font-medium text-slate-800">Google Review</p>
          <p className="text-xs text-slate-500">
            {reviewed
              ? `Sudah mengisi review${row?.google_review_marked_at ? ` (ditandai ${fmt(row.google_review_marked_at)})` : ''}. AI tidak akan mengirim link lagi.`
              : status === 'link_sent'
                ? `Link review dikirim AI pada ${fmt(row?.google_review_link_sent_at)}. Belum dikonfirmasi mengisi.`
                : 'Belum pernah diminta review.'}
          </p>
        </div>
      </div>
      <Button
        type="button"
        size="sm"
        variant={reviewed ? 'outline' : 'default'}
        disabled={saving}
        onClick={() => update(reviewed
          ? { google_review_status: row?.google_review_link_sent_at ? 'link_sent' : null, google_review_marked_at: null }
          : { google_review_status: 'reviewed', google_review_marked_at: new Date().toISOString() })}
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : reviewed ? 'Batalkan' : 'Tandai sudah review'}
      </Button>
    </div>
  );
};

export default GoogleReviewStatus;
