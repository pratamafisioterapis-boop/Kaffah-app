import React, { useState, useEffect, useCallback } from 'react';
import { BookOpen, Upload, Trash2, Loader2, CheckCircle2, XCircle, Clock, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { getJournalDocuments, uploadJournalDocument, deleteJournalDocument } from '@/lib/api';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

const STATUS_META = {
  processing: { label: 'Memproses', icon: Clock, className: 'bg-amber-100 text-amber-700 border-amber-200' },
  ready: { label: 'Siap Dipakai', icon: CheckCircle2, className: 'bg-green-100 text-green-700 border-green-200' },
  failed: { label: 'Gagal', icon: XCircle, className: 'bg-red-100 text-red-700 border-red-200' },
};

const emptyForm = { title: '', author: '', publication_year: '', source_language: 'en', topic_tags: '' };

const JournalKnowledgeBaseManager = () => {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const { toast } = useToast();

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    const { data } = await getJournalDocuments();
    setDocuments(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadDocuments(); }, [loadDocuments]);

  // Dokumen yang masih 'processing' dipoll ringan supaya statusnya update
  // otomatis begitu ingestion di edge function selesai, tanpa perlu refresh manual.
  useEffect(() => {
    if (!documents.some(d => d.status === 'processing')) return;
    const interval = setInterval(loadDocuments, 5000);
    return () => clearInterval(interval);
  }, [documents, loadDocuments]);

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    if (selected.type !== 'application/pdf') {
      toast({ variant: 'destructive', title: 'Format Tidak Didukung', description: 'Hanya file PDF yang diperbolehkan.' });
      return;
    }
    setFile(selected);
    if (!form.title) {
      setForm(prev => ({ ...prev, title: selected.name.replace(/\.pdf$/i, '') }));
    }
  };

  const handleUpload = async () => {
    if (!file) {
      toast({ variant: 'destructive', title: 'File Belum Dipilih', description: 'Pilih file PDF jurnal/ebook terlebih dahulu.' });
      return;
    }
    if (!form.title.trim()) {
      toast({ variant: 'destructive', title: 'Judul Wajib Diisi', description: 'Isi judul jurnal/ebook.' });
      return;
    }

    setUploading(true);
    const { success, error, data } = await uploadJournalDocument(file, {
      title: form.title.trim(),
      author: form.author.trim() || null,
      publication_year: form.publication_year ? Number(form.publication_year) : null,
      source_language: form.source_language,
      topic_tags: form.topic_tags.split(',').map(t => t.trim()).filter(Boolean),
    });
    setUploading(false);

    if (success) {
      toast({
        title: 'Upload Berhasil',
        description: `"${data?.title}" sedang diproses. Ini bisa memakan waktu beberapa menit tergantung ketebalan dokumen.`,
      });
      setFile(null);
      setForm(emptyForm);
      loadDocuments();
    } else {
      toast({ variant: 'destructive', title: 'Upload Gagal', description: error?.message || 'Terjadi kesalahan saat mengunggah dokumen.' });
    }
  };

  const handleDelete = async (doc) => {
    if (!window.confirm(`Hapus "${doc.title}" dari basis pengetahuan? Saran AI tidak akan lagi memakai referensi ini.`)) return;
    const { success, error } = await deleteJournalDocument(doc.id, doc.file_path);
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
            Upload Jurnal / Ebook Fisioterapi
          </CardTitle>
          <p className="text-sm text-slate-500">
            Dokumen ini jadi sumber referensi fitur "Saran Klinis AI" di form SOAP terapis. Boleh berbahasa Indonesia atau Inggris —
            saran ke terapis akan tetap ditampilkan dalam Bahasa Indonesia.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>File PDF</Label>
              <Input type="file" accept="application/pdf" onChange={handleFileChange} disabled={uploading} />
            </div>
            <div className="space-y-2">
              <Label>Bahasa Sumber</Label>
              <Select value={form.source_language} onValueChange={(v) => setForm(prev => ({ ...prev, source_language: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="id">Bahasa Indonesia</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Judul</Label>
              <Input value={form.title} onChange={(e) => setForm(prev => ({ ...prev, title: e.target.value }))} placeholder="Judul jurnal/ebook" disabled={uploading} />
            </div>
            <div className="space-y-2">
              <Label>Penulis</Label>
              <Input value={form.author} onChange={(e) => setForm(prev => ({ ...prev, author: e.target.value }))} placeholder="Nama penulis (opsional)" disabled={uploading} />
            </div>
            <div className="space-y-2">
              <Label>Tahun Terbit</Label>
              <Input type="number" value={form.publication_year} onChange={(e) => setForm(prev => ({ ...prev, publication_year: e.target.value }))} placeholder="mis. 2023" disabled={uploading} />
            </div>
            <div className="space-y-2">
              <Label>Topik/Kondisi Terkait</Label>
              <Input value={form.topic_tags} onChange={(e) => setForm(prev => ({ ...prev, topic_tags: e.target.value }))} placeholder="mis. low back pain, stroke rehab" disabled={uploading} />
            </div>
          </div>
          <Button onClick={handleUpload} disabled={uploading} className="bg-blue-600 hover:bg-blue-700">
            {uploading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Mengunggah...</> : <><Upload className="w-4 h-4 mr-2" /> Upload & Proses</>}
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
            <p className="text-sm text-slate-500 text-center py-8">Belum ada dokumen. Upload jurnal/ebook pertama di atas.</p>
          ) : (
            <div className="space-y-3">
              {documents.map((doc) => {
                const meta = STATUS_META[doc.status] || STATUS_META.processing;
                const StatusIcon = meta.icon;
                return (
                  <div key={doc.id} className="flex items-start justify-between gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50/60">
                    <div className="flex items-start gap-3 min-w-0">
                      <FileText className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="font-medium text-slate-900 truncate">{doc.title}</p>
                        <p className="text-xs text-slate-500">
                          {doc.author ? `${doc.author} · ` : ''}{doc.publication_year || ''} · {doc.source_language === 'id' ? 'Indonesia' : 'English'}
                          {doc.page_count ? ` · ${doc.page_count} hal.` : ''}
                        </p>
                        {doc.topic_tags?.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {doc.topic_tags.map((tag) => (
                              <Badge key={tag} variant="outline" className="text-[10px] font-normal">{tag}</Badge>
                            ))}
                          </div>
                        )}
                        {doc.status === 'failed' && doc.error_message && (
                          <p className="text-xs text-red-600 mt-1">{doc.error_message}</p>
                        )}
                        <p className="text-[11px] text-slate-400 mt-1">
                          Diunggah {format(new Date(doc.created_at), 'dd MMM yyyy, HH:mm', { locale: idLocale })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge className={`gap-1 ${meta.className}`}>
                        <StatusIcon className="w-3 h-3" /> {meta.label}
                      </Badge>
                      <Button variant="ghost" size="icon" className="text-red-500 hover:bg-red-50" onClick={() => handleDelete(doc)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default JournalKnowledgeBaseManager;
