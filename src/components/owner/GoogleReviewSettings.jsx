import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, MapPin, Info } from 'lucide-react';

// Google Place ID used by the patient feedback flow (FeedbackManagementPage)
// to redirect 4-5 star ratings to the clinic's "Tulis Ulasan Google" page.
// Lives here under owner Setup rather than the Feedback Pasien page since
// it's a one-time clinic configuration, not something managed per feedback
// link.
const GoogleReviewSettings = () => {
  const { userDetails } = useAuth();
  const { toast } = useToast();

  const [clinic, setClinic] = useState(null);
  const [placeIdInput, setPlaceIdInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const clinicId = userDetails?.clinic_id;

  useEffect(() => {
    if (!clinicId) return;
    let cancelled = false;
    const fetchClinic = async () => {
      setLoading(true);
      const { data } = await supabase.from('clinics').select('id, google_place_id').eq('id', clinicId).single();
      if (cancelled) return;
      setClinic(data || null);
      setPlaceIdInput(data?.google_place_id || '');
      setLoading(false);
    };
    fetchClinic();
    return () => { cancelled = true; };
  }, [clinicId]);

  const handleSave = async () => {
    if (!clinicId) return;
    setSaving(true);
    const { error } = await supabase
      .from('clinics')
      .update({ google_place_id: placeIdInput.trim() || null })
      .eq('id', clinicId);
    setSaving(false);
    if (error) {
      toast({ variant: 'destructive', title: 'Gagal menyimpan Google Place ID', description: error.message });
    } else {
      toast({ title: 'Google Place ID tersimpan' });
      setClinic((c) => (c ? { ...c, google_place_id: placeIdInput.trim() || null } : c));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200 space-y-3 max-w-xl">
      <h3 className="font-semibold text-slate-800 flex items-center gap-2"><MapPin className="w-4 h-4" /> Google Place ID</h3>
      <p className="text-sm text-slate-500">
        Dipakai untuk mengarahkan feedback pasien dengan rating 4-5 bintang ke halaman "Tulis Ulasan Google" klinik.
      </p>
      <div className="flex items-start gap-2 bg-blue-50 text-blue-700 text-xs p-3 rounded-lg">
        <Info className="w-4 h-4 mt-0.5 shrink-0" />
        <span>
          Wajib diisi supaya redirect ke Google Review berfungsi. Cari lewat{' '}
          <a href="https://developers.google.com/maps/documentation/places/web-service/place-id" target="_blank" rel="noreferrer" className="underline">
            Google Place ID Finder
          </a>{' '}
          menggunakan nama & alamat klinik.
        </span>
      </div>
      <div className="flex gap-2">
        <Input placeholder="ChIJ..." value={placeIdInput} onChange={(e) => setPlaceIdInput(e.target.value)} />
        <Button onClick={handleSave} disabled={saving} className="bg-blue-600 shrink-0">
          {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Simpan
        </Button>
      </div>
      {!clinic?.google_place_id && (
        <p className="text-xs text-amber-600">Belum diisi — feedback rating tinggi belum bisa diarahkan ke Google Review.</p>
      )}
    </div>
  );
};

export default GoogleReviewSettings;
