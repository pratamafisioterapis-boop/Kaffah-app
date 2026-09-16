import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { fetchAllRows } from '@/lib/supabasePaginate';
import { bumpTpsCountIfNeeded } from '@/lib/pemilihTpsCount';
import { PKS_ELECTION_YEARS } from '@/data/electionYears';
import PemilihSelect from './PemilihSelect';
import { Loader2, Plus, Save, Users, Table2, X } from 'lucide-react';

const DEFAULT_PARTY = 'Partai Keadilan Sejahtera';

const CardHeader = ({ title, subtitle, icon: Icon, iconColor, iconBg }) => (
  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 18 }}>
    {Icon && (
      <div style={{ width: 30, height: 30, borderRadius: 9, background: iconBg, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
        <Icon size={15} color={iconColor} />
      </div>
    )}
    <div>
      <h3 style={{ margin: 0, fontSize: 14.5, fontWeight: 700, color: '#1a1d29', letterSpacing: '-0.01em' }}>{title}</h3>
      {subtitle && <p style={{ margin: '3px 0 0', fontSize: 11.5, color: '#9ca3af' }}>{subtitle}</p>}
    </div>
  </div>
);

// Input manual penuh (tanpa PDF/OCR sama sekali), sama untuk semua partai:
// tentukan daftar caleg + jumlah TPS untuk satu kelurahan, lalu isi angka
// suara tiap caleg per TPS langsung di satu tabel grid. Awalnya cuma
// tersedia untuk PKS (PksManualInput) — dipisah ke sini & diparameterkan
// dengan `party` supaya "Partai Lain (DPC)" dan akun DPC dapat alur yang
// sama persis, bukan cuma form tambah-satu-TPS (lihat PemilihTpsInputByParty).
const PemilihManualInputByParty = ({
  kelurahanList, calegMasterRows, knownYears, defaultYear, party, onSaved, toast,
}) => {
  const activeParty = party || DEFAULT_PARTY;

  const [kelurahanId, setKelurahanId] = useState('');
  const [electionYear, setElectionYear] = useState(defaultYear);
  useEffect(() => { if (defaultYear) setElectionYear(defaultYear); }, [defaultYear]);
  useEffect(() => {
    // kelurahanList berubah kalau dapil/partai aktif diganti — kalau kelurahan
    // yang sedang dipilih bukan lagi milik daftar ini, pindah ke pilihan
    // pertama yang valid supaya input manual tidak diam-diam tersimpan ke
    // kelurahan yang salah.
    if (kelurahanList.length === 0) { if (kelurahanId) setKelurahanId(''); return; }
    if (!kelurahanList.some((k) => k.id === kelurahanId)) setKelurahanId(kelurahanList[0].id);
  }, [kelurahanList, kelurahanId]);

  // Tahun di dropdown selalu dimulai dari PKS_ELECTION_YEARS (periode pemilu
  // yang nyata) supaya semua dapil/partai menawarkan 2019 & 2024 walau belum
  // punya data/roster sama sekali — sama seperti Setup Dapil & Input Suara
  // per TPS.
  const yearOptions = useMemo(() => {
    const years = new Set(PKS_ELECTION_YEARS);
    (calegMasterRows || []).forEach((c) => years.add(c.election_year));
    (knownYears || []).forEach((y) => years.add(y));
    return Array.from(years).sort((a, b) => b - a);
  }, [calegMasterRows, knownYears]);

  const candidateMasterList = useMemo(
    () => (calegMasterRows || [])
      .filter((c) => c.election_year === electionYear && (c.party_name || DEFAULT_PARTY) === activeParty)
      .sort((a, b) => a.candidate_number - b.candidate_number)
      .map((c) => ({ number: c.candidate_number, name: c.candidate_name })),
    [calegMasterRows, electionYear, activeParty]
  );

  const [candidates, setCandidates] = useState([]);
  const [jumlahTps, setJumlahTps] = useState(1);
  const [votes, setVotes] = useState({});
  const [loadingExisting, setLoadingExisting] = useState(false);
  const [saving, setSaving] = useState(false);
  const nextIdRef = useRef(1);
  const newCandidateId = () => `c${nextIdRef.current++}`;

  // Setiap ganti kelurahan/tahun/partai: kalau kombinasi ini sudah punya
  // rincian per TPS (dari upload PDF, input satuan, maupun input manual
  // sebelumnya), muat itu untuk dikoreksi. Kalau belum ada sama sekali,
  // mulai dari daftar caleg yang sudah terdaftar di roster tahun ini supaya
  // nama caleg tidak perlu diketik ulang.
  useEffect(() => {
    if (!kelurahanId || !electionYear) return;
    let cancelled = false;
    setLoadingExisting(true);
    fetchAllRows(() =>
      supabase
        .from('pemilih_suara_caleg_tps')
        .select('tps_number, candidate_number, candidate_name, votes')
        .eq('kelurahan_id', kelurahanId)
        .eq('election_year', electionYear)
        .eq('party_name', activeParty)
        .order('tps_number')
    )
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          toast({ variant: 'destructive', title: 'Gagal memuat data existing', description: error.message });
          setLoadingExisting(false);
          return;
        }
        const existingRows = data || [];
        if (existingRows.length > 0) {
          const candMap = new Map();
          let maxTps = 1;
          existingRows.forEach((r) => {
            if (r.candidate_number !== 0 && !candMap.has(r.candidate_number)) {
              candMap.set(r.candidate_number, { id: `n${r.candidate_number}`, number: r.candidate_number, name: r.candidate_name || '' });
            }
            if (r.tps_number > maxTps) maxTps = r.tps_number;
          });
          const newVotes = {};
          existingRows.forEach((r) => {
            const id = r.candidate_number === 0 ? 'party' : `n${r.candidate_number}`;
            newVotes[`${id}::${r.tps_number}`] = String(r.votes ?? '');
          });
          setCandidates(Array.from(candMap.values()).sort((a, b) => a.number - b.number));
          setJumlahTps(maxTps);
          setVotes(newVotes);
        } else {
          const seeded = candidateMasterList.map((c) => ({ id: `n${c.number}`, number: c.number, name: c.name || '' }));
          setCandidates(seeded);
          setJumlahTps(1);
          setVotes({});
        }
        setLoadingExisting(false);
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kelurahanId, electionYear, activeParty]);

  const addCandidate = () => {
    const maxNum = candidates.reduce((m, c) => Math.max(m, Number(c.number) || 0), 0);
    setCandidates((prev) => [...prev, { id: newCandidateId(), number: maxNum + 1, name: '' }]);
  };

  const removeCandidate = (id) => {
    setCandidates((prev) => prev.filter((c) => c.id !== id));
    setVotes((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((k) => { if (k.startsWith(`${id}::`)) delete next[k]; });
      return next;
    });
  };

  const updateCandidate = (id, field, value) => {
    setCandidates((prev) => prev.map((c) => (c.id === id ? { ...c, [field]: value } : c)));
  };

  const setVote = (candId, tps, value) => {
    setVotes((prev) => ({ ...prev, [`${candId}::${tps}`]: value }));
  };

  const columnIds = useMemo(() => ['party', ...candidates.map((c) => c.id)], [candidates]);
  const tpsNumbers = useMemo(() => Array.from({ length: Math.max(0, Number(jumlahTps) || 0) }, (_, i) => i + 1), [jumlahTps]);

  const rowTotals = useMemo(() => {
    const out = {};
    tpsNumbers.forEach((tps) => {
      out[tps] = columnIds.reduce((sum, id) => sum + (Number(votes[`${id}::${tps}`]) || 0), 0);
    });
    return out;
  }, [votes, columnIds, tpsNumbers]);

  const columnTotals = useMemo(() => {
    const out = {};
    columnIds.forEach((id) => {
      out[id] = tpsNumbers.reduce((sum, tps) => sum + (Number(votes[`${id}::${tps}`]) || 0), 0);
    });
    return out;
  }, [votes, columnIds, tpsNumbers]);

  const grandTotal = useMemo(() => columnIds.reduce((s, id) => s + (columnTotals[id] || 0), 0), [columnIds, columnTotals]);

  const selectedKelurahanName = kelurahanList.find((k) => k.id === kelurahanId)?.nama || '';

  const handleSave = async () => {
    if (!kelurahanId) { toast({ variant: 'destructive', title: 'Pilih kelurahan dulu' }); return; }
    if (candidates.length === 0) { toast({ variant: 'destructive', title: 'Tambahkan minimal satu caleg' }); return; }
    const numbers = candidates.map((c) => Number(c.number));
    if (numbers.some((n) => !n || n <= 0)) { toast({ variant: 'destructive', title: 'Ada nomor urut caleg yang tidak valid' }); return; }
    if (new Set(numbers).size !== numbers.length) { toast({ variant: 'destructive', title: 'Ada nomor urut caleg yang duplikat' }); return; }
    if (candidates.some((c) => !c.name.trim())) { toast({ variant: 'destructive', title: 'Nama caleg tidak boleh kosong' }); return; }
    if (!jumlahTps || jumlahTps < 1) { toast({ variant: 'destructive', title: 'Jumlah TPS tidak valid' }); return; }

    setSaving(true);
    const { data: authData } = await supabase.auth.getUser();
    const allCandidates = [
      { id: 'party', number: 0, name: null },
      ...candidates.map((c) => ({ id: c.id, number: Number(c.number), name: c.name.trim() })),
    ];

    const totalsPayload = allCandidates.map((c) => ({
      kelurahan_id: kelurahanId,
      party_name: activeParty,
      candidate_number: c.number,
      candidate_name: c.name,
      total_suara: columnTotals[c.id] || 0,
      source_file_name: null,
      sheet_info: null,
      election_year: electionYear,
      updated_by: authData?.user?.id || null,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabase.from('pemilih_suara_caleg').upsert(totalsPayload, { onConflict: 'kelurahan_id,party_name,candidate_number,election_year' });
    if (error) {
      setSaving(false);
      toast({ variant: 'destructive', title: 'Gagal menyimpan total', description: error.message });
      return;
    }

    const tpsPayload = [];
    allCandidates.forEach((c) => {
      tpsNumbers.forEach((tps) => {
        tpsPayload.push({
          kelurahan_id: kelurahanId,
          tps_number: tps,
          party_name: activeParty,
          candidate_number: c.number,
          candidate_name: c.name,
          votes: Number(votes[`${c.id}::${tps}`]) || 0,
          election_year: electionYear,
        });
      });
    });
    for (let i = 0; i < tpsPayload.length; i += 500) {
      const { error: tpsError } = await supabase
        .from('pemilih_suara_caleg_tps')
        .upsert(tpsPayload.slice(i, i + 500), { onConflict: 'kelurahan_id,party_name,tps_number,candidate_number,election_year' });
      if (tpsError) {
        setSaving(false);
        toast({ variant: 'destructive', title: 'Total tersimpan, tapi rincian per TPS gagal', description: tpsError.message });
        onSaved?.();
        return;
      }
    }

    if (tpsNumbers.length > 0) {
      bumpTpsCountIfNeeded(kelurahanId, electionYear, Math.max(...tpsNumbers));
    }
    setSaving(false);
    toast({ title: 'Data tersimpan', description: `${candidates.length} caleg × ${jumlahTps} TPS untuk ${selectedKelurahanName} tersimpan.` });
    onSaved?.();
  };

  return (
    <div>
      <div className="p-card" style={{ padding: 20, marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <label className="p-label">Kelurahan</label>
            <PemilihSelect
              value={kelurahanId}
              onChange={setKelurahanId}
              options={kelurahanList.map((k) => ({ value: k.id, label: k.nama }))}
              placeholder="Pilih Kelurahan"
              title="Pilih Kelurahan"
            />
          </div>
          <div style={{ width: 140 }}>
            <label className="p-label">Tahun Pemilu</label>
            <PemilihSelect
              value={String(electionYear)}
              onChange={(v) => setElectionYear(Number(v))}
              options={yearOptions.map((y) => ({ value: String(y), label: String(y) }))}
              title="Pilih Tahun"
            />
          </div>
          <div style={{ width: 140 }}>
            <label className="p-label">Jumlah TPS</label>
            <input
              type="number" className="p-input" min={1} max={200}
              value={jumlahTps}
              onChange={(e) => setJumlahTps(Math.max(1, Number(e.target.value) || 1))}
              disabled={loadingExisting}
            />
          </div>
        </div>
        <p style={{ margin: '14px 0 0', fontSize: 11.5, color: '#9ca3af' }}>
          Tentukan jumlah TPS di kelurahan ini, lalu isi jumlah suara tiap caleg per TPS di tabel bawah. Data ini langsung tersimpan sebagai rincian per TPS — tidak perlu upload PDF.
        </p>
      </div>

      <div className="p-card" style={{ padding: 24, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <CardHeader title={`Daftar Caleg — ${activeParty}`} subtitle="Nomor urut & nama caleg yang suaranya akan diinput" icon={Users} iconColor="#2563eb" iconBg="#eff6ff" />
          <button className="p-btn-ghost" onClick={addCandidate} style={{ flexShrink: 0 }}>
            <Plus size={14} /> Tambah Caleg
          </button>
        </div>
        {candidates.length === 0 ? (
          <p style={{ color: '#9ca3af', fontSize: 13, textAlign: 'center', padding: '16px 0' }}>Belum ada caleg. Klik "Tambah Caleg" untuk mulai.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {candidates.map((c) => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input
                  type="number" className="p-input" style={{ width: 80 }} min={1}
                  value={c.number}
                  onChange={(e) => updateCandidate(c.id, 'number', e.target.value)}
                  placeholder="No."
                />
                <input
                  type="text" className="p-input" style={{ flex: 1 }}
                  value={c.name}
                  onChange={(e) => updateCandidate(c.id, 'name', e.target.value)}
                  placeholder="Nama caleg"
                />
                <button onClick={() => removeCandidate(c.id)} style={{ color: '#dc2626', padding: 6, flexShrink: 0 }} title="Hapus caleg">
                  <X size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="p-card" style={{ padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <CardHeader
            title={`Suara per TPS — ${selectedKelurahanName || '...'}`}
            subtitle={`${tpsNumbers.length} TPS × ${candidates.length} caleg`}
            icon={Table2} iconColor="#ea580c" iconBg="#fff7ed"
          />
          <button className="p-btn-primary" style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)', flexShrink: 0 }} onClick={handleSave} disabled={saving || loadingExisting || !kelurahanId}>
            {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} Simpan
          </button>
        </div>

        {loadingExisting ? (
          <div style={{ padding: 50, textAlign: 'center' }}><Loader2 className="animate-spin" size={26} color="#ea580c" /></div>
        ) : (
          <div className="p-table-wrap">
            <table className="p-table">
              <thead>
                <tr>
                  <th>TPS</th>
                  <th style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>Partai</th>
                  {candidates.map((c) => (
                    <th key={c.id} style={{ textAlign: 'center', whiteSpace: 'nowrap' }} title={c.name}>
                      {c.number}. {c.name || '(tanpa nama)'}
                    </th>
                  ))}
                  <th style={{ textAlign: 'center' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {tpsNumbers.map((tps) => (
                  <tr key={tps}>
                    <td style={{ fontWeight: 700 }}>{String(tps).padStart(2, '0')}</td>
                    <td style={{ textAlign: 'center' }}>
                      <input
                        type="number" className="p-input" style={{ width: 72, textAlign: 'right' }} min={0}
                        value={votes[`party::${tps}`] ?? ''}
                        onChange={(e) => setVote('party', tps, e.target.value)}
                      />
                    </td>
                    {candidates.map((c) => (
                      <td key={c.id} style={{ textAlign: 'center' }}>
                        <input
                          type="number" className="p-input" style={{ width: 72, textAlign: 'right' }} min={0}
                          value={votes[`${c.id}::${tps}`] ?? ''}
                          onChange={(e) => setVote(c.id, tps, e.target.value)}
                        />
                      </td>
                    ))}
                    <td style={{ textAlign: 'center', fontWeight: 800 }}>{rowTotals[tps].toLocaleString('id-ID')}</td>
                  </tr>
                ))}
                <tr>
                  <td style={{ fontWeight: 800 }}>Total</td>
                  <td style={{ textAlign: 'center', fontWeight: 800 }}>{(columnTotals.party || 0).toLocaleString('id-ID')}</td>
                  {candidates.map((c) => (
                    <td key={c.id} style={{ textAlign: 'center', fontWeight: 800 }}>{(columnTotals[c.id] || 0).toLocaleString('id-ID')}</td>
                  ))}
                  <td style={{ textAlign: 'center', fontWeight: 800 }}>{grandTotal.toLocaleString('id-ID')}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
        <p style={{ margin: '10px 0 0', fontSize: 10.5, color: '#9ca3af' }}>
          Kolom "Partai" adalah suara partai tanpa calon. Kosongkan sel kalau tidak ada suara — akan tersimpan sebagai 0.
        </p>
      </div>
    </div>
  );
};

export default PemilihManualInputByParty;
