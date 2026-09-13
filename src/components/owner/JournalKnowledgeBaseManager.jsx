import React, { useState, useEffect, useCallback, useRef } from 'react';
import { BookOpen, Save, Trash2, Loader2, CheckCircle2, FileText, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { getJournalDocuments, createJournalDocument, deleteJournalDocument, updateJournalDocumentScope } from '@/lib/api';
import { detectJournalLanguage } from '@/lib/utils';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

const emptyForm = { title: '', author: '', publication_year: '', source_language: 'en', topic_tags: '', content: '', document_scope: 'both' };

const SCOPE_LABELS = {
  assessment: { label: 'Assessment', className: 'bg-violet-100 text-violet-700 border-violet-200' },
  tindakan: { label: 'Tindakan', className: 'bg-blue-100 text-blue-700 border-blue-200' },
  both: { label: 'Assessment & Tindakan', className: 'bg-slate-100 text-slate-700 border-slate-200' },
};

const JournalKnowledgeBaseManager = () => {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [updatingScopeId, setUpdatingScopeId] = useState(null);
  const [languageAutoDetected, setLanguageAutoDetected] = useState(false);
  const languageManuallySet = useRef(false);
  const { toast } = useToast();

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    const { data } = await getJournalDocuments();
    setDocuments(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadDocuments(); }, [loadDocuments]);

  // Auto-deteksi Bahasa Sumber dari isi yang ditempel owner, supaya tidak
  // perlu dipilih manual — tapi kalau owner sudah pernah ganti dropdownnya
  // sendiri untuk draft yang sedang diisi, jangan ditimpa lagi.
  useEffect(() => {
    if (languageManuallySet.current) return;
    const handle = setTimeout(() => {
      const detected = detectJournalLanguage(form.content);
      if (detected) {
        setForm(prev => (prev.source_language === detected ? prev : { ...prev, source_language: detected }));
        setLanguageAutoDetected(true);
      } else {
        setLanguageAutoDetected(false);
      }
    }, 400);
    return () => clearTimeout(handle);
  }, [form.content]);

  const handleSave = async () => {
    if (!form.title.trim()) {
      toast({ variant: 'destructive', title: 'Judul Wajib Diisi', description: 'Isi judul jurnal/ebook.' });
      return;
    }
    if (!form.content.trim()) {
      toast({ variant: 'destructive', title: 'Isi Jurnal Kosong', description: 'Tempel isi jurnal/ebook-nya di kolom teks.' });
      return;
    }

    setSaving(true);
    const { success, error, data } = await createJournalDocument(form.content, {
      title: form.title.trim(),
      author: form.author.trim() || null,
      publication_year: form.publication_year ? Number(form.publication_year) : null,
      source_language: form.source_language,
      topic_tags: form.topic_tags.split(',').map(t => t.trim()).filter(Boolean),
      document_scope: form.document_scope,
    });
    setSaving(false);

    if (success) {
      toast({ title: 'Tersimpan', description: `"${data?.title}" langsung siap dipakai fitur Saran Klinis AI.` });
      setForm(emptyForm);
      languageManuallySet.current = false;
      setLanguageAutoDetected(false);
      loadDocuments();
    } else {
      toast({ variant: 'destructive', title: 'Gagal Menyimpan', description: error?.message || 'Terjadi kesalahan saat menyimpan.' });
    }
  };

  const handleScopeChange = async (doc, newScope) => {
    if (newScope === doc.document_scope) return;
    setUpdatingScopeId(doc.id);
    const { success, error } = await updateJournalDocumentScope(doc.id, newScope);
    setUpdatingScopeId(null);
    if (success) {
      setDocuments(prev => prev.map(d => d.id === doc.id ? { ...d, document_scope: newScope } : d));
      toast({ title: 'Peruntukan Diperbarui', description: `"${doc.title}" sekarang: ${SCOPE_LABELS[newScope]?.label}.` });
    } else {
      toast({ variant: 'destructive', title: 'Gagal Memperbarui', description: error?.message });
    }
  };

  const handleDelete = async (doc) => {
    if (!window.confirm(`Hapus "${doc.title}" dari basis pengetahuan? Saran AI tidak akan lagi memakai referensi ini.`)) return;
    const { success, error } = await deleteJournalDocument(doc.id);
    if (success) {
      toast({ title: 'Dokumen Dihapus' });
      loadDocuments();
    } else {
      toast({ variant: 'destructive', title: 'Gagal Menghapus', description: error?.message });
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-slate-200 shadow-sm rounded-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <BookOpen className="w-5 h-5 text-blue-600" />
            Tambah Jurnal / Ebook Fisioterapi
          </CardTitle>
          <p className="text-sm text-slate-500">
            Copy-paste isi jurnal/ebook di bawah — jadi sumber referensi fitur "Saran Klinis AI" (tindakan) dan/atau "Saran Assessment AI"
            (diagnosa & pemeriksaan) di form SOAP terapis, tergantung peruntukan yang dipilih. Boleh berbahasa Indonesia atau Inggris, saran
            ke terapis akan tetap ditampilkan dalam Bahasa Indonesia. Tidak perlu upload file.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Judul</Label>
              <Input value={form.title} onChange={(e) => setForm(prev => ({ ...prev, title: e.target.value }))} placeholder="Judul jurnal/ebook" disabled={saving} />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                Bahasa Sumber
                {languageAutoDetected && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-normal text-blue-600">
                    <Sparkles className="w-3 h-3" /> Terdeteksi otomatis
                  </span>
                )}
              </Label>
              <Select
                value={form.source_language}
                onValueChange={(v) => {
                  languageManuallySet.current = true;
                  setLanguageAutoDetected(false);
                  setForm(prev => ({ ...prev, source_language: v }));
                }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="id">Bahasa Indonesia</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-400">Otomatis terdeteksi dari isi jurnal yang ditempel — bisa diubah manual kalau salah.</p>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Peruntukan</Label>
              <Select value={form.document_scope} onValueChange={(v) => setForm(prev => ({ ...prev, document_scope: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="assessment">Assessment (bantu diagnosa & pemeriksaan)</SelectItem>
                  <SelectItem value="tindakan">Tindakan (saran intervensi & latihan)</SelectItem>
                  <SelectItem value="both">Keduanya</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-400">Menentukan fitur AI mana yang boleh memakai dokumen ini sebagai referensi.</p>
            </div>
            <div className="space-y-2">
              <Label>Penulis</Label>
              <Input value={form.author} onChange={(e) => setForm(prev => ({ ...prev, author: e.target.value }))} placeholder="Nama penulis (opsional)" disabled={saving} />
            </div>
            <div className="space-y-2">
              <Label>Tahun Terbit</Label>
              <Input type="number" value={form.publication_year} onChange={(e) => setForm(prev => ({ ...prev, publication_year: e.target.value }))} placeholder="mis. 2023" disabled={saving} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Topik/Kondisi Terkait</Label>
              <Input value={form.topic_tags} onChange={(e) => setForm(prev => ({ ...prev, topic_tags: e.target.value }))} placeholder="mis. low back pain, stroke rehab" disabled={saving} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Isi Jurnal/Ebook</Label>
              <Textarea
                value={form.content}
                onChange={(e) => setForm(prev => ({ ...prev, content: e.target.value }))}
                placeholder="Tempel (paste) isi teks jurnal/ebook di sini..."
                className="min-h-[240px]"
                disabled={saving}
              />
              <p className="text-xs text-slate-400">{form.content.length.toLocaleString('id-ID')} karakter</p>
            </div>
          </div>
          <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
            {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Menyimpan...</> : <><Save className="w-4 h-4 mr-2" /> Simpan</>}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm rounded-2xl">
        <CardHeader>
          <CardTitle className="text-lg">Dokumen Referensi ({documents.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="animate-spin text-blue-600" /></div>
          ) : documents.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-8">Belum ada dokumen. Tambahkan jurnal/ebook pertama di atas.</p>
          ) : (
            <div className="space-y-3">
              {documents.map((doc) => (
                <div key={doc.id} className="flex items-start justify-between gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50/60">
                  <div className="flex items-start gap-3 min-w-0">
                    <FileText className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900 truncate">{doc.title}</p>
                      <p className="text-xs text-slate-500">
                        {doc.author ? `${doc.author} · ` : ''}{doc.publication_year || ''} · {doc.source_language === 'id' ? 'Indonesia' : 'English'}
                      </p>
                      <Select
                        value={doc.document_scope}
                        onValueChange={(v) => handleScopeChange(doc, v)}
                        disabled={updatingScopeId === doc.id}
                      >
                        <SelectTrigger
                          className={`h-6 w-fit gap-1 mt-1.5 border text-[10px] font-normal px-2 ${SCOPE_LABELS[doc.document_scope]?.className || SCOPE_LABELS.both.className}`}
                        >
                          {updatingScopeId === doc.id ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="assessment">Assessment</SelectItem>
                          <SelectItem value="tindakan">Tindakan</SelectItem>
                          <SelectItem value="both">Assessment & Tindakan</SelectItem>
                        </SelectContent>
                      </Select>
                      {doc.topic_tags?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {doc.topic_tags.map((tag) => (
                            <Badge key={tag} variant="outline" className="text-[10px] font-normal">{tag}</Badge>
                          ))}
                        </div>
                      )}
                      <p className="text-[11px] text-slate-400 mt-1">
                        Ditambahkan {format(new Date(doc.created_at), 'dd MMM yyyy, HH:mm', { locale: idLocale })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge className="gap-1 bg-green-100 text-green-700 border-green-200">
                      <CheckCircle2 className="w-3 h-3" /> Siap Dipakai
                    </Badge>
                    <Button variant="ghost" size="icon" className="text-red-500 hover:bg-red-50" onClick={() => handleDelete(doc)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default JournalKnowledgeBaseManager;
