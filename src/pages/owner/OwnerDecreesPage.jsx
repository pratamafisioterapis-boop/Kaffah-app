import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Loader2, Plus, Trash2, Eye, Download, Save, Send, Undo2, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import PdfPreviewModal from '@/components/shared/PdfPreviewModal';
import { confirmAction } from '@/lib/confirmAction';
import { KAFFAH_CLINIC_ID } from '@/lib/clinicIds';
import {
  getClinicDecrees, upsertClinicDecree, setClinicDecreeStatus, deleteClinicDecree, getCurrentClinic,
} from '@/lib/api';
import { generateDecreePDF, decreeFileName } from '@/lib/decreeGenerator';
import { nextDecreeNumber, soapPolicyDecreeTemplate } from '@/lib/decreeTemplates';

const STATUS_LABEL = { draft: 'Draft', issued: 'Diterbitkan' };
const STATUS_CLASS = {
  draft: 'bg-slate-100 text-slate-600 border border-slate-200',
  issued: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
};

const DEFAULT_SIGNER_NAME = 'Adi Pratama, S.Fis., FTR';
const DEFAULT_SIGNER_POSITION = 'Pimpinan Klinik';

const newForm = (decrees) => {
  const today = new Date();
  return {
    id: null,
    decree_number: nextDecreeNumber(decrees, today),
    decree_date: format(today, 'yyyy-MM-dd'),
    letter_city: 'Balikpapan',
    status: 'draft',
    signer_name: DEFAULT_SIGNER_NAME,
    signer_position: DEFAULT_SIGNER_POSITION,
    ...soapPolicyDecreeTemplate(today),
  };
};

const fromRecord = (r) => ({
  id: r.id,
  decree_number: r.decree_number,
  decree_date: r.decree_date,
  letter_city: r.letter_city,
  status: r.status,
  title: r.title,
  considerations: Array.isArray(r.considerations) ? r.considerations : [],
  decisions: Array.isArray(r.decisions) ? r.decisions : [],
  closing: r.closing || '',
  signer_name: r.signer_name || DEFAULT_SIGNER_NAME,
  signer_position: r.signer_position || DEFAULT_SIGNER_POSITION,
});

const Field = ({ label, children }) => (
  <label className="block space-y-1">
    <span className="text-xs font-medium text-app-muted">{label}</span>
    {children}
  </label>
);

const OwnerDecreesPage = () => {
  const { userDetails } = useAuth();
  const { toast } = useToast();
  const [decrees, setDecrees] = useState([]);
  const [clinic, setClinic] = useState(null);
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);

  const allowed = userDetails?.clinic_id === KAFFAH_CLINIC_ID;

  useEffect(() => {
    if (!allowed) { setLoading(false); return; }
    (async () => {
      const [{ data: c }, { data, error }] = await Promise.all([getCurrentClinic(), getClinicDecrees()]);
      if (error) toast({ variant: 'destructive', title: 'Gagal memuat SK', description: error.message });
      setClinic(c || null);
      setDecrees(data || []);
      setForm(newForm(data || []));
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowed]);

  if (!allowed) return <p className="text-sm text-app-muted">Fitur ini hanya tersedia untuk klinik Kaffah.</p>;
  if (loading || !form) return <div className="flex justify-center py-12"><Loader2 className="animate-spin w-6 h-6 text-app-accent" /></div>;

  const set = (patch) => setForm((p) => ({ ...p, ...patch }));
  const setList = (key, i, value) => set({ [key]: form[key].map((x, idx) => (idx === i ? value : x)) });
  const removeAt = (key, i) => set({ [key]: form[key].filter((_, idx) => idx !== i) });

  const save = async () => {
    if (!form.decree_number.trim() || !form.title.trim()) {
      toast({ variant: 'destructive', title: 'Lengkapi data', description: 'Nomor dan judul SK wajib diisi.' });
      return null;
    }
    setBusy(true);
    const { data, error } = await upsertClinicDecree({ ...form, clinic_id: clinic?.id || userDetails.clinic_id });
    setBusy(false);
    if (error) { toast({ variant: 'destructive', title: 'Gagal menyimpan', description: error.message }); return null; }
    setDecrees((prev) => (prev.some((d) => d.id === data.id) ? prev.map((d) => (d.id === data.id ? data : d)) : [data, ...prev]));
    setForm(fromRecord(data));
    toast({ title: 'SK tersimpan' });
    return data;
  };

  const makePdf = async () => generateDecreePDF({ ...form }, clinic || {});

  const preview = async () => {
    const doc = await makePdf();
    setPreviewUrl(URL.createObjectURL(doc.output('blob')));
  };

  const download = async () => {
    const doc = await makePdf();
    doc.save(decreeFileName(form));
  };

  const toggleIssued = async () => {
    const saved = await save();
    if (!saved) return;
    const next = saved.status === 'issued' ? 'draft' : 'issued';
    if (next === 'issued' && !(await confirmAction('Terbitkan SK ini? Setelah diterbitkan, SK dapat dibaca seluruh staf klinik.'))) return;
    const { data, error } = await setClinicDecreeStatus(saved.id, next);
    if (error) { toast({ variant: 'destructive', title: 'Gagal mengubah status', description: error.message }); return; }
    setDecrees((prev) => prev.map((d) => (d.id === data.id ? data : d)));
    setForm(fromRecord(data));
    toast({ title: next === 'issued' ? 'SK diterbitkan' : 'SK dikembalikan ke draft' });
  };

  const remove = async (d) => {
    if (!(await confirmAction(`Hapus SK ${d.decree_number}?`))) return;
    const { error } = await deleteClinicDecree(d.id);
    if (error) { toast({ variant: 'destructive', title: 'Gagal menghapus', description: error.message }); return; }
    const rest = decrees.filter((x) => x.id !== d.id);
    setDecrees(rest);
    if (form.id === d.id) setForm(newForm(rest));
  };

  return (
    <>
      <Helmet><title>SK Pimpinan - Kaffah System Care</title></Helmet>
      <div className="space-y-5">
        <div>
          <h1 className="text-xl font-bold text-app-ink">SK Pimpinan</h1>
          <p className="text-sm text-app-muted">Susun, terbitkan, dan unduh Surat Keputusan resmi klinik dalam format PDF.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="space-y-2">
            <Button variant="outline" className="w-full" onClick={() => setForm(newForm(decrees))}>
              <Plus className="w-4 h-4 mr-1" /> SK Baru
            </Button>
            {decrees.length === 0 && <p className="text-xs text-app-muted">Belum ada SK tersimpan. Form di samping sudah berisi SK pertama (ketentuan SOAP).</p>}
            {decrees.map((d) => (
              <div key={d.id} className={`rounded-app-sm border p-3 text-sm ${form.id === d.id ? 'border-app-accent bg-app-soft' : 'border-app-border bg-white'}`}>
                <button type="button" className="w-full text-left" onClick={() => setForm(fromRecord(d))}>
                  <div className="flex items-center gap-2"><FileText className="w-4 h-4 shrink-0 text-app-accent" /><span className="font-medium break-words min-w-0">{d.decree_number}</span></div>
                  <p className="text-xs text-app-muted mt-1 break-words">{d.title}</p>
                </button>
                <div className="flex items-center justify-between mt-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_CLASS[d.status]}`}>{STATUS_LABEL[d.status]}</span>
                  <button type="button" onClick={() => remove(d)} className="text-red-500 hover:text-red-700" aria-label="Hapus SK"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
          </div>

          <div className="lg:col-span-2 space-y-4 bg-white border border-app-border rounded-app p-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field label="Nomor SK"><Input value={form.decree_number} onChange={(e) => set({ decree_number: e.target.value })} /></Field>
              <Field label="Tanggal ditetapkan"><Input type="date" value={form.decree_date} onChange={(e) => set({ decree_date: e.target.value })} /></Field>
              <Field label="Kota"><Input value={form.letter_city} onChange={(e) => set({ letter_city: e.target.value })} /></Field>
            </div>
            <Field label="Tentang (judul SK)"><Input value={form.title} onChange={(e) => set({ title: e.target.value })} /></Field>

            <div className="space-y-2">
              <p className="text-sm font-semibold text-app-ink">Menimbang</p>
              {form.considerations.map((c, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <span className="text-sm mt-2 w-5 shrink-0">{String.fromCharCode(97 + i)}.</span>
                  <Textarea rows={3} value={c} onChange={(e) => setList('considerations', i, e.target.value)} />
                  <button type="button" onClick={() => removeAt('considerations', i)} className="mt-2 text-red-500" aria-label="Hapus poin"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => set({ considerations: [...form.considerations, ''] })}><Plus className="w-3.5 h-3.5 mr-1" /> Tambah poin</Button>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-semibold text-app-ink">Memutuskan, menetapkan</p>
              {form.decisions.map((d, i) => (
                <div key={i} className="rounded-app-sm border border-app-border p-3 space-y-2">
                  <div className="flex gap-2">
                    <Input value={d.heading} placeholder="KESATU — Judul" onChange={(e) => setList('decisions', i, { ...d, heading: e.target.value })} />
                    <button type="button" onClick={() => removeAt('decisions', i)} className="text-red-500" aria-label="Hapus diktum"><Trash2 className="w-4 h-4" /></button>
                  </div>
                  <Textarea rows={4} value={d.text} onChange={(e) => setList('decisions', i, { ...d, text: e.target.value })} />
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => set({ decisions: [...form.decisions, { heading: '', text: '' }] })}><Plus className="w-3.5 h-3.5 mr-1" /> Tambah diktum</Button>
            </div>

            <Field label="Kalimat penutup"><Textarea rows={4} value={form.closing} onChange={(e) => set({ closing: e.target.value })} /></Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Nama penandatangan (beserta gelar)"><Input value={form.signer_name} onChange={(e) => set({ signer_name: e.target.value })} /></Field>
              <Field label="Jabatan"><Input value={form.signer_position} onChange={(e) => set({ signer_position: e.target.value })} /></Field>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <Button onClick={save} disabled={busy}>{busy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />} Simpan</Button>
              <Button variant="outline" onClick={preview}><Eye className="w-4 h-4 mr-1" /> Pratinjau PDF</Button>
              <Button variant="outline" onClick={download}><Download className="w-4 h-4 mr-1" /> Unduh PDF</Button>
              <Button variant="outline" onClick={toggleIssued} disabled={busy}>
                {form.status === 'issued' ? <><Undo2 className="w-4 h-4 mr-1" /> Kembalikan ke Draft</> : <><Send className="w-4 h-4 mr-1" /> Terbitkan</>}
              </Button>
            </div>
          </div>
        </div>
      </div>
      <PdfPreviewModal open={!!previewUrl} onClose={() => { URL.revokeObjectURL(previewUrl); setPreviewUrl(null); }} url={previewUrl} title="Pratinjau SK Pimpinan" />
    </>
  );
};

export default OwnerDecreesPage;
