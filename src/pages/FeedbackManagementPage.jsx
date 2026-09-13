import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Loader2, Link2, Copy, Star, MapPin, Info } from 'lucide-react';
import { formatDateIndonesian } from '@/lib/dateFormatHelpers';
import { PUBLIC_DOMAIN } from '@/lib/domainRouting';

// Always build the shareable link on the clinic's own public domain, never
// on window.location.origin: staff generate these from inside the app
// (clinara.id), and a patient opening a clinara.id link on a phone that
// already has the app installed as a PWA gets the SaaS platform's own
// native splash screen (Clinara logo on white) before anything else loads
// -- confusing branding and a jarring flash for a one-off patient link.
const buildFeedbackUrl = (token) => `https://${PUBLIC_DOMAIN}/feedback/${token}`;

// Shared feedback-link management UI, embedded by the owner and admin
// dashboard wrapper pages (same pattern as PackageRecapsContent). Lets
// staff generate a one-time patient feedback link, see submitted
// responses, and approve which ones show up as public testimonials via
// get_public_feedback().
export const FeedbackManagementContent = () => {
  const { userDetails } = useAuth();
  const { toast } = useToast();

  const [clinic, setClinic] = useState(null);
  const [placeIdInput, setPlaceIdInput] = useState('');
  const [savingPlaceId, setSavingPlaceId] = useState(false);

  const [patientName, setPatientName] = useState('');
  const [generating, setGenerating] = useState(false);

  const [links, setLinks] = useState([]);
  const [responses, setResponses] = useState([]);
  const [loading, setLoading] = useState(true);

  const clinicId = userDetails?.clinic_id;

  const fetchData = useCallback(async () => {
    if (!clinicId) return;
    setLoading(true);
    const [{ data: clinicData }, { data: linkData }, { data: responseData }] = await Promise.all([
      supabase.from('clinics').select('id, google_place_id').eq('id', clinicId).single(),
      supabase.from('patient_feedback_links').select('*').eq('clinic_id', clinicId).order('created_at', { ascending: false }),
      supabase.from('patient_feedback_responses').select('*').eq('clinic_id', clinicId).order('created_at', { ascending: false }),
    ]);
    if (clinicData) {
      setClinic(clinicData);
      setPlaceIdInput(clinicData.google_place_id || '');
    }
    setLinks(linkData || []);
    setResponses(responseData || []);
    setLoading(false);
  }, [clinicId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSavePlaceId = async () => {
    if (!clinicId) return;
    setSavingPlaceId(true);
    const { error } = await supabase
      .from('clinics')
      .update({ google_place_id: placeIdInput.trim() || null })
      .eq('id', clinicId);
    setSavingPlaceId(false);
    if (error) {
      toast({ variant: 'destructive', title: 'Gagal menyimpan Google Place ID', description: error.message });
    } else {
      toast({ title: 'Google Place ID tersimpan' });
      setClinic((c) => (c ? { ...c, google_place_id: placeIdInput.trim() || null } : c));
    }
  };

  const handleGenerateLink = async () => {
    if (!clinicId) return;
    setGenerating(true);
    const token = crypto.randomUUID().replace(/-/g, '');
    const { data, error } = await supabase
      .from('patient_feedback_links')
      .insert([{ clinic_id: clinicId, token, patient_name: patientName.trim() || null }])
      .select()
      .single();
    setGenerating(false);
    if (error) {
      toast({ variant: 'destructive', title: 'Gagal membuat link', description: error.message });
      return;
    }
    setLinks((prev) => [data, ...prev]);
    setPatientName('');
    const url = buildFeedbackUrl(token);
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: 'Link feedback dibuat & disalin', description: url });
    } catch {
      toast({ title: 'Link feedback dibuat', description: url });
    }
  };

  const handleCopyLink = async (token) => {
    const url = buildFeedbackUrl(token);
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: 'Link disalin', description: url });
    } catch {
      toast({ title: 'Link', description: url });
    }
  };

  const handleToggleApprove = async (response) => {
    const { error } = await supabase
      .from('patient_feedback_responses')
      .update({ is_approved: !response.is_approved })
      .eq('id', response.id);
    if (error) {
      toast({ variant: 'destructive', title: 'Gagal update status', description: error.message });
      return;
    }
    setResponses((prev) => prev.map((r) => (r.id === response.id ? { ...r, is_approved: !r.is_approved } : r)));
  };

  const linksById = Object.fromEntries(links.map((l) => [l.id, l]));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-xl font-bold text-slate-800">Feedback Pasien</h2>
        <p className="text-sm text-slate-500 mt-1">
          Buat link unik untuk seorang pasien mengisi feedback. Rating 4-5 bintang otomatis diarahkan
          ke halaman "Tulis Ulasan Google" klinik; rating rendah hanya tersimpan internal.
        </p>
      </div>

      <div className="bg-white p-6 rounded-xl border border-slate-200 space-y-3">
        <h3 className="font-semibold text-slate-800 flex items-center gap-2"><MapPin className="w-4 h-4" /> Google Place ID</h3>
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
          <Button onClick={handleSavePlaceId} disabled={savingPlaceId} className="bg-blue-600 shrink-0">
            {savingPlaceId && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Simpan
          </Button>
        </div>
        {!clinic?.google_place_id && (
          <p className="text-xs text-amber-600">Belum diisi — feedback rating tinggi belum bisa diarahkan ke Google Review.</p>
        )}
      </div>

      <div className="bg-white p-6 rounded-xl border border-slate-200 space-y-3">
        <h3 className="font-semibold text-slate-800 flex items-center gap-2"><Link2 className="w-4 h-4" /> Buat Link Feedback Baru</h3>
        <div className="flex gap-2">
          <Input
            placeholder="Nama pasien (opsional)"
            value={patientName}
            onChange={(e) => setPatientName(e.target.value)}
          />
          <Button onClick={handleGenerateLink} disabled={generating} className="bg-blue-600 shrink-0">
            {generating && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Buat Link
          </Button>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl border border-slate-200 space-y-3">
        <h3 className="font-semibold text-slate-800">Link Terbaru</h3>
        {links.length === 0 && <p className="text-sm text-slate-500">Belum ada link feedback dibuat.</p>}
        <div className="divide-y divide-slate-100">
          {links.slice(0, 15).map((link) => (
            <div key={link.id} className="py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">{link.patient_name || 'Tanpa nama'}</p>
                <p className="text-xs text-slate-500">{formatDateIndonesian(link.created_at)}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {link.responded_at ? (
                  <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Sudah diisi</Badge>
                ) : (
                  <Badge variant="outline">Menunggu</Badge>
                )}
                <Button size="sm" variant="outline" onClick={() => handleCopyLink(link.token)}>
                  <Copy className="w-3.5 h-3.5 mr-1.5" /> Salin
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl border border-slate-200 space-y-3">
        <h3 className="font-semibold text-slate-800">Feedback Masuk</h3>
        <p className="text-xs text-slate-400">
          Badge "Diarahkan ke Google" berarti pasien klik tombol menuju halaman Google Review -- Google tidak
          menyediakan cara untuk memastikan review-nya benar-benar terkirim di sana.
        </p>
        {responses.length === 0 && <p className="text-sm text-slate-500">Belum ada feedback masuk.</p>}
        <div className="divide-y divide-slate-100">
          {responses.map((response) => (
            <div key={response.id} className="py-4 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-800">
                    {response.patient_name || linksById[response.link_id]?.patient_name || 'Anonim'}
                  </p>
                  <div className="flex items-center gap-0.5 mt-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`w-3.5 h-3.5 ${i < response.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}`}
                      />
                    ))}
                  </div>
                  {response.rating >= 4 && (
                    response.google_review_clicked_at ? (
                      <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 mt-1">Diarahkan ke Google</Badge>
                    ) : (
                      <Badge variant="outline" className="mt-1">Belum klik ke Google</Badge>
                    )
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-slate-500">Tampilkan di website</span>
                  <Switch checked={response.is_approved} onCheckedChange={() => handleToggleApprove(response)} />
                </div>
              </div>
              {response.comment && <p className="text-sm text-slate-600">{response.comment}</p>}
              <p className="text-xs text-slate-400">{formatDateIndonesian(response.created_at)}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default FeedbackManagementContent;
