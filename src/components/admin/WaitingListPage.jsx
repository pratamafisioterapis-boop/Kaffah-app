import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import PageHero from '@/components/shared/PageHero';
import { confirmAction } from '@/lib/confirmAction';
import {
  Loader2, MessageCircle, CheckCircle2, Plus, Trash2, Clock, CalendarDays, User, Sparkles, XCircle,
} from 'lucide-react';

// Rentang jam untuk label waktu (jam mulai slot, WITA). Akhir dibuat inklusif.
const LABEL_RANGES = {
  pagi: ['09:00', '11:59'],
  siang: ['12:00', '14:59'],
  sore: ['15:00', '17:59'],
  malam: ['18:00', '21:00'],
};
const LABEL_TEXT = { pagi: 'Pagi', siang: 'Siang', sore: 'Sore', malam: 'Malam', bebas: 'Jam bebas' };
const GENDER_TEXT = { female: 'Terapis wanita', male: 'Terapis pria', any: 'Terapis bebas' };
const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

const todayWita = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Makassar' });
const nowMinutesWita = () => {
  const [h, m] = new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Makassar', hour: '2-digit', minute: '2-digit' }).split(':').map(Number);
  return h * 60 + m;
};
const addDays = (iso, n) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const dateText = (iso) => {
  if (!iso) return 'Tanggal bebas';
  const d = new Date(`${iso}T00:00:00Z`);
  return `${DAYS[d.getUTCDay()]}, ${d.getUTCDate()}/${d.getUTCMonth() + 1}/${d.getUTCFullYear()}`;
};
const hhmm = (t) => (t ? String(t).slice(0, 5) : null);

const timeText = (item) => {
  const from = hhmm(item.time_from);
  const to = hhmm(item.time_to);
  if (from && to) return `Jam ${from} - ${to}`;
  if (from) return `Di atas jam ${from}`;
  if (to) return `Sebelum jam ${to}`;
  return LABEL_TEXT[item.time_label] || 'Jam bebas';
};

const waPhone = (phone) => {
  let p = String(phone || '').replace(/\D/g, '');
  if (p.startsWith('0')) p = `62${p.slice(1)}`;
  else if (p && !p.startsWith('62')) p = `62${p}`;
  return p;
};

function slotMatches(slot, item, therapistsById, dateIso) {
  if (slot.status !== 'aktif') return false;
  const therapist = therapistsById[slot.therapist_id];
  if (!therapist) return false;
  if (item.therapist_gender !== 'any' && therapist.gender !== item.therapist_gender) return false;
  const start = hhmm(slot.slot_start);
  let from = hhmm(item.time_from);
  let to = hhmm(item.time_to);
  if (!from && !to && LABEL_RANGES[item.time_label]) [from, to] = LABEL_RANGES[item.time_label];
  if (from && start < from) return false;
  if (to && start > to) return false;
  if (dateIso === todayWita()) {
    const [h, m] = start.split(':').map(Number);
    if (h * 60 + m < nowMinutesWita() + 30) return false;
  }
  return true;
}

const emptyForm = {
  patient_name: '', phone: '', preferred_date: '', time_from: '', time_to: '',
  time_label: 'bebas', therapist_gender: 'any', notes: '',
};

const WaitingListPage = () => {
  const { userDetails } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('waiting');
  const [therapists, setTherapists] = useState([]);
  const [slotsByDate, setSlotsByDate] = useState({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const fetchItems = useCallback(async () => {
    const { data, error } = await supabase
      .from('waiting_list')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(300);
    if (error) {
      toast({ variant: 'destructive', title: 'Gagal memuat waiting list', description: error.message });
    } else {
      setItems(data || []);
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    fetchItems();
    supabase.from('physiotherapists').select('id, name, gender').eq('is_active', true)
      .then(({ data }) => setTherapists(data || []));
  }, [fetchItems]);

  const therapistsById = useMemo(
    () => Object.fromEntries(therapists.map((t) => [t.id, t])),
    [therapists],
  );

  // Tanggal yang perlu dicek slot kosongnya: tanggal yang diminta (belum lewat) atau 3 hari ke depan.
  const datesToCheck = useMemo(() => {
    const today = todayWita();
    const set = new Set();
    items.filter((i) => i.status === 'waiting').forEach((i) => {
      if (i.preferred_date) {
        if (i.preferred_date >= today) set.add(i.preferred_date);
      } else {
        [0, 1, 2].forEach((n) => set.add(addDays(today, n)));
      }
    });
    return [...set].sort();
  }, [items]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next = {};
      for (const d of datesToCheck) {
        const { data } = await supabase.rpc('get_available_slots_with_status_by_date', { p_date: d });
        next[d] = data || [];
      }
      if (!cancelled) setSlotsByDate(next);
    })();
    return () => { cancelled = true; };
  }, [datesToCheck]);

  const matchesFor = useCallback((item) => {
    if (item.status !== 'waiting') return [];
    const today = todayWita();
    const dates = item.preferred_date
      ? (item.preferred_date >= today ? [item.preferred_date] : [])
      : [0, 1, 2].map((n) => addDays(today, n));
    const out = [];
    dates.forEach((d) => {
      (slotsByDate[d] || []).forEach((s) => {
        if (slotMatches(s, item, therapistsById, d)) {
          out.push({ date: d, time: hhmm(s.slot_start), therapist: therapistsById[s.therapist_id]?.name || '' });
        }
      });
    });
    return out.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  }, [slotsByDate, therapistsById]);

  const update = async (id, patch, okMsg) => {
    const { error } = await supabase.from('waiting_list').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) {
      toast({ variant: 'destructive', title: 'Gagal', description: error.message });
      return false;
    }
    if (okMsg) toast({ title: okMsg });
    await fetchItems();
    return true;
  };

  const contactViaWa = async (item) => {
    const matches = matchesFor(item);
    const first = matches[0];
    const hari = first
      ? (first.date === todayWita() ? 'hari ini' : dateText(first.date))
      : (item.preferred_date ? dateText(item.preferred_date) : 'hari ini');
    const slotLine = first
      ? `kami ingin menginformasikan kalau ${hari} ada pasien yang cancel di jam ${first.time}${first.therapist ? ` dengan ${first.therapist}` : ''}`
      : `kami ingin menginformasikan kalau ${hari} ada pasien yang cancel`;
    const text = `Halo kak ${item.patient_name}, ${slotLine}, apakah berkenan kami jadwalkan? 🙏`;
    window.open(`https://api.whatsapp.com/send?phone=${waPhone(item.phone)}&text=${encodeURIComponent(text)}`, '_blank');
    await update(item.id, { status: 'notified', notified_at: new Date().toISOString() }, 'Ditandai sudah dikabari');
  };

  const remove = async (item) => {
    if (!await confirmAction(`Hapus ${item.patient_name} dari waiting list?`)) return;
    const { error } = await supabase.from('waiting_list').delete().eq('id', item.id);
    if (error) {
      toast({ variant: 'destructive', title: 'Gagal menghapus', description: error.message });
      return;
    }
    setItems((prev) => prev.filter((i) => i.id !== item.id));
  };

  const save = async () => {
    const name = form.patient_name.trim();
    const phone = waPhone(form.phone);
    if (!name || phone.length < 9) {
      toast({ variant: 'destructive', title: 'Nama dan nomor WhatsApp wajib diisi' });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('waiting_list').insert({
      clinic_id: userDetails?.clinic_id,
      patient_name: name,
      phone: `0${phone.slice(2)}`,
      preferred_date: form.preferred_date || null,
      time_from: form.time_from || null,
      time_to: form.time_to || null,
      time_label: form.time_label || 'bebas',
      therapist_gender: form.therapist_gender,
      notes: form.notes.trim() || null,
      source: 'manual',
    });
    setSaving(false);
    if (error) {
      toast({ variant: 'destructive', title: 'Gagal menyimpan', description: error.message });
      return;
    }
    toast({ title: 'Masuk waiting list' });
    setDialogOpen(false);
    setForm(emptyForm);
    fetchItems();
  };

  const groups = {
    waiting: items.filter((i) => i.status === 'waiting'),
    notified: items.filter((i) => i.status === 'notified'),
    done: items.filter((i) => ['booked', 'cancelled'].includes(i.status)),
  };
  // Yang ada slot cocok ditaruh di atas.
  const sortedWaiting = [...groups.waiting].sort((a, b) => matchesFor(b).length - matchesFor(a).length);
  const list = tab === 'waiting' ? sortedWaiting : groups[tab];

  const Card = ({ item }) => {
    const matches = matchesFor(item);
    return (
      <div className="rounded-app border border-slate-200 bg-white p-3 sm:p-4 shadow-sm space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 font-semibold text-slate-900">
              <User className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="truncate">{item.patient_name}</span>
              {(item.source === 'ai_whatsapp' || item.source === 'ai_whatsapp_review') &&<Badge variant="secondary" className="gap-1"><Sparkles className="w-3 h-3" />AI</Badge>}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">{item.phone} · masuk {new Date(item.created_at).toLocaleString('id-ID', { timeZone: 'Asia/Makassar', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
          </div>
          {item.status === 'waiting' && matches.length > 0 && <Badge variant="success">Ada slot cocok</Badge>}
          {item.status === 'notified' && <Badge variant="warning">Sudah dikabari</Badge>}
          {item.status === 'booked' && <Badge variant="success">Sudah booking</Badge>}
          {item.status === 'cancelled' && <Badge variant="outline">Dibatalkan</Badge>}
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <Badge variant="outline" className="gap-1"><CalendarDays className="w-3 h-3" />{dateText(item.preferred_date)}</Badge>
          <Badge variant="outline" className="gap-1"><Clock className="w-3 h-3" />{timeText(item)}</Badge>
          <Badge variant="outline">{GENDER_TEXT[item.therapist_gender] || GENDER_TEXT.any}</Badge>
        </div>

        {item.notes && <p className="text-sm text-slate-600 whitespace-pre-wrap">{item.notes}</p>}

        {item.status === 'waiting' && matches.length > 0 && (
          <div className="rounded-app-sm bg-green-50 border border-green-200 p-2 text-xs text-green-800">
            Slot kosong yang cocok:{' '}
            {matches.slice(0, 4).map((m) => `${m.date === todayWita() ? 'hari ini' : dateText(m.date)} ${m.time}${m.therapist ? ` (${m.therapist})` : ''}`).join(' · ')}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {['waiting', 'notified'].includes(item.status) && (
            <>
              <Button size="sm" onClick={() => contactViaWa(item)} className="gap-1.5">
                <MessageCircle className="w-4 h-4" />{item.status === 'notified' ? 'Kabari lagi' : 'Kabari via WA'}
              </Button>
              <Button size="sm" variant="outline" onClick={() => update(item.id, { status: 'booked' }, 'Ditandai sudah booking')} className="gap-1.5">
                <CheckCircle2 className="w-4 h-4" />Sudah booking
              </Button>
              <Button size="sm" variant="outline" onClick={() => update(item.id, { status: 'cancelled' }, 'Dibatalkan')} className="gap-1.5">
                <XCircle className="w-4 h-4" />Batal
              </Button>
            </>
          )}
          {['booked', 'cancelled'].includes(item.status) && (
            <Button size="sm" variant="outline" onClick={() => update(item.id, { status: 'waiting' }, 'Dikembalikan ke waiting list')}>Kembalikan</Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => remove(item)} className="text-red-600 hover:text-red-700 gap-1.5">
            <Trash2 className="w-4 h-4" />Hapus
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHero
        image="/hero/clinara-followup-hero.webp"
        title="Waiting"
        highlight="List"
        description="Pasien yang jadwalnya penuh dan minta dikabari bila ada slot kosong."
      />

      <div className="bg-white rounded-app-lg shadow-sm border border-slate-200 p-3 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <p className="text-sm text-slate-600">
            Slot kosong yang cocok dicek otomatis dari jadwal terapis. Pasien dari WhatsApp ditambahkan oleh AI.
          </p>
          <Button size="sm" onClick={() => setDialogOpen(true)} className="gap-1.5"><Plus className="w-4 h-4" />Tambah manual</Button>
        </div>

        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="w-full h-auto justify-start gap-1.5 bg-slate-50 border border-slate-200 rounded-app p-1.5">
            <TabsTrigger value="waiting" className="gap-1.5 text-xs sm:text-sm font-semibold">Menunggu <span className="opacity-60">({groups.waiting.length})</span></TabsTrigger>
            <TabsTrigger value="notified" className="gap-1.5 text-xs sm:text-sm font-semibold">Sudah dikabari <span className="opacity-60">({groups.notified.length})</span></TabsTrigger>
            <TabsTrigger value="done" className="gap-1.5 text-xs sm:text-sm font-semibold">Selesai <span className="opacity-60">({groups.done.length})</span></TabsTrigger>
          </TabsList>

          <TabsContent value={tab} className="mt-4 sm:mt-6">
            {loading ? (
              <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>
            ) : list.length === 0 ? (
              <div className="text-center py-16 text-slate-500 text-sm">Belum ada pasien di daftar ini.</div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {list.map((item) => <Card key={item.id} item={item} />)}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Tambah ke Waiting List</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Nama pasien" value={form.patient_name} onChange={(e) => setForm({ ...form, patient_name: e.target.value })} />
            <Input placeholder="Nomor WhatsApp (08...)" inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <div>
              <label className="text-xs text-slate-500">Tanggal yang diinginkan (kosongkan bila bebas)</label>
              <Input type="date" value={form.preferred_date} onChange={(e) => setForm({ ...form, preferred_date: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-slate-500">Jam mulai (opsional)</label>
                <Input type="time" value={form.time_from} onChange={(e) => setForm({ ...form, time_from: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-slate-500">Sampai jam (opsional)</label>
                <Input type="time" value={form.time_to} onChange={(e) => setForm({ ...form, time_to: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-slate-500">Waktu (bila jam tidak spesifik)</label>
                <select className="w-full h-10 rounded-app-sm border border-slate-200 bg-white px-2 text-sm" value={form.time_label} onChange={(e) => setForm({ ...form, time_label: e.target.value })}>
                  {Object.entries(LABEL_TEXT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500">Terapis</label>
                <select className="w-full h-10 rounded-app-sm border border-slate-200 bg-white px-2 text-sm" value={form.therapist_gender} onChange={(e) => setForm({ ...form, therapist_gender: e.target.value })}>
                  {Object.entries(GENDER_TEXT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
            </div>
            <Textarea placeholder="Catatan (opsional)" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Batal</Button>
            <Button onClick={save} disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WaitingListPage;
