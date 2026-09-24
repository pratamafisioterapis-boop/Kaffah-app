import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Loader2, Save, CalendarDays, Wallet, Users } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';
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

const JENIS_OPTIONS = [{ value: 'pagi', label: 'Pagi' }, { value: 'swasta', label: 'Swasta' }];

// ── Editor generik untuk daftar entri kategori (Tahap 1-4) ─────────────────
const KategoriEntryEditor = ({ kategoriList, entries, onChange, withJenis, withPeriode }) => {
  const [form, setForm] = useState({ kategori: kategoriList[0], jenis: 'pagi', tanggal_awal: '', tanggal_akhir: '', nominal: '' });

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
    if (withPeriode) { entry.tanggal_awal = form.tanggal_awal || null; entry.tanggal_akhir = form.tanggal_akhir || null; }
    onChange([...entries, entry]);
    setForm((f) => ({ ...f, nominal: '', tanggal_awal: '', tanggal_akhir: '' }));
  };

  const handleDelete = (id) => onChange(entries.filter((e) => e.id !== id));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2 bg-slate-50 border border-slate-200 rounded-xl p-3">
        <div>
          <label className="text-[11px] font-semibold text-slate-500 block mb-1">Kategori</label>
          <Select value={form.kategori} onValueChange={(v) => setForm((f) => ({ ...f, kategori: v }))}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              {kategoriList.map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {withJenis && (
          <div>
            <label className="text-[11px] font-semibold text-slate-500 block mb-1">Jenis</label>
            <Select value={form.jenis} onValueChange={(v) => setForm((f) => ({ ...f, jenis: v }))}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                {JENIS_OPTIONS.map((j) => <SelectItem key={j.value} value={j.value}>{j.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        {withPeriode && (
          <>
            <div>
              <label className="text-[11px] font-semibold text-slate-500 block mb-1">Tanggal Awal</label>
              <Input type="date" className="w-36" value={form.tanggal_awal} onChange={(e) => setForm((f) => ({ ...f, tanggal_awal: e.target.value }))} />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-500 block mb-1">Tanggal Akhir</label>
              <Input type="date" className="w-36" value={form.tanggal_akhir} onChange={(e) => setForm((f) => ({ ...f, tanggal_akhir: e.target.value }))} />
            </div>
          </>
        )}
        <div>
          <label className="text-[11px] font-semibold text-slate-500 block mb-1">Nominal</label>
          <Input type="number" className="w-40" placeholder="0" value={form.nominal} onChange={(e) => setForm((f) => ({ ...f, nominal: e.target.value }))} />
        </div>
        <Button size="sm" onClick={handleAdd} className="gap-1.5"><Plus className="w-4 h-4" /> Tambah</Button>
      </div>

      {entries.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
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
                <tr key={e.id}>
                  <td className="px-3 py-2 font-medium text-slate-700">{e.kategori}</td>
                  {withJenis && <td className="px-3 py-2 text-slate-500 capitalize">{e.jenis || '-'}</td>}
                  {withPeriode && <td className="px-3 py-2 text-slate-500 text-xs">{e.tanggal_awal || '-'} s/d {e.tanggal_akhir || '-'}</td>}
                  <td className="px-3 py-2 text-right tabular-nums">{formatRupiah(e.nominal)}</td>
                  <td className="px-2 py-2 text-center">
                    <button onClick={() => handleDelete(e.id)} className="text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {kategoriList.map((kat) => (
          <div key={kat} className="rounded-lg border border-slate-200 bg-white p-2.5">
            <p className="text-[10px] uppercase font-semibold text-slate-400">{kat}</p>
            <p className="text-sm font-bold text-slate-700 tabular-nums">{formatRupiah(totals[kat])}</p>
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
      <div className="flex flex-wrap items-end gap-2 bg-slate-50 border border-slate-200 rounded-xl p-3">
        <div>
          <label className="text-[11px] font-semibold text-slate-500 block mb-1">Eselon</label>
          <Select value={form.eselon} onValueChange={(v) => setForm((f) => ({ ...f, eselon: v }))}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              {eselonList.map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-[11px] font-semibold text-slate-500 block mb-1">Total Sebelum PPH</label>
          <Input type="number" className="w-44" placeholder="0" value={form.nominal} onChange={(e) => setForm((f) => ({ ...f, nominal: e.target.value }))} />
        </div>
        <Button size="sm" onClick={handleAdd} className="gap-1.5"><Plus className="w-4 h-4" /> Tambah</Button>
      </div>
      {entries.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500"><tr><th className="text-left px-3 py-2">Eselon</th><th className="text-right px-3 py-2">Nominal</th><th className="w-10"></th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {entries.map((e) => (
                <tr key={e.id}>
                  <td className="px-3 py-2 font-medium text-slate-700">{e.eselon}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatRupiah(e.nominal)}</td>
                  <td className="px-2 py-2 text-center"><button onClick={() => handleDelete(e.id)} className="text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {eselonList.map((es) => (
          <div key={es} className="rounded-lg border border-slate-200 bg-white p-2.5">
            <p className="text-[10px] uppercase font-semibold text-slate-400">{es}</p>
            <p className="text-sm font-bold text-slate-700 tabular-nums">{formatRupiah(totals[es])}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

const ResultTable = ({ rows, columns }) => (
  <div className="overflow-x-auto rounded-xl border border-slate-200">
    <table className="w-full text-sm">
      <thead className="bg-slate-50 text-slate-500">
        <tr>{columns.map((c) => <th key={c.key} className={`px-3 py-2 ${c.align === 'right' ? 'text-right' : 'text-left'}`}>{c.label}</th>)}</tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {rows.map((row, i) => (
          <tr key={i}>
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
  const [tabunganForm, setTabunganForm] = useState({ nominal: '', keterangan: '' });

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
  const laporanFinalResult = useMemo(() => {
    if (!laporan || !tindakanResult || !ranapResult || !tumbangResult) return null;
    return hitungLaporanFinal({
      basisFinal, kasTotal: Number(laporan.kas_total) || 0, f5Nominal: Number(laporan.f5_nominal) || 0,
      roster, tindakanResult, ranapResult, tumbangResult,
    });
  }, [laporan, roster, basisFinal, tindakanResult, ranapResult, tumbangResult]);

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
      const created = await addTabunganPajakPenarikan(ownerUserId, { laporanId: laporan?.id, nominal, keterangan: tabunganForm.keterangan });
      setTabungan((prev) => [created, ...prev]);
      setTabunganForm({ nominal: '', keterangan: '' });
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
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>;
  }

  const totalTabunganPajak = tabungan.reduce((s, t) => s + (Number(t.nominal) || 0), 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Insentif Bulanan</h1>
          <p className="text-sm text-slate-500">Kalkulator rekap insentif dokter & terapis, per bulan.</p>
        </div>
        <div className="flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-slate-400" />
          <input type="month" value={periodeMonth} onChange={(e) => setPeriodeMonth(e.target.value)} className="h-9 px-3 rounded-md border border-input bg-white text-sm outline-none" />
        </div>
      </div>

      <Accordion type="multiple" defaultValue={['sebelum-pph']} className="space-y-3">
        <AccordionItem value="sebelum-pph" className="border border-slate-200 rounded-xl px-4 bg-white">
          <AccordionTrigger>1. Total Sebelum PPH</AccordionTrigger>
          <AccordionContent className="pb-4">
            <KategoriEntryEditor
              kategoriList={KATEGORI_SEBELUM_SETELAH}
              entries={laporan?.kategori_sebelum_pph || []}
              onChange={(v) => patchLaporan('kategori_sebelum_pph', v)}
              withJenis withPeriode
            />
            <div className="flex justify-end mt-3">
              <Button size="sm" onClick={() => handleSaveField('kategori_sebelum_pph')} disabled={saving} className="gap-1.5">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Simpan
              </Button>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="setelah-pph" className="border border-slate-200 rounded-xl px-4 bg-white">
          <AccordionTrigger>2. Total Setelah PPH (nominal masuk rekening)</AccordionTrigger>
          <AccordionContent className="pb-4">
            <KategoriEntryEditor
              kategoriList={KATEGORI_SEBELUM_SETELAH}
              entries={laporan?.kategori_setelah_pph || []}
              onChange={(v) => patchLaporan('kategori_setelah_pph', v)}
              withPeriode
            />
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
              {KATEGORI_SEBELUM_SETELAH.map((kat) => (
                <div key={kat} className="rounded-lg border border-indigo-100 bg-indigo-50/50 p-2.5">
                  <p className="text-[10px] uppercase font-semibold text-indigo-400">Persen PPH {kat}</p>
                  <p className="text-sm font-bold text-indigo-700">{((totalPphPerKategori[kat]?.persenPph || 0) * 100).toFixed(2)}%</p>
                </div>
              ))}
            </div>
            <div className="flex justify-end mt-3">
              <Button size="sm" onClick={() => handleSaveField('kategori_setelah_pph')} disabled={saving} className="gap-1.5">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Simpan
              </Button>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="tindakan-sebelum" className="border border-slate-200 rounded-xl px-4 bg-white">
          <AccordionTrigger>3. Tindakan Sebelum PPH</AccordionTrigger>
          <AccordionContent className="pb-4">
            <KategoriEntryEditor
              kategoriList={KATEGORI_TINDAKAN_SEBELUM}
              entries={laporan?.tindakan_sebelum_pph || []}
              onChange={(v) => patchLaporan('tindakan_sebelum_pph', v)}
            />
            <div className="flex justify-end mt-3">
              <Button size="sm" onClick={() => handleSaveField('tindakan_sebelum_pph')} disabled={saving} className="gap-1.5">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Simpan
              </Button>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="tindakan-setelah" className="border border-slate-200 rounded-xl px-4 bg-white">
          <AccordionTrigger>4. Tindakan Setelah PPH (otomatis)</AccordionTrigger>
          <AccordionContent className="pb-4">
            <p className="text-xs text-slate-500 mb-3">
              Dihitung otomatis dari Tindakan Sebelum PPH × persentase PPH per eselon (tahap 1→2) — tidak perlu input manual lagi.
            </p>
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
                <p className="text-sm font-bold text-slate-700 mt-2">Total Tindakan Setelah Pajak: {formatRupiah(tindakanResult.totalSetelahPajak)}</p>
                <p className="text-sm font-bold text-slate-700">Total Konsul+Visite (Dokter): {formatRupiah(tindakanResult.totalKonsulVisiteSetelahPajak)}</p>
              </div>
            )}
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="ranap-swasta" className="border border-slate-200 rounded-xl px-4 bg-white">
          <AccordionTrigger>5. Ranap Swasta</AccordionTrigger>
          <AccordionContent className="pb-4">
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
                <p className="text-sm font-bold text-slate-700 mt-2">Total Dokter: {formatRupiah(ranapResult.totalDokter)} · Total Terapis: {formatRupiah(ranapResult.totalTerapis)}</p>
              </div>
            )}
            <div className="flex justify-end mt-3">
              <Button size="sm" onClick={() => handleSaveField('ranap_swasta')} disabled={saving} className="gap-1.5">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Simpan
              </Button>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="tumbang" className="border border-slate-200 rounded-xl px-4 bg-white">
          <AccordionTrigger>6. Tumbang</AccordionTrigger>
          <AccordionContent className="pb-4">
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
                <p className="text-sm font-bold text-slate-700 mt-2">
                  Total Dokter: {formatRupiah(tumbangResult.totalDokter)} · Total Tumbang: {formatRupiah(tumbangResult.totalTumbang)} · Total Fisio: {formatRupiah(tumbangResult.totalFisio)}
                </p>
              </div>
            )}
            <div className="flex justify-end mt-3">
              <Button size="sm" onClick={() => handleSaveField('tumbang')} disabled={saving} className="gap-1.5">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Simpan
              </Button>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="roster" className="border border-slate-200 rounded-xl px-4 bg-white">
          <AccordionTrigger className="gap-2"><Users className="w-4 h-4" /> Pengaturan Roster</AccordionTrigger>
          <AccordionContent className="pb-4 space-y-4">
            <div className="flex flex-wrap items-end gap-2 bg-slate-50 border border-slate-200 rounded-xl p-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-500 block mb-1">Nama</label>
                <Input className="w-36" value={rosterForm.nama} onChange={(e) => setRosterForm((f) => ({ ...f, nama: e.target.value }))} />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-500 block mb-1">Persentase (%)</label>
                <Input type="number" step="0.01" className="w-28" value={rosterForm.persentase} onChange={(e) => setRosterForm((f) => ({ ...f, persentase: e.target.value }))} />
              </div>
              <label className="flex items-center gap-1.5 text-xs text-slate-600 pb-2">
                <input type="checkbox" checked={rosterForm.is_capped} onChange={(e) => setRosterForm((f) => ({ ...f, is_capped: e.target.checked }))} /> Dibatasi (capped)
              </label>
              <div>
                <label className="text-[11px] font-semibold text-slate-500 block mb-1">Redistribusi dari capped (%)</label>
                <Input type="number" step="0.01" className="w-32" value={rosterForm.redistribusi_dari_capped_persen} onChange={(e) => setRosterForm((f) => ({ ...f, redistribusi_dari_capped_persen: e.target.value }))} />
              </div>
              <Button size="sm" onClick={handleAddRoster} className="gap-1.5"><Plus className="w-4 h-4" /> Tambah</Button>
            </div>
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-500"><tr><th className="text-left px-3 py-2">Nama</th><th className="text-right px-3 py-2">Persentase</th><th className="text-center px-3 py-2">Capped</th><th className="text-right px-3 py-2">Redistribusi %</th><th className="w-10"></th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {roster.map((r) => (
                    <tr key={r.id}>
                      <td className="px-3 py-2 font-medium">{r.nama}</td>
                      <td className="px-3 py-2 text-right">{r.persentase}%</td>
                      <td className="px-3 py-2 text-center">{r.is_capped ? '✓' : '-'}</td>
                      <td className="px-3 py-2 text-right">{r.redistribusi_dari_capped_persen ? `${r.redistribusi_dari_capped_persen}%` : '-'}</td>
                      <td className="px-2 py-2 text-center"><button onClick={() => handleDeleteRoster(r.id)} className="text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="laporan-final" className="border border-indigo-200 rounded-xl px-4 bg-indigo-50/30">
          <AccordionTrigger>7. Laporan Final</AccordionTrigger>
          <AccordionContent className="pb-4 space-y-4">
            <div className="flex flex-wrap gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-500 block mb-1">KAS (total)</label>
                <Input type="number" className="w-40" value={laporan?.kas_total ?? ''} onChange={(e) => patchLaporan('kas_total', e.target.value)} onBlur={() => handleSaveField('kas_total')} />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-500 block mb-1">F5 (potongan Om Phius)</label>
                <Input type="number" className="w-40" value={laporan?.f5_nominal ?? ''} onChange={(e) => patchLaporan('f5_nominal', e.target.value)} onBlur={() => handleSaveField('f5_nominal')} />
              </div>
            </div>

            <div className="rounded-lg border border-indigo-200 bg-white p-3">
              <p className="text-xs text-slate-500">Basis Final (Tindakan − Ranap Swasta − Tumbang)</p>
              <p className="text-lg font-bold text-indigo-700">{formatRupiah(basisFinal)}</p>
            </div>

            {laporanFinalResult && (
              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr><th className="text-left px-3 py-2">Nama</th><th className="text-right px-3 py-2">Nominal Hitungan</th><th className="text-right px-3 py-2">Nominal Transfer</th><th className="text-right px-3 py-2">Uang Makan</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {roster.filter((r) => r.is_active !== false).map((r) => {
                      const result = laporanFinalResult.perOrang[r.id];
                      const transfer = laporan?.final_transfers?.[r.id]?.nominal_transfer;
                      const uangMakan = transfer !== undefined && transfer !== '' ? Number(transfer) - (result?.nominalHitungan || 0) : null;
                      return (
                        <tr key={r.id}>
                          <td className="px-3 py-2 font-medium">{r.nama}{result?.isCapped && <span className="ml-1 text-[10px] text-amber-600">(dibatasi)</span>}</td>
                          <td className="px-3 py-2 text-right tabular-nums font-semibold">{formatRupiah(result?.nominalHitungan)}</td>
                          <td className="px-3 py-2 text-right">
                            <Input type="number" className="w-36 text-right ml-auto" value={transfer ?? ''} onChange={(e) => handleFinalTransferChange(r.id, e.target.value)} onBlur={() => handleSaveField('final_transfers')} />
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
                    <tr className="bg-slate-100 font-bold">
                      <td className="px-3 py-2">TOTAL</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatRupiah(laporanFinalResult.grandTotal)}</td>
                      <td colSpan={2}></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="tabungan-pajak" className="border border-slate-200 rounded-xl px-4 bg-white">
          <AccordionTrigger className="gap-2"><Wallet className="w-4 h-4" /> Tabungan Pajak — Penarikan Operasional</AccordionTrigger>
          <AccordionContent className="pb-4 space-y-4">
            <div className="flex flex-wrap items-end gap-2 bg-slate-50 border border-slate-200 rounded-xl p-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-500 block mb-1">Nominal</label>
                <Input type="number" className="w-40" value={tabunganForm.nominal} onChange={(e) => setTabunganForm((f) => ({ ...f, nominal: e.target.value }))} />
              </div>
              <div className="flex-1 min-w-[200px]">
                <label className="text-[11px] font-semibold text-slate-500 block mb-1">Keterangan</label>
                <Input value={tabunganForm.keterangan} onChange={(e) => setTabunganForm((f) => ({ ...f, keterangan: e.target.value }))} placeholder="Untuk apa" />
              </div>
              <Button size="sm" onClick={handleAddTabungan} className="gap-1.5"><Plus className="w-4 h-4" /> Catat</Button>
            </div>
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-500"><tr><th className="text-left px-3 py-2">Keterangan</th><th className="text-right px-3 py-2">Nominal</th><th className="w-10"></th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {tabungan.map((t) => (
                    <tr key={t.id}>
                      <td className="px-3 py-2">{t.keterangan || '-'}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatRupiah(t.nominal)}</td>
                      <td className="px-2 py-2 text-center"><button onClick={() => handleDeleteTabungan(t.id)} className="text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-sm font-bold text-slate-700">Total ditarik: {formatRupiah(totalTabunganPajak)}</p>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
};

export default InsentifBulananPage;
