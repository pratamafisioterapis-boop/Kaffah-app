import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Loader2, Link2, Copy, Star, Search, X, MessageCircle, Download } from 'lucide-react';
import { formatDateIndonesian } from '@/lib/dateFormatHelpers';
import { portalBaseUrl, toWhatsAppNumber, patientDisplayName } from '@/lib/patientPortal';
import { QUESTIONNAIRE_CLINIC_IDS, KAFFAH_CLINIC_ID } from '@/lib/clinicIds';
import { DEFAULT_PRAXIS_QUESTIONS, DEFAULT_HOMECARE_QUESTIONS, normalizeQuestions } from '@/lib/praxisQuestionnaire';
import { parseAnswers, buildResponsesCsv, downloadTextFile } from '@/lib/feedbackAnswers';
import PageHero from '@/components/shared/PageHero';

// Always build the shareable link on the clinic's own public domain, never
// on window.location.origin: staff generate these from inside the app
// (clinara.id), and a patient opening a clinara.id link on a phone that
// already has the app installed as a PWA gets the SaaS platform's own
// native splash screen (Clinara logo on white) before anything else loads
// -- confusing branding and a jarring flash for a one-off patient link.
// Domain klinik sendiri (custom domain / subdomain), bukan domain Kaffah.
const buildFeedbackUrl = (token, clinic) => `${portalBaseUrl(clinic)}/feedback/${token}`;


// Sapaan menurut jam di zona waktu klinik (Kaffah = WITA, klinik lain = WIB), bukan jam perangkat staf.
const greetingForClinic = (clinicId, now = new Date()) => {
  const tz = clinicId === KAFFAH_CLINIC_ID ? 'Asia/Makassar' : 'Asia/Jakarta';
  const hour = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hour12: false, timeZone: tz }).format(now)) % 24;
  if (hour >= 4 && hour < 11) return 'pagi';
  if (hour >= 11 && hour < 15) return 'siang';
  if (hour >= 15 && hour < 18) return 'sore';
  return 'malam';
};

// Pengiriman manual lewat wa.me (klinik tanpa template Meta). Teks bebas, jadi tidak ada biaya template.
const buildFeedbackWhatsAppLink = ({ phone, name, url, clinicName, clinicId }) => {
  const clinic = clinicName || 'klinik kami';
  const text = [
    `Selamat ${greetingForClinic(clinicId)} ${name} 🙏`,
    '',
    'Agar layanan kami terus lebih baik, mohon bantu isi kuesioner kepuasan singkat (± 2 menit) tentang terapi hari ini.',
    '',
    'Masukan Anda sangat berarti bagi kami.',
    '',
    `🔗 ${url}`,
    '',
    'Salam Sehat,',
    `*${clinic}*`,
  ].join('\n');
  // api.whatsapp.com/send (bukan wa.me): wa.me mengalihkan ke alamat ini dan emoji bisa rusak di WhatsApp Desktop.
  return `https://api.whatsapp.com/send?phone=${toWhatsAppNumber(phone)}&text=${encodeURIComponent(text)}`;
};

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
  const [patientInfo, setPatientInfo] = useState({});
  const [clinicDomain, setClinicDomain] = useState(null);
  const [questions, setQuestions] = useState(DEFAULT_PRAXIS_QUESTIONS);
  const [homecareQuestions, setHomecareQuestions] = useState(DEFAULT_HOMECARE_QUESTIONS);
  const [newIsHomecare, setNewIsHomecare] = useState(false);

  useEffect(() => {
    if (!clinicId) return;
    supabase.from('clinics').select('id, subdomain, custom_domain, custom_domain_status, feedback_questionnaire, feedback_questionnaire_homecare')
      .eq('id', clinicId).maybeSingle().then(({ data }) => {
        setClinicDomain(data || null);
        setQuestions(normalizeQuestions(data?.feedback_questionnaire) || DEFAULT_PRAXIS_QUESTIONS);
        setHomecareQuestions(normalizeQuestions(data?.feedback_questionnaire_homecare) || DEFAULT_HOMECARE_QUESTIONS);
      });
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
      const { data: pts } = await supabase.from('patients').select('id, phone, nickname, full_name, medical_record_number').in('id', pids);
      setPatientInfo(Object.fromEntries((pts || []).map((p) => [p.id, p])));
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
      .insert([{ clinic_id: clinicId, token, patient_id: selectedPatient?.id || null, patient_name: (selectedPatient?.full_name || patientName).trim() || null, is_homecare: newIsHomecare }])
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
    setNewIsHomecare(false);
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

  // Satu baris per respons: identitas pasien + jawaban terstruktur (atau teks mentah bila tidak cocok).
  const responseRows = useMemo(() => responses.map((r) => {
    const link = linksById[r.link_id];
    const pt = patientInfo[link?.patient_id];
    const parsed = isQuestionnaire ? parseAnswers(r.comment, link?.is_homecare ? homecareQuestions : questions, clinicName) : { items: [], matched: false };
    return {
      response: r,
      name: r.patient_name || link?.patient_name || pt?.full_name || 'Anonim',
      fullName: pt?.full_name || '',
      nickname: pt?.nickname || '',
      phone: pt?.phone || '',
      rm: pt?.medical_record_number || '',
      parsed,
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [responses, links, patientInfo, questions, homecareQuestions, clinicName, isQuestionnaire]);

  const avgRating = responses.length
    ? (responses.reduce((sum, r) => sum + (Number(r.rating) || 0), 0) / responses.length).toFixed(1)
    : null;

  const handleExportCsv = () => {
    const csv = buildResponsesCsv(
      responseRows.map((row) => ({
        date: new Date(row.response.created_at).toLocaleString('id-ID'),
        name: row.fullName || row.name,
        nickname: row.nickname,
        phone: row.phone,
        rm: row.rm,
        rating: row.response.rating,
        answers: Object.fromEntries(row.parsed.items.map((i) => [i.id, i.answer])),
        raw: row.response.comment || '',
      })),
      [...questions, ...homecareQuestions.filter((h) => !questions.some((q) => q.id === h.id))],
      clinicName,
    );
    downloadTextFile(`feedback-pasien-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  };

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

      <div className="bg-white p-4 sm:p-6 rounded-app border border-slate-200 space-y-3">
        <h3 className="font-semibold text-slate-800 flex items-center gap-2"><Link2 className="w-4 h-4" /> Buat Link Feedback Baru</h3>
        <div className="flex flex-col sm:flex-row gap-2">
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
          <label className="flex items-center gap-2 text-sm text-slate-700 sm:shrink-0">
            <Switch checked={newIsHomecare} onCheckedChange={setNewIsHomecare} /> Homecare
          </label>
          <Button onClick={handleGenerateLink} disabled={generating} className="bg-app-accent sm:shrink-0 w-full sm:w-auto">
            {generating && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Buat Link
          </Button>
        </div>
      </div>

      <div className="bg-white p-4 sm:p-6 rounded-app border border-slate-200 space-y-3">
        <h3 className="font-semibold text-slate-800">Link Terbaru</h3>
        {links.length === 0 && <p className="text-sm text-slate-500">Belum ada link feedback dibuat.</p>}
        <div className="divide-y divide-slate-100">
          {links.slice(0, 15).map((link) => (
            <div key={link.id} className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-800 break-words">{link.patient_name || 'Tanpa nama'}</p>
                <p className="text-xs text-slate-500">{formatDateIndonesian(link.created_at)}{link.is_homecare ? ' · Homecare' : ''}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                {link.responded_at ? (
                  <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Sudah diisi</Badge>
                ) : (
                  <Badge variant="outline">Menunggu</Badge>
                )}
                {!link.responded_at && patientInfo[link.patient_id]?.phone && (
                  <Button size="sm" variant="outline" asChild>
                    <a
                      href={buildFeedbackWhatsAppLink({
                        phone: patientInfo[link.patient_id].phone,
                        name: patientDisplayName(patientInfo[link.patient_id]) || link.patient_name || 'Kak',
                        url: buildFeedbackUrl(link.token, clinicDomain),
                        clinicName,
                        clinicId,
                      })}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <MessageCircle className="w-3.5 h-3.5 mr-1.5" /> Kirim WA
                    </a>
                  </Button>
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
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold text-slate-800">Feedback Masuk</h3>
            {responses.length > 0 && (
              <p className="text-xs text-slate-500 mt-0.5">
                {responses.length} respons{avgRating ? ` · rata-rata rating ${avgRating}/5` : ''}
              </p>
            )}
          </div>
          {responses.length > 0 && (
            <Button size="sm" variant="outline" onClick={handleExportCsv} className="shrink-0">
              <Download className="w-3.5 h-3.5 mr-1.5" /> Ekspor CSV
            </Button>
          )}
        </div>
        {clinicId !== KAFFAH_CLINIC_ID && (
        <p className="text-xs text-slate-500">
          Badge "Diarahkan ke Google" berarti pasien klik tombol menuju halaman Google Review -- Google tidak
          menyediakan cara untuk memastikan review-nya benar-benar terkirim di sana.
        </p>
        )}
        {responses.length === 0 && <p className="text-sm text-slate-500">Belum ada feedback masuk.</p>}
        <div className="divide-y divide-slate-100">
          {responseRows.map((row) => {
            const { response, parsed } = row;
            return (
            <div key={response.id} className="py-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800 break-words">{row.fullName || row.name}</p>
                  <p className="text-xs text-slate-500 break-words">
                    {[row.nickname && `Panggilan: ${row.nickname}`, row.phone, row.rm && `RM ${row.rm}`].filter(Boolean).join(' · ') || 'Identitas pasien tidak tertaut'}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <div className="flex items-center gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={`w-3.5 h-3.5 ${i < response.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}`}
                        />
                      ))}
                    </div>
                    <span className="text-xs text-slate-500">{formatDateIndonesian(response.created_at)}</span>
                  </div>
                  {clinicId !== KAFFAH_CLINIC_ID && (isQuestionnaire || response.rating >= 4) && (
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
              {parsed.matched ? (
                <dl className="rounded-md border border-slate-100 bg-slate-50/60 divide-y divide-slate-100">
                  {parsed.items.map((item) => (
                    <div key={item.id} className="px-3 py-2 sm:grid sm:grid-cols-5 sm:gap-3">
                      <dt className="text-xs text-slate-500 sm:col-span-3 break-words">{item.label}</dt>
                      <dd className="text-sm font-medium text-slate-800 sm:col-span-2 whitespace-pre-line break-words">{item.answer || '-'}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                response.comment && <p className="text-sm text-slate-600 whitespace-pre-line break-words">{response.comment}</p>
              )}
            </div>
            );
          })}
        </div>
      </div>
      </div>
    </div>
  );
};

export default FeedbackManagementContent;
