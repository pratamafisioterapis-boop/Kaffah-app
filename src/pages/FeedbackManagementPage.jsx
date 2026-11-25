import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Loader2, Link2, Copy, Star, Search, X } from 'lucide-react';
import { formatDateIndonesian } from '@/lib/dateFormatHelpers';
import { portalBaseUrl } from '@/lib/patientPortal';
import { QUESTIONNAIRE_CLINIC_IDS, KAFFAH_CLINIC_ID } from '@/lib/clinicIds';
import PageHero from '@/components/shared/PageHero';

// Always build the shareable link on the clinic's own public domain, never
// on window.location.origin: staff generate these from inside the app
// (clinara.id), and a patient opening a clinara.id link on a phone that
// already has the app installed as a PWA gets the SaaS platform's own
// native splash screen (Clinara logo on white) before anything else loads
// -- confusing branding and a jarring flash for a one-off patient link.
// Domain klinik sendiri (custom domain / subdomain), bukan domain Kaffah.
const buildFeedbackUrl = (token, clinic) => `${portalBaseUrl(clinic)}/feedback/${token}`;

// Shared feedback-link management UI, embedded by the owner and admin
// dashboard wrapper pages (same pattern as PackageRecapsContent). Lets
// staff generate a one-time patient feedback link, see submitted
// responses, and approve which ones show up as public testimonials via
// get_public_feedback().
export const FeedbackManagementContent = () => {
  const { userDetails, clinicName } = useAuth();
  const { toast } = useToast();

  const [patientName, setPatientName] = useState('');
  const [generating, setGenerating] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [patientResults, setPatientResults] = useState([]);

  const [links, setLinks] = useState([]);
  const [responses, setResponses] = useState([]);
  const [loading, setLoading] = useState(true);

  const clinicId = userDetails?.clinic_id;
  // Praxis & Kaffah: kuesioner lengkap -> langsung Google Review (semua rating).
  const isQuestionnaire = QUESTIONNAIRE_CLINIC_IDS.includes(clinicId);
  const [patientPhones, setPatientPhones] = useState({});
  const [clinicDomain, setClinicDomain] = useState(null);

  useEffect(() => {
    if (!clinicId) return;
    supabase.from('clinics').select('id, subdomain, custom_domain, custom_domain_status')
      .eq('id', clinicId).maybeSingle().then(({ data }) => setClinicDomain(data || null));
  }, [clinicId]);

  // Cari pasien klinik (nama / no. HP / no. RM) untuk membuat link yang
  // terhubung ke data pasien -- pasien tidak perlu mengetik identitas.
  useEffect(() => {
    const q = patientName.trim();
    if (!clinicId || selectedPatient || q.length < 2) { setPatientResults([]); return undefined; }
    let cancelled = false;
    const t = setTimeout(async () => {
      const safe = q.replace(/[,()%]/g, ' ');
      const { data } = await supabase
        .from('patients')
        .select('id, full_name, phone, medical_record_number')
        .eq('clinic_id', clinicId)
        .or(`full_name.ilike.%${safe}%,phone.ilike.%${safe}%,medical_record_number.ilike.%${safe}%`)
        .limit(8);
      if (!cancelled) setPatientResults(data || []);
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [patientName, selectedPatient, clinicId]);

  const fetchData = useCallback(async () => {
    if (!clinicId) return;
    setLoading(true);
    const [{ data: linkData }, { data: responseData }] = await Promise.all([
      supabase.from('patient_feedback_links').select('*').eq('clinic_id', clinicId).order('created_at', { ascending: false }),
      supabase.from('patient_feedback_responses').select('*').eq('clinic_id', clinicId).order('created_at', { ascending: false }),
    ]);
    setLinks(linkData || []);
    setResponses(responseData || []);
    const pids = [...new Set((linkData || []).map((l) => l.patient_id).filter(Boolean))];
    if (pids.length) {
      const { data: pts } = await supabase.from('patients').select('id, phone').in('id', pids);
      setPatientPhones(Object.fromEntries((pts || []).map((p) => [p.id, p.phone])));
    }
    setLoading(false);
  }, [clinicId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleGenerateLink = async () => {
    if (!clinicId) return;
    setGenerating(true);
    const token = crypto.randomUUID().replace(/-/g, '');
    const { data, error } = await supabase
      .from('patient_feedback_links')
      .insert([{ clinic_id: clinicId, token, patient_id: selectedPatient?.id || null, patient_name: (selectedPatient?.full_name || patientName).trim() || null }])
      .select()
      .single();
    setGenerating(false);
    if (error) {
      toast({ variant: 'destructive', title: 'Gagal membuat link', description: error.message });
      return;
    }
    setLinks((prev) => [data, ...prev]);
    setPatientName('');
    setSelectedPatient(null);
    const url = buildFeedbackUrl(token, clinicDomain);
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: 'Link feedback dibuat & disalin', description: url });
    } catch {
      toast({ title: 'Link feedback dibuat', description: url });
    }
  };

  const handleCopyLink = async (token) => {
    const url = buildFeedbackUrl(token, clinicDomain);
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
        <Loader2 className="w-8 h-8 animate-spin text-app-accent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Hero Banner */}
      <PageHero image="/hero/clinara-feedback-hero.webp" title="Feedback" highlight="Pasien" description="Kelola link dan ulasan feedback dari pasien." />

      <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-800">Feedback Pasien</h2>
        <p className="text-sm text-slate-500 mt-1">
          {isQuestionnaire
            ? 'Pilih pasien yang sudah terapi, lalu buat link unik. Pasien mengisi kuesioner tanpa mengetik nama/no. HP (identitas terbaca otomatis dari data pasien), lalu langsung diarahkan ke halaman "Tulis Ulasan Google" klinik. Pertanyaan bisa diubah di Setup > ' + (clinicId === KAFFAH_CLINIC_ID ? 'Kuesioner Feedback' : 'Google Review') + '.'
            : 'Buat link unik untuk seorang pasien mengisi feedback. Rating 4-5 bintang otomatis diarahkan ke halaman "Tulis Ulasan Google" klinik; rating rendah hanya tersimpan internal.'}
        </p>
      </div>

      <div className="bg-white p-6 rounded-app border border-slate-200 space-y-3">
        <h3 className="font-semibold text-slate-800 flex items-center gap-2"><Link2 className="w-4 h-4" /> Buat Link Feedback Baru</h3>
        <div className="flex gap-2">
          <div className="relative flex-1">
            {selectedPatient ? (
              <div className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                <span className="truncate">
                  {selectedPatient.full_name}
                  {selectedPatient.phone ? <span className="text-slate-500"> · {selectedPatient.phone}</span> : null}
                </span>
                <button type="button" aria-label="Ganti pasien" onClick={() => { setSelectedPatient(null); setPatientName(''); }}>
                  <X className="w-4 h-4 text-slate-500" />
                </button>
              </div>
            ) : (
              <>
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  className="pl-9"
                  placeholder="Cari pasien (nama / no. HP / no. RM)"
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                />
                {patientResults.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full rounded-md border border-slate-200 bg-white shadow-lg max-h-64 overflow-auto">
                    {patientResults.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50"
                        onClick={() => { setSelectedPatient(p); setPatientResults([]); }}
                      >
                        <span className="font-medium">{p.full_name}</span>
                        <span className="text-slate-500">
                          {p.phone ? ` · ${p.phone}` : ''}{p.medical_record_number ? ` · RM ${p.medical_record_number}` : ''}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
          <Button onClick={handleGenerateLink} disabled={generating} className="bg-app-accent shrink-0">
            {generating && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Buat Link
          </Button>
        </div>
      </div>

      <div className="bg-white p-6 rounded-app border border-slate-200 space-y-3">
        <h3 className="font-semibold text-slate-800">Link Terbaru</h3>
        {links.length === 0 && <p className="text-sm text-slate-500">Belum ada link feedback dibuat.</p>}
        <div className="divide-y divide-slate-100">
          {links.slice(0, 15).map((link) => (
            <div key={link.id} className="py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-800 break-words sm:truncate">{link.patient_name || 'Tanpa nama'}</p>
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

      <div className="bg-white p-6 rounded-app border border-slate-200 space-y-3">
        <h3 className="font-semibold text-slate-800">Feedback Masuk</h3>
        <p className="text-xs text-slate-500">
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
                  {patientPhones[linksById[response.link_id]?.patient_id] && (
                    <p className="text-xs text-slate-500">{patientPhones[linksById[response.link_id].patient_id]}</p>
                  )}
                  <div className="flex items-center gap-0.5 mt-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`w-3.5 h-3.5 ${i < response.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}`}
                      />
                    ))}
                  </div>
                  {(isQuestionnaire || response.rating >= 4) && (
                    response.google_review_clicked_at ? (
                      <Badge className="bg-app-accent/15 text-app-accent-hover hover:bg-app-accent/15 mt-1">Diarahkan ke Google</Badge>
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
              {response.comment && <p className="text-sm text-slate-600 whitespace-pre-line break-words">{response.comment}</p>}
              <p className="text-xs text-slate-500">{formatDateIndonesian(response.created_at)}</p>
            </div>
          ))}
        </div>
      </div>
      </div>
    </div>
  );
};

export default FeedbackManagementContent;
