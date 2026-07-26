import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Plus, Trash2, KeyRound } from 'lucide-react';
import PemilihSelect from './PemilihSelect';

const DAPIL_KECAMATAN = 'Balikpapan Utara';
const inputStyle = { padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13.5 };

const emptyForm = { nama: '', no_hp: '', jabatan: '', kelurahan_id: '', target_suara: '', relawan_id: '' };

const PemilihTimSukses = () => {
  const { toast } = useToast();
  const [rows, setRows] = useState([]);
  const [dapilKecamatanId, setDapilKecamatanId] = useState(null);
  const [kelurahanList, setKelurahanList] = useState([]);
  const [relawanList, setRelawanList] = useState([]);
  const [relawanStats, setRelawanStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const fetchAll = async () => {
    setLoading(true);
    let { data: kec } = await supabase.from('pemilih_kecamatan').select('id').ilike('nama', DAPIL_KECAMATAN).maybeSingle();
    if (!kec) {
      const { data: created } = await supabase.from('pemilih_kecamatan').insert({ nama: DAPIL_KECAMATAN }).select('id').single();
      kec = created;
    }
    if (kec) setDapilKecamatanId(kec.id);

    const [{ data: r }, { data: kel }, { data: relawan }, { data: stats }] = await Promise.all([
      supabase.from('pemilih_tim_sukses').select('id, nama, no_hp, jabatan, target_suara, kelurahan_id, relawan_id, pemilih_kelurahan(nama), pemilih_relawan(nama, username, is_active)').order('created_at', { ascending: false }),
      supabase.from('pemilih_kelurahan').select('id, nama').order('nama'),
      supabase.from('pemilih_relawan').select('id, nama, no_hp, username, is_active').order('nama'),
      supabase.rpc('pemilih_relawan_contribution_stats'),
    ]);
    setRows(r || []);
    setKelurahanList(kel || []);
    setRelawanList(relawan || []);
    setRelawanStats(stats || []);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const relawanInputCount = useMemo(() => {
    const map = {};
    relawanStats.forEach((s) => { map[s.relawan_id] = Number(s.jumlah_input) || 0; });
    return map;
  }, [relawanStats]);

  const handlePickRelawan = (relawanId) => {
    const picked = relawanList.find((r) => r.id === relawanId);
    setForm((prev) => ({
      ...prev,
      relawan_id: relawanId,
      nama: picked ? picked.nama : prev.nama,
      no_hp: picked ? (picked.no_hp || '') : prev.no_hp,
    }));
  };

  const handleAdd = async () => {
    if (!form.nama.trim()) {
      toast({ title: 'Nama wajib diisi', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('pemilih_tim_sukses').insert({
      nama: form.nama.trim(),
      no_hp: form.no_hp || null,
      jabatan: form.jabatan || null,
      kecamatan_id: dapilKecamatanId,
      kelurahan_id: form.kelurahan_id || null,
      target_suara: form.target_suara ? parseInt(form.target_suara, 10) : 0,
      relawan_id: form.relawan_id || null,
    });
    if (error) toast({ title: 'Gagal menambah', description: error.message, variant: 'destructive' });
    else {
      setForm(emptyForm);
      fetchAll();
    }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Hapus data tim sukses ini?')) return;
    const { error } = await supabase.from('pemilih_tim_sukses').delete().eq('id', id);
    if (error) toast({ title: 'Gagal menghapus', description: error.message, variant: 'destructive' });
    else fetchAll();
  };

  return (
    <div>
      <h1 className="p-page-title">Tim Sukses & Relawan</h1>
      <p style={{ color: '#64748b', marginTop: 0, marginBottom: 24 }}>
        Kelola koordinator wilayah, relawan, dan target suara per orang. Kaitkan dengan akun login relawan
        (dibuat di <Link to="/pemilih/setup?tab=relawan" style={{ color: '#dc2626', fontWeight: 700 }}>Setup &gt; Akun Relawan</Link>)
        untuk melihat berapa data pemilih yang sudah mereka input.
      </p>

      <div className="p-card" style={{ padding: 20, marginBottom: 20 }}>
        <div className="p-grid-collapse" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          <PemilihSelect
            value={form.relawan_id}
            onChange={handlePickRelawan}
            options={relawanList.map((r) => ({ value: r.id, label: `${r.nama} (@${r.username})${r.is_active ? '' : ' — nonaktif'}` }))}
            allLabel="Tidak dikaitkan akun relawan"
            placeholder="Kaitkan Akun Relawan (opsional)"
            title="Pilih Akun Relawan"
          />
          <input style={inputStyle} placeholder="Nama" value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} />
          <input style={inputStyle} placeholder="No. HP" value={form.no_hp} onChange={(e) => setForm({ ...form, no_hp: e.target.value })} />
          <input style={inputStyle} placeholder="Jabatan (mis. Koordinator Kecamatan)" value={form.jabatan} onChange={(e) => setForm({ ...form, jabatan: e.target.value })} />
          <PemilihSelect
            value={form.kelurahan_id}
            onChange={(v) => setForm({ ...form, kelurahan_id: v })}
            options={kelurahanList.map((k) => ({ value: k.id, label: k.nama }))}
            allLabel="Pilih Kelurahan (opsional)"
            title="Pilih Kelurahan"
          />
          <input style={inputStyle} type="number" placeholder="Target suara" value={form.target_suara} onChange={(e) => setForm({ ...form, target_suara: e.target.value })} />
        </div>
        <button className="p-btn-primary" style={{ marginTop: 14 }} onClick={handleAdd} disabled={saving}>
          {saving ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />} Tambah Anggota
        </button>
      </div>

      <div className="p-card" style={{ overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center' }}><Loader2 className="animate-spin" /></div>
        ) : rows.length === 0 ? (
          <p style={{ padding: 24, color: '#94a3b8', fontSize: 13, textAlign: 'center' }}>Belum ada data tim sukses.</p>
        ) : (
          <div className="p-table-wrap">
            <table className="p-table">
              <thead>
                <tr>
                  <th>Nama</th>
                  <th>Jabatan</th>
                  <th>Wilayah</th>
                  <th>Akun Relawan</th>
                  <th style={{ textAlign: 'right' }}>Target Suara</th>
                  <th style={{ textAlign: 'right' }}>Data Diinput</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{r.nama}</div>
                      <div style={{ color: '#94a3b8', fontSize: 11.5 }}>{r.no_hp || '-'}</div>
                    </td>
                    <td style={{ color: '#475569' }}>{r.jabatan || '-'}</td>
                    <td style={{ color: '#475569' }}>
                      {r.pemilih_kelurahan?.nama || '-'}
                    </td>
                    <td>
                      {r.pemilih_relawan ? (
                        <span
                          className="p-badge"
                          style={{
                            background: r.pemilih_relawan.is_active ? '#ecfdf5' : '#f4f5f7',
                            color: r.pemilih_relawan.is_active ? '#059669' : '#6b7280',
                            fontFamily: 'monospace',
                          }}
                        >
                          <KeyRound size={11} /> @{r.pemilih_relawan.username}
                        </span>
                      ) : (
                        <span style={{ color: '#cbd5e1', fontSize: 12 }}>-</span>
                      )}
                    </td>
                    <td style={{ fontWeight: 700, textAlign: 'right' }}>{r.target_suara?.toLocaleString('id-ID') || 0}</td>
                    <td style={{ fontWeight: 700, textAlign: 'right', color: r.relawan_id ? '#1a1d29' : '#cbd5e1' }}>
                      {r.relawan_id ? (relawanInputCount[r.relawan_id] || 0).toLocaleString('id-ID') : '-'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button onClick={() => handleDelete(r.id)} style={{ color: '#dc2626' }}><Trash2 size={15} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default PemilihTimSukses;
