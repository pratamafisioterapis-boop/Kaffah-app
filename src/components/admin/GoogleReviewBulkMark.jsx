import React, { useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Loader2, Star } from 'lucide-react';

// Tandai massal pasien LAMA yang sudah mengisi Google Review. Tempel daftar nomor HP dan/atau nama
// lengkap (satu per baris), cocokkan dengan data pasien, cek hasilnya, lalu simpan sebagai "reviewed".
const digits = (v) => {
  let d = String(v || '').replace(/\D/g, '');
  if (d.startsWith('62')) d = d.slice(2);
  else if (d.startsWith('0')) d = d.slice(1);
  return d;
};
const norm = (v) => String(v || '').toLowerCase().replace(/\s+/g, ' ').trim();

const GoogleReviewBulkMark = () => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null); // { matched: [], unmatched: [], ambiguous: [] }

  const reset = () => { setText(''); setResult(null); };

  const fetchAllPatients = async () => {
    const all = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase
        .from('patients')
        .select('id, full_name, nickname, phone, google_review_status')
        .order('id')
        .range(from, from + 999);
      if (error) throw error;
      all.push(...(data || []));
      if (!data || data.length < 1000) break;
    }
    return all;
  };

  const handleMatch = async () => {
    const lines = [...new Set(text.split('\n').map((l) => l.trim()).filter(Boolean))];
    if (!lines.length) return;
    setBusy(true);
    try {
      const patients = await fetchAllPatients();
      const byPhone = new Map();
      const byName = new Map();
      for (const p of patients) {
        const d = digits(p.phone);
        if (d) byPhone.set(d, [...(byPhone.get(d) || []), p]);
        const n = norm(p.full_name);
        if (n) byName.set(n, [...(byName.get(n) || []), p]);
      }
      const matched = new Map();
      const unmatched = [];
      const ambiguous = [];
      for (const line of lines) {
        const isPhone = /^[\d+\s-]{8,}$/.test(line);
        const hits = isPhone ? (byPhone.get(digits(line)) || []) : (byName.get(norm(line)) || []);
        if (hits.length === 0) unmatched.push(line);
        else if (!isPhone && hits.length > 1) ambiguous.push(line); // nama kembar: jangan menebak
        else hits.forEach((p) => matched.set(p.id, p)); // satu nomor bisa milik beberapa pasien (keluarga): semua ditandai
      }
      setResult({ matched: [...matched.values()], unmatched, ambiguous });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Gagal mencocokkan data', description: e.message });
    } finally {
      setBusy(false);
    }
  };

  const handleSave = async () => {
    const ids = result.matched.map((p) => p.id);
    if (!ids.length) return;
    setBusy(true);
    const now = new Date().toISOString();
    let failed = null;
    for (let i = 0; i < ids.length; i += 200) {
      const { error } = await supabase.from('patients')
        .update({ google_review_status: 'reviewed', google_review_marked_at: now })
        .in('id', ids.slice(i, i + 200));
      if (error) { failed = error; break; }
    }
    setBusy(false);
    if (failed) {
      toast({ variant: 'destructive', title: 'Gagal menyimpan', description: failed.message });
      return;
    }
    toast({ title: `${ids.length} pasien ditandai sudah review` });
    setOpen(false);
    reset();
  };

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Star className="w-4 h-4 mr-2" />
        Tandai Sudah Review Google
      </Button>
      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Tandai pasien yang sudah review Google</DialogTitle>
            <DialogDescription>
              Tempel nomor HP atau nama lengkap pasien (satu per baris). AI tidak akan mengirim link review ke pasien yang ditandai.
            </DialogDescription>
          </DialogHeader>
          {!result ? (
            <div className="space-y-3">
              <Textarea rows={10} value={text} onChange={(e) => setText(e.target.value)} placeholder={'0812xxxxxxx\nDyah Ayu Lestari\n62857xxxxxxx'} />
              <Button onClick={handleMatch} disabled={busy || !text.trim()} className="w-full">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Cocokkan dengan data pasien'}
              </Button>
            </div>
          ) : (
            <div className="space-y-3 text-sm">
              <p className="font-medium text-green-700">{result.matched.length} pasien cocok dan akan ditandai:</p>
              <ul className="max-h-40 overflow-auto rounded border border-slate-200 p-2 text-xs text-slate-700 space-y-0.5">
                {result.matched.map((p) => (
                  <li key={p.id}>{p.full_name}{p.google_review_status === 'reviewed' ? ' (sudah ditandai)' : ''}</li>
                ))}
              </ul>
              {result.ambiguous.length > 0 && (
                <p className="text-amber-700 text-xs">Dilewati karena ada beberapa pasien bernama sama (pakai nomor HP): {result.ambiguous.join(', ')}</p>
              )}
              {result.unmatched.length > 0 && (
                <p className="text-red-600 text-xs">Tidak ditemukan: {result.unmatched.join(', ')}</p>
              )}
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setResult(null)} disabled={busy} className="flex-1">Kembali</Button>
                <Button onClick={handleSave} disabled={busy || !result.matched.length} className="flex-1">
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Simpan'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default GoogleReviewBulkMark;
