import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Plus, Trash2, Loader2, Save, CalendarDays, Users, Calculator,
  ArrowRightLeft, Wand2, Receipt, PiggyBank, Trophy,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import MonthYearSelect, { MONTH_NAMES_ID } from '@/components/MonthYearSelect';
import {
  KATEGORI_SEBELUM_SETELAH, KATEGORI_TINDAKAN_SEBELUM, KATEGORI_TINDAKAN_SETELAH,
  RANAP_SWASTA_ESELON, TUMBANG_ESELON,
  hitungTotalPphPerKategori, hitungTindakan, hitungRanapSwasta, hitungTumbang,
  hitungBasisFinal, hitungLaporanFinal, formatRupiah,
} from '@/utils/insentifBulananCalc';
import {
  getOrCreateLaporanBulanan, updateLaporanBulanan, listRoster, upsertRosterMember,
  deleteRosterMember, listTabunganPajakPenarikan, addTabunganPajakPenarikan, deleteTabunganPajakPenarikan,
} from '@/utils/insentifBulananApi';

const nowMonthValue = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const formatPeriodeMonthLabel = (monthValue) => {
  if (!monthValue) return '';
  const [y, m] = monthValue.split('-').map(Number);
  if (!y || !m) return monthValue;
  return `${MONTH_NAMES_ID[m - 1]} ${y}`;
};

const JENIS_OPTIONS = [{ value: 'pagi', label: 'Pagi' }, { value: 'swasta', label: 'Swasta' }];

// Awal & akhir bulan (YYYY-MM) dalam format YYYY-MM-DD, untuk auto-isi periode.
const monthToRange = (monthValue) => {
  if (!monthValue) return { start: '', end: '' };
  const [y, m] = monthValue.split('-').map(Number);
  const start = `${monthValue}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const end = `${monthValue}-${String(lastDay).padStart(2, '0')}`;
  return { start, end };
};

const formatPeriodeLabel = (awal, akhir) => {
  if (!awal || !akhir) return '-';
  const fmt = (s) => { const [y, m, d] = s.split('-'); return `${d}/${m}/${y}`; };
  return `${fmt(awal)} s/d ${fmt(akhir)}`;
};

// ── Wadah kartu premium untuk tiap langkah kalkulator ──────────────────────
const StepCard = ({ step, icon: Icon, title, subtitle, tone = 'indigo', children }) => {
  const TONES = {
    indigo: 'from-indigo-600 to-violet-600',
    sky: 'from-sky-600 to-cyan-600',
    amber: 'from-amber-500 to-orange-500',
    emerald: 'from-emerald-600 to-teal-600',
    rose: 'from-rose-600 to-pink-600',
    slate: 'from-slate-700 to-slate-900',
  };
  return (
    <AccordionItem value={String(step ?? title)} className="border border-slate-200/80 rounded-2xl px-0 bg-white shadow-sm hover:shadow-md transition-shadow overflow-hidden">
      <AccordionTrigger className="px-4 sm:px-5 py-4 hover:no-underline [&>svg]:text-slate-400">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${TONES[tone]} flex items-center justify-center shrink-0 shadow-md`}>
            {step ? <span className="text-white font-extrabold text-sm">{step}</span> : <Icon className="w-5 h-5 text-white" />}
          </div>
          <div className="min-w-0 text-left">
            <p className="font-bold text-slate-800 text-sm sm:text-[15px] leading-tight truncate">{title}</p>
            {subtitle && <p className="text-[11px] sm:text-xs text-slate-400 truncate">{subtitle}</p>}
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-4 sm:px-5 pb-5 pt-1">{children}</AccordionContent>
    </AccordionItem>
  );
};

// ── Editor generik untuk daftar entri kategori (Tahap 1-4) ─────────────────
const KategoriEntryEditor = ({ kategoriList, entries, onChange, withJenis, withPeriode, defaultPeriodeMonth }) => {
  const [form, setForm] = useState({ kategori: kategoriList[0], jenis: 'pagi', periode_bulan: defaultPeriodeMonth || '', nominal: '' });

  useEffect(() => {
    if (defaultPeriodeMonth) setForm((f) => ({ ...f, periode_bulan: defaultPeriodeMonth }));
  }, [defaultPeriodeMonth]);

  const totals = useMemo(() => {
    const out = {};
    for (const kat of kategoriList) out[kat] = 0;
    for (const e of entries) out[e.kategori] = (out[e.kategori] || 0) + (Number(e.nominal) || 0);
    return out;
  }, [entries, kategoriList]);

  const handleAdd = () => {
    const nominal = Number(form.nominal);
    if (!nominal || nominal <= 0) return;
    const entry = { id: crypto.randomUUID(), kategori: form.kategori, nominal };
    if (withJenis) entry.jenis = form.jenis;
    if (withPeriode) {
      const { start, end } = monthToRange(form.periode_bulan);
      entry.tanggal_awal = start || null;
      entry.tanggal_akhir = end || null;
    }
    onChange([...entries, entry]);
    setForm((f) => ({ ...f, nominal: '' }));
  };

  const handleDelete = (id) => onChange(entries.filter((e) => e.id !== id));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 bg-slate-50/80 border border-slate-200 rounded-2xl p-3.5">
        <div>
          <label className="text-[11px] font-semibold text-slate-500 block mb-1">Kategori</label>
          <Select value={form.kategori} onValueChange={(v) => setForm((f) => ({ ...f, kategori: v }))}>
            <SelectTrigger className="w-40 bg-white"><SelectValue /></SelectTrigger>
            <SelectContent>
              {kategoriList.map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {withJenis && (
          <div>
            <label className="text-[11px] font-semibold text-slate-500 block mb-1">Jenis</label>
            <Select value={form.jenis} onValueChange={(v) => setForm((f) => ({ ...f, jenis: v }))}>
              <SelectTrigger className="w-28 bg-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                {JENIS_OPTIONS.map((j) => <SelectItem key={j.value} value={j.value}>{j.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        {withPeriode && (
          <div>
            <label className="text-[11px] font-semibold text-slate-500 block mb-1">Periode (Bulan)</label>
            <MonthYearSelect className="w-40" value={form.periode_bulan} onChange={(v) => setForm((f) => ({ ...f, periode_bulan: v }))} />
          </div>
        )}
        <div>
          <label className="text-[11px] font-semibold text-slate-500 block mb-1">Nominal</label>
          <Input type="number" className="w-40 bg-white" placeholder="0" value={form.nominal} onChange={(e) => setForm((f) => ({ ...f, nominal: e.target.value }))} />
        </div>
        <Button size="sm" onClick={handleAdd} className="gap-1.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 shadow-sm"><Plus className="w-4 h-4" /> Tambah</Button>
      </div>

      {entries.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="text-left px-3 py-2">Kategori</th>
                {withJenis && <th className="text-left px-3 py-2">Jenis</th>}
                {withPeriode && <th className="text-left px-3 py-2">Periode</th>}
                <th className="text-right px-3 py-2">Nominal</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {entries.map((e) => (
                <tr key={e.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="px-3 py-2 font-medium text-slate-700">{e.kategori}</td>
                  {withJenis && <td className="px-3 py-2 text-slate-500 capitalize">{e.jenis || '-'}</td>}
                  {withPeriode && <td className="px-3 py-2 text-slate-500 text-xs">{formatPeriodeLabel(e.tanggal_awal, e.tanggal_akhir)}</td>}
                  <td className="px-3 py-2 text-right tabular-nums">{formatRupiah(e.nominal)}</td>
                  <td className="px-2 py-2 text-center">
                    <button onClick={() => handleDelete(e.id)} className="text-red-400 hover:text-red-600 transition-colors"><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        {kategoriList.map((kat) => (
          <div key={kat} className="rounded-xl border border-slate-200/70 bg-gradient-to-br from-white to-slate-50 p-3 shadow-sm">
            <p className="text-[10px] uppercase font-semibold tracking-wide text-slate-400 truncate">{kat}</p>
            <p className="text-sm font-extrabold text-slate-800 tabular-nums mt-0.5">{formatRupiah(totals[kat])}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Editor untuk Ranap Swasta / Tumbang (eselon + nominal sebelum PPH) ─────
const EselonEntryEditor = ({ eselonList, entries, onChange }) => {
  const [form, setForm] = useState({ eselon: eselonList[0], nominal: '' });

  const totals = useMemo(() => {
    const out = {};
    for (const es of eselonList) out[es] = 0;
    for (const e of entries) out[e.eselon] = (out[e.eselon] || 0) + (Number(e.nominal) || 0);
    return out;
  }, [entries, eselonList]);

  const handleAdd = () => {
    const nominal = Number(form.nominal);
    if (!nominal || nominal <= 0) return;
    onChange([...entries, { id: crypto.randomUUID(), eselon: form.eselon, nominal }]);
    setForm((f) => ({ ...f, nominal: '' }));
  };
  const handleDelete = (id) => onChange(entries.filter((e) => e.id !== id));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 bg-slate-50/80 border border-slate-200 rounded-2xl p-3.5">
        <div>
          <label className="text-[11px] font-semibold text-slate-500 block mb-1">Eselon</label>
          <Select value={form.eselon} onValueChange={(v) => setForm((f) => ({ ...f, eselon: v }))}>
            <SelectTrigger className="w-48 bg-white"><SelectValue /></SelectTrigger>
            <SelectContent>
              {eselonList.map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-[11px] font-semibold text-slate-500 block mb-1">Total Sebelum PPH</label>
          <Input type="number" className="w-44 bg-white" placeholder="0" value={form.nominal} onChange={(e) => setForm((f) => ({ ...f, nominal: e.target.value }))} />
        </div>
        <Button size="sm" onClick={handleAdd} className="gap-1.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 shadow-sm"><Plus className="w-4 h-4" /> Tambah</Button>
      </div>
      {entries.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500"><tr><th className="text-left px-3 py-2">Eselon</th><th className="text-right px-3 py-2">Nominal</th><th className="w-10"></th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {entries.map((e) => (
                <tr key={e.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="px-3 py-2 font-medium text-slate-700">{e.eselon}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatRupiah(e.nominal)}</td>
                  <td className="px-2 py-2 text-center"><button onClick={() => handleDelete(e.id)} className="text-red-400 hover:text-red-600 transition-colors"><Trash2 className="w-4 h-4" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        {eselonList.map((es) => (
          <div key={es} className="rounded-xl border border-slate-200/70 bg-gradient-to-br from-white to-slate-50 p-3 shadow-sm">
            <p className="text-[10px] uppercase font-semibold tracking-wide text-slate-400 truncate">{es}</p>
            <p className="text-sm font-extrabold text-slate-800 tabular-nums mt-0.5">{formatRupiah(totals[es])}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

const ResultTable = ({ rows, columns }) => (
  <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-sm">
    <table className="w-full text-sm">
      <thead className="bg-slate-50 text-slate-500">
        <tr>{columns.map((c) => <th key={c.key} className={`px-3 py-2 ${c.align === 'right' ? 'text-right' : 'text-left'}`}>{c.label}</th>)}</tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {rows.map((row, i) => (
          <tr key={i} className="hover:bg-slate-50/70 transition-colors">
            {columns.map((c) => (
              <td key={c.key} className={`px-3 py-2 ${c.align === 'right' ? 'text-right tabular-nums' : ''}`}>
                {c.render ? c.render(row) : row[c.key]}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const SaveButton = ({ onClick, saving }) => (
  <div className="flex justify-end mt-4">
    <Button size="sm" onClick={onClick} disabled={saving} className="gap-1.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 shadow-sm">
      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Simpan
    </Button>
  </div>
);

const InsentifBulananPage = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const ownerUserId = user?.id;

  const [periodeMonth, setPeriodeMonth] = useState(nowMonthValue());
  const [laporan, setLaporan] = useState(null);
  const [roster, setRoster] = useState([]);
  const [tabungan, setTabungan] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rosterForm, setRosterForm] = useState({ nama: '', persentase: '', is_capped: false, redistribusi_dari_capped_persen: '' });
  const [tabunganForm, setTabunganForm] = useState({ nominal: '', keterangan: '', rosterId: '' });

  const loadAll = useCallback(async () => {
    if (!ownerUserId) return;
    setLoading(true);
    try {
      const periodeBulan = `${periodeMonth}-01`;
      const [laporanData, rosterData, tabunganData] = await Promise.all([
        getOrCreateLaporanBulanan(ownerUserId, periodeBulan),
        listRoster(ownerUserId),
        listTabunganPajakPenarikan(ownerUserId),
      ]);
      setLaporan(laporanData);
      setRoster(rosterData);
      setTabungan(tabunganData);
    } catch (err) {
      toast({ variant: 'destructive', title: 'Gagal memuat data', description: err.message });
    } finally {
      setLoading(false);
    }
  }, [ownerUserId, periodeMonth, toast]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const patchLaporan = (field, value) => setLaporan((prev) => ({ ...prev, [field]: value }));

  const handleSaveField = async (field) => {
    if (!laporan) return;
    setSaving(true);
    try {
      const updated = await updateLaporanBulanan(laporan.id, { [field]: laporan[field] });
      setLaporan(updated);
      toast({ title: 'Tersimpan' });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Gagal menyimpan', description: err.message });
    } finally {
      setSaving(false);
    }
  };

  // ── Kalkulasi turunan ──
  const totalPphPerKategori = useMemo(
    () => laporan ? hitungTotalPphPerKategori(laporan.kategori_sebelum_pph, laporan.kategori_setelah_pph) : {},
    [laporan]
  );
  const tindakanResult = useMemo(
    () => laporan ? hitungTindakan(laporan.tindakan_sebelum_pph, totalPphPerKategori) : null,
    [laporan, totalPphPerKategori]
  );
  const ranapResult = useMemo(
    () => laporan ? hitungRanapSwasta(laporan.ranap_swasta, totalPphPerKategori) : null,
    [laporan, totalPphPerKategori]
  );
  const tumbangResult = useMemo(
    () => laporan ? hitungTumbang(laporan.tumbang, totalPphPerKategori) : null,
    [laporan, totalPphPerKategori]
  );
  const basisFinal = useMemo(
    () => (tindakanResult && ranapResult && tumbangResult) ? hitungBasisFinal(tindakanResult, ranapResult, tumbangResult) : 0,
    [tindakanResult, ranapResult, tumbangResult]
  );
  const penarikanPerRoster = useMemo(() => {
    const out = {};
    for (const t of tabungan) {
      if (t.laporan_id !== laporan?.id || !t.roster_id) continue;
      out[t.roster_id] = (out[t.roster_id] || 0) + (Number(t.nominal) || 0);
    }
    return out;
  }, [tabungan, laporan]);

  const laporanFinalResult = useMemo(() => {
    if (!laporan || !tindakanResult || !ranapResult || !tumbangResult) return null;
    return hitungLaporanFinal({
      basisFinal, kasTotal: Number(laporan.kas_total) || 0, f5Nominal: Number(laporan.f5_nominal) || 0,
      roster, tindakanResult, ranapResult, tumbangResult, penarikanPerRoster,
    });
  }, [laporan, roster, basisFinal, tindakanResult, ranapResult, tumbangResult, penarikanPerRoster]);

  // ── Roster CRUD ──
  const handleAddRoster = async () => {
    if (!rosterForm.nama || !rosterForm.persentase) return;
    try {
      const created = await upsertRosterMember(ownerUserId, {
        nama: rosterForm.nama,
        persentase: Number(rosterForm.persentase),
        urutan: roster.length,
        is_capped: rosterForm.is_capped,
        redistribusi_dari_capped_persen: rosterForm.redistribusi_dari_capped_persen ? Number(rosterForm.redistribusi_dari_capped_persen) : null,
      });
      setRoster((prev) => [...prev, created]);
      setRosterForm({ nama: '', persentase: '', is_capped: false, redistribusi_dari_capped_persen: '' });
      toast({ title: 'Anggota roster ditambahkan' });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Gagal menambah roster', description: err.message });
    }
  };
  const handleDeleteRoster = async (id) => {
    try {
      await deleteRosterMember(id);
      setRoster((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      toast({ variant: 'destructive', title: 'Gagal menghapus', description: err.message });
    }
  };

  // ── Tabungan pajak CRUD ──
  const handleAddTabungan = async () => {
    const nominal = Number(tabunganForm.nominal);
    if (!nominal) return;
    try {
      const created = await addTabunganPajakPenarikan(ownerUserId, {
        laporanId: laporan?.id, nominal, keterangan: tabunganForm.keterangan,
        rosterId: tabunganForm.rosterId || null,
      });
      setTabungan((prev) => [created, ...prev]);
      setTabunganForm({ nominal: '', keterangan: '', rosterId: '' });
      toast({ title: 'Penarikan dicatat' });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Gagal mencatat', description: err.message });
    }
  };
  const handleDeleteTabungan = async (id) => {
    try {
      await deleteTabunganPajakPenarikan(id);
      setTabungan((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      toast({ variant: 'destructive', title: 'Gagal menghapus', description: err.message });
    }
  };

  const handleFinalTransferChange = (rosterId, nominal) => {
    setLaporan((prev) => ({
      ...prev,
      final_transfers: { ...(prev.final_transfers || {}), [rosterId]: { nominal_transfer: nominal } },
    }));
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        <p className="text-sm text-slate-400">Memuat data laporan...</p>
      </div>
    );
  }

  const totalTabunganPajak = tabungan.reduce((s, t) => s + (Number(t.nominal) || 0), 0);
  const periodeLabel = formatPeriodeMonthLabel(periodeMonth);

  return (
    <div className="space-y-5 animate-in fade-in duration-500">
      {/* Hero Banner */}
      <div className="w-full rounded-2xl overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 shadow-xl border border-slate-700/50 relative">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle, #d4af6a 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        <div className="relative flex flex-col sm:flex-row sm:items-center gap-4 px-5 py-5 sm:px-7 sm:py-6">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400/20 to-amber-600/10 backdrop-blur-sm border border-amber-300/30 flex items-center justify-center shadow-lg">
              <Calculator className="w-6 h-6 text-amber-300" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold tracking-widest text-amber-300/80 uppercase mb-1">Insentif Bulanan</p>
              <h2 className="text-lg sm:text-xl font-bold text-white leading-tight">Kalkulator Rekap Insentif Dokter &amp; Terapis</h2>
              <p className="text-sm text-slate-400 mt-0.5">Lengkapi tiap tahap secara berurutan untuk periode {periodeLabel}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-xl pl-3 pr-1.5 py-1 backdrop-blur-sm shrink-0">
            <CalendarDays className="w-4 h-4 text-amber-300 shrink-0" />
            <MonthYearSelect value={periodeMonth} onChange={setPeriodeMonth} variant="dark" />
          </div>
        </div>
      </div>

      <Accordion type="multiple" defaultValue={['1']} className="space-y-3.5">
        <StepCard step={1} title="Total Sebelum PPH" subtitle="Input nominal per kategori sebelum potongan pajak" tone="indigo">
          <KategoriEntryEditor
            kategoriList={KATEGORI_SEBELUM_SETELAH}
            entries={laporan?.kategori_sebelum_pph || []}
            onChange={(v) => patchLaporan('kategori_sebelum_pph', v)}
            withJenis withPeriode defaultPeriodeMonth={periodeMonth}
          />
          <SaveButton saving={saving} onClick={() => handleSaveField('kategori_sebelum_pph')} />
        </StepCard>

        <StepCard step={2} title="Total Setelah PPH" subtitle="Nominal yang benar-benar masuk rekening" tone="indigo">
          <KategoriEntryEditor
            kategoriList={KATEGORI_SEBELUM_SETELAH}
            entries={laporan?.kategori_setelah_pph || []}
            onChange={(v) => patchLaporan('kategori_setelah_pph', v)}
            withPeriode defaultPeriodeMonth={periodeMonth}
          />
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            {KATEGORI_SEBELUM_SETELAH.map((kat) => (
              <div key={kat} className="rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-violet-50 p-3 shadow-sm">
                <p className="text-[10px] uppercase font-semibold tracking-wide text-indigo-400 truncate">Persen PPH {kat}</p>
                <p className="text-sm font-extrabold text-indigo-700 mt-0.5">{((totalPphPerKategori[kat]?.persenPph || 0) * 100).toFixed(2)}%</p>
              </div>
            ))}
          </div>
          <SaveButton saving={saving} onClick={() => handleSaveField('kategori_setelah_pph')} />
        </StepCard>

        <StepCard step={3} title="Tindakan Sebelum PPH" subtitle="Konsul, visite, dan tindakan lain sebelum pajak" tone="sky">
          <KategoriEntryEditor
            kategoriList={KATEGORI_TINDAKAN_SEBELUM}
            entries={laporan?.tindakan_sebelum_pph || []}
            onChange={(v) => patchLaporan('tindakan_sebelum_pph', v)}
          />
          <SaveButton saving={saving} onClick={() => handleSaveField('tindakan_sebelum_pph')} />
        </StepCard>

        <StepCard step={4} icon={Wand2} title="Tindakan Setelah PPH" subtitle="Otomatis — dihitung dari persentase PPH tahap 1→2" tone="sky">
          <div className="flex items-center gap-2 mb-4 text-xs text-slate-500 bg-sky-50 border border-sky-100 rounded-xl px-3.5 py-2.5">
            <Wand2 className="w-4 h-4 text-sky-500 shrink-0" />
            Dihitung otomatis dari Tindakan Sebelum PPH × persentase PPH per eselon (tahap 1→2) — tidak perlu input manual lagi.
          </div>
          {tindakanResult && (
            <div>
              <ResultTable
                rows={KATEGORI_TINDAKAN_SETELAH.map((kat) => ({ kat, ...tindakanResult.perKategori[kat] }))}
                columns={[
                  { key: 'kat', label: 'Kategori' },
                  { key: 'tindakanSetelahPph', label: 'Setelah PPH', align: 'right', render: (r) => formatRupiah(r.tindakanSetelahPph) },
                  { key: 'pajak', label: 'Pajak 15%', align: 'right', render: (r) => formatRupiah(r.pajak) },
                  { key: 'setelahPajak', label: 'Setelah Pajak 15%', align: 'right', render: (r) => formatRupiah(r.setelahPajak) },
                  { key: 'konsulVisiteSetelahPajak', label: 'Konsul+Visite (Dokter)', align: 'right', render: (r) => formatRupiah(r.konsulVisiteSetelahPajak) },
                ]}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-3">
                <div className="rounded-xl border border-slate-200/70 bg-gradient-to-br from-white to-slate-50 p-3 shadow-sm">
                  <p className="text-[10px] uppercase font-semibold tracking-wide text-slate-400">Total Tindakan Setelah Pajak</p>
                  <p className="text-sm font-extrabold text-slate-800 mt-0.5">{formatRupiah(tindakanResult.totalSetelahPajak)}</p>
                </div>
                <div className="rounded-xl border border-slate-200/70 bg-gradient-to-br from-white to-slate-50 p-3 shadow-sm">
                  <p className="text-[10px] uppercase font-semibold tracking-wide text-slate-400">Total Konsul+Visite (Dokter)</p>
                  <p className="text-sm font-extrabold text-slate-800 mt-0.5">{formatRupiah(tindakanResult.totalKonsulVisiteSetelahPajak)}</p>
                </div>
              </div>
            </div>
          )}
        </StepCard>

        <StepCard step={5} title="Ranap Swasta" subtitle="Split 50:50 antara dokter & terapis" tone="amber">
          <EselonEntryEditor eselonList={RANAP_SWASTA_ESELON} entries={laporan?.ranap_swasta || []} onChange={(v) => patchLaporan('ranap_swasta', v)} />
          {ranapResult && (
            <div className="mt-4">
              <ResultTable
                rows={RANAP_SWASTA_ESELON.map((es) => ({ es, ...ranapResult.perEselon[es] }))}
                columns={[
                  { key: 'es', label: 'Eselon' },
                  { key: 'setelahPph', label: 'Setelah PPH', align: 'right', render: (r) => formatRupiah(r.setelahPph) },
                  { key: 'pajak', label: 'Pajak 15%', align: 'right', render: (r) => formatRupiah(r.pajak) },
                  { key: 'dokter', label: 'Dokter (50%)', align: 'right', render: (r) => formatRupiah(r.dokter) },
                  { key: 'terapis', label: 'Terapis (50%)', align: 'right', render: (r) => formatRupiah(r.terapis) },
                ]}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-3">
                <div className="rounded-xl border border-amber-100 bg-gradient-to-br from-amber-50 to-orange-50 p-3 shadow-sm">
                  <p className="text-[10px] uppercase font-semibold tracking-wide text-amber-500">Total Dokter</p>
                  <p className="text-sm font-extrabold text-amber-700 mt-0.5">{formatRupiah(ranapResult.totalDokter)}</p>
                </div>
                <div className="rounded-xl border border-amber-100 bg-gradient-to-br from-amber-50 to-orange-50 p-3 shadow-sm">
                  <p className="text-[10px] uppercase font-semibold tracking-wide text-amber-500">Total Terapis</p>
                  <p className="text-sm font-extrabold text-amber-700 mt-0.5">{formatRupiah(ranapResult.totalTerapis)}</p>
                </div>
              </div>
            </div>
          )}
          <SaveButton saving={saving} onClick={() => handleSaveField('ranap_swasta')} />
        </StepCard>

        <StepCard step={6} title="Tumbang" subtitle="29% Dokter, sisanya Tumbang / Fisio" tone="rose">
          <EselonEntryEditor eselonList={TUMBANG_ESELON} entries={laporan?.tumbang || []} onChange={(v) => patchLaporan('tumbang', v)} />
          {tumbangResult && (
            <div className="mt-4">
              <ResultTable
                rows={TUMBANG_ESELON.map((es) => ({ es, ...tumbangResult.perEselon[es] }))}
                columns={[
                  { key: 'es', label: 'Eselon' },
                  { key: 'setelahPph', label: 'Setelah PPH', align: 'right', render: (r) => formatRupiah(r.setelahPph) },
                  { key: 'dokter', label: 'Dokter (29%)', align: 'right', render: (r) => formatRupiah(r.dokter) },
                  { key: 'tumbang', label: 'Tumbang', align: 'right', render: (r) => formatRupiah(r.tumbang) },
                  { key: 'fisio', label: 'Fisio', align: 'right', render: (r) => formatRupiah(r.fisio) },
                ]}
              />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mt-3">
                <div className="rounded-xl border border-rose-100 bg-gradient-to-br from-rose-50 to-pink-50 p-3 shadow-sm">
                  <p className="text-[10px] uppercase font-semibold tracking-wide text-rose-500">Total Dokter</p>
                  <p className="text-sm font-extrabold text-rose-700 mt-0.5">{formatRupiah(tumbangResult.totalDokter)}</p>
                </div>
                <div className="rounded-xl border border-rose-100 bg-gradient-to-br from-rose-50 to-pink-50 p-3 shadow-sm">
                  <p className="text-[10px] uppercase font-semibold tracking-wide text-rose-500">Total Tumbang</p>
                  <p className="text-sm font-extrabold text-rose-700 mt-0.5">{formatRupiah(tumbangResult.totalTumbang)}</p>
                </div>
                <div className="rounded-xl border border-rose-100 bg-gradient-to-br from-rose-50 to-pink-50 p-3 shadow-sm">
                  <p className="text-[10px] uppercase font-semibold tracking-wide text-rose-500">Total Fisio</p>
                  <p className="text-sm font-extrabold text-rose-700 mt-0.5">{formatRupiah(tumbangResult.totalFisio)}</p>
                </div>
              </div>
            </div>
          )}
          <SaveButton saving={saving} onClick={() => handleSaveField('tumbang')} />
        </StepCard>

        <StepCard icon={Users} title="Pengaturan Roster" subtitle="Daftar penerima insentif & persentasenya" tone="slate">
          <div className="flex flex-wrap items-end gap-3 bg-slate-50/80 border border-slate-200 rounded-2xl p-3.5">
            <div>
              <label className="text-[11px] font-semibold text-slate-500 block mb-1">Nama</label>
              <Input className="w-36 bg-white" value={rosterForm.nama} onChange={(e) => setRosterForm((f) => ({ ...f, nama: e.target.value }))} />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-500 block mb-1">Persentase (%)</label>
              <Input type="number" step="0.01" className="w-28 bg-white" value={rosterForm.persentase} onChange={(e) => setRosterForm((f) => ({ ...f, persentase: e.target.value }))} />
            </div>
            <Button size="sm" onClick={handleAddRoster} className="gap-1.5 bg-gradient-to-r from-slate-700 to-slate-900 hover:from-slate-800 hover:to-black shadow-sm"><Plus className="w-4 h-4" /> Tambah</Button>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-sm mt-4">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500"><tr><th className="text-left px-3 py-2">Nama</th><th className="text-right px-3 py-2">Persentase</th><th className="w-10"></th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {roster.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-3 py-2 font-medium">{r.nama}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.persentase}%</td>
                    <td className="px-2 py-2 text-center"><button onClick={() => handleDeleteRoster(r.id)} className="text-red-400 hover:text-red-600 transition-colors"><Trash2 className="w-4 h-4" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </StepCard>

        <AccordionItem value="laporan-final" className="border border-indigo-200 rounded-2xl px-0 bg-gradient-to-br from-indigo-50/60 via-white to-violet-50/40 shadow-md overflow-hidden">
          <AccordionTrigger className="px-4 sm:px-5 py-4 hover:no-underline [&>svg]:text-indigo-400">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shrink-0 shadow-md">
                <Trophy className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0 text-left">
                <p className="font-bold text-slate-800 text-sm sm:text-[15px] leading-tight truncate">7. Laporan Final</p>
                <p className="text-[11px] sm:text-xs text-slate-400 truncate">Rekap akhir pembagian ke seluruh roster</p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 sm:px-5 pb-5 pt-1 space-y-4">
            <div className="flex flex-wrap gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-500 block mb-1">KAS (total)</label>
                <Input type="number" className="w-40 bg-white" value={laporan?.kas_total ?? ''} onChange={(e) => patchLaporan('kas_total', e.target.value)} onBlur={() => handleSaveField('kas_total')} />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-500 block mb-1">F5 (potongan Om Phius)</label>
                <Input type="number" className="w-40 bg-white" value={laporan?.f5_nominal ?? ''} onChange={(e) => patchLaporan('f5_nominal', e.target.value)} onBlur={() => handleSaveField('f5_nominal')} />
              </div>
            </div>

            <div className="rounded-xl border border-indigo-200 bg-white p-4 shadow-sm">
              <p className="text-xs text-slate-500">Basis Final (Tindakan − Ranap Swasta − Tumbang)</p>
              <p className="text-xl font-extrabold text-indigo-700 mt-0.5">{formatRupiah(basisFinal)}</p>
            </div>

            {laporanFinalResult && (
              <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr><th className="text-left px-3 py-2">Nama</th><th className="text-right px-3 py-2">Penarikan Operasional</th><th className="text-right px-3 py-2">Nominal Hitungan</th><th className="text-right px-3 py-2">Nominal Transfer</th><th className="text-right px-3 py-2">Uang Makan</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {roster.filter((r) => r.is_active !== false).map((r) => {
                      const result = laporanFinalResult.perOrang[r.id];
                      const transfer = laporan?.final_transfers?.[r.id]?.nominal_transfer;
                      const uangMakan = transfer !== undefined && transfer !== '' ? Number(transfer) - (result?.nominalHitungan || 0) : null;
                      return (
                        <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="px-3 py-2 font-medium">{r.nama}{result?.isCapped && <span className="ml-1 text-[10px] text-amber-600">(dibatasi)</span>}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-slate-500">{result?.penarikanOperasional ? formatRupiah(result.penarikanOperasional) : '-'}</td>
                          <td className="px-3 py-2 text-right tabular-nums font-semibold">{formatRupiah(result?.nominalHitungan)}</td>
                          <td className="px-3 py-2 text-right">
                            <Input type="number" className="w-36 text-right ml-auto bg-white" value={transfer ?? ''} onChange={(e) => handleFinalTransferChange(r.id, e.target.value)} onBlur={() => handleSaveField('final_transfers')} />
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">{uangMakan !== null ? formatRupiah(uangMakan) : '-'}</td>
                        </tr>
                      );
                    })}
                    <tr className="bg-slate-50 font-bold">
                      <td className="px-3 py-2">KAS</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatRupiah(laporanFinalResult.kasTotal)}</td>
                      <td colSpan={2}></td>
                    </tr>
                    <tr className="bg-gradient-to-r from-indigo-50 to-violet-50 font-bold">
                      <td className="px-3 py-2 text-indigo-700">TOTAL</td>
                      <td className="px-3 py-2 text-right tabular-nums text-indigo-700">{formatRupiah(laporanFinalResult.grandTotal)}</td>
                      <td colSpan={2}></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </AccordionContent>
        </AccordionItem>

        <StepCard icon={PiggyBank} title="Tabungan Pajak — Penarikan Operasional" subtitle="Catat penarikan dan siapa penerimanya" tone="emerald">
          <div className="flex items-center gap-2 mb-4 text-xs text-slate-500 bg-emerald-50 border border-emerald-100 rounded-xl px-3.5 py-2.5">
            <ArrowRightLeft className="w-4 h-4 text-emerald-500 shrink-0" />
            Penarikan yang ditandai "diberikan ke" seseorang akan otomatis ditambahkan ke nominal hitungan orang itu di Laporan Final bulan ini.
          </div>
          <div className="flex flex-wrap items-end gap-3 bg-slate-50/80 border border-slate-200 rounded-2xl p-3.5">
            <div>
              <label className="text-[11px] font-semibold text-slate-500 block mb-1">Nominal</label>
              <Input type="number" className="w-40 bg-white" value={tabunganForm.nominal} onChange={(e) => setTabunganForm((f) => ({ ...f, nominal: e.target.value }))} />
            </div>
            <div className="flex-1 min-w-[180px]">
              <label className="text-[11px] font-semibold text-slate-500 block mb-1">Keterangan</label>
              <Input className="bg-white" value={tabunganForm.keterangan} onChange={(e) => setTabunganForm((f) => ({ ...f, keterangan: e.target.value }))} placeholder="Untuk apa" />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-500 block mb-1">Diberikan ke</label>
              <Select value={tabunganForm.rosterId || 'none'} onValueChange={(v) => setTabunganForm((f) => ({ ...f, rosterId: v === 'none' ? '' : v }))}>
                <SelectTrigger className="w-44 bg-white"><SelectValue placeholder="Tidak ada" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Tidak ada (murni penarikan)</SelectItem>
                  {roster.map((r) => <SelectItem key={r.id} value={r.id}>{r.nama}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button size="sm" onClick={handleAddTabungan} className="gap-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-sm"><Plus className="w-4 h-4" /> Catat</Button>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-sm mt-4">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500"><tr><th className="text-left px-3 py-2">Keterangan</th><th className="text-left px-3 py-2">Diberikan ke</th><th className="text-right px-3 py-2">Nominal</th><th className="w-10"></th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {tabungan.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-3 py-2">{t.keterangan || '-'}</td>
                    <td className="px-3 py-2 text-slate-500">{roster.find((r) => r.id === t.roster_id)?.nama || '-'}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatRupiah(t.nominal)}</td>
                    <td className="px-2 py-2 text-center"><button onClick={() => handleDeleteTabungan(t.id)} className="text-red-400 hover:text-red-600 transition-colors"><Trash2 className="w-4 h-4" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 rounded-xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-teal-50 p-3.5 shadow-sm inline-flex items-center gap-2">
            <Receipt className="w-4 h-4 text-emerald-500 shrink-0" />
            <p className="text-sm font-bold text-emerald-700">Total ditarik: {formatRupiah(totalTabunganPajak)}</p>
          </div>
        </StepCard>
      </Accordion>
    </div>
  );
};

export default InsentifBulananPage;
