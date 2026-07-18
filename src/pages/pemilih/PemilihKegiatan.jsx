import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import PemilihSelect from './PemilihSelect';

const DAPIL_KECAMATAN = 'Balikpapan Utara';
const JENIS_OPTIONS = ['Kunjungan Warga', 'Bantuan Sosial', 'Sosialisasi Program', 'Reses DPRD', 'Rapat Koordinasi', 'Lainnya'];
const inputStyle = { padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13.5 };

const PemilihKegiatan = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [rows, setRows] = useState([]);
  const [dapilKecamatanId, setDapilKecamatanId] = useState(null);
  const [kelurahanList, setKelurahanList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    judul: '', jenis_kegiatan: JENIS_OPTIONS[0], tanggal: new Date().toISOString().slice(0, 10),
    kelurahan_id: '', deskripsi: '',
  });

  const fetchAll = async () => {
    setLoading(true);
    let { data: kec } = await supabase.from('pemilih_kecamatan').select('id').ilike('nama', DAPIL_KECAMATAN).maybeSingle();
    if (!kec) {
      const { data: created } = await supabase.from('pemilih_kecamatan').insert({ nama: DAPIL_KECAMATAN }).select('id').single();
      kec = created;
    }
    if (kec) setDapilKecamatanId(kec.id);

    const [{ data: r }, { data: kel }] = await Promise.all([
      supabase.from('pemilih_kegiatan').select('id, judul, jenis_kegiatan, tanggal, deskripsi, kelurahan_id, pemilih_kelurahan(nama)').order('tanggal', { ascending: false }).limit(200),
      supabase.from('pemilih_kelurahan').select('id, nama').order('nama'),
    ]);
    setRows(r || []);
    setKelurahanList(kel || []);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const handleAdd = async () => {
    if (!form.judul.trim()) {
      toast({ title: 'Judul kegiatan wajib diisi', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('pemilih_kegiatan').insert({
      judul: form.judul.trim(),
      jenis_kegiatan: form.jenis_kegiatan,
      tanggal: form.tanggal,
      kecamatan_id: dapilKecamatanId,
      kelurahan_id: form.kelurahan_id || null,
      deskripsi: form.deskripsi || null,
      petugas_id: user.id,
    });
    if (error) toast({ title: 'Gagal menambah', description: error.message, variant: 'destructive' });
    else {
      setForm({ judul: '', jenis_kegiatan: JENIS_OPTIONS[0], tanggal: new Date().toISOString().slice(0, 10), kelurahan_id: '', deskripsi: '' });
      fetchAll();
    }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Hapus log kegiatan ini?')) return;
    const { error } = await supabase.from('pemilih_kegiatan').delete().eq('id', id);
    if (error) toast({ title: 'Gagal menghapus', description: error.message, variant: 'destructive' });
    else fetchAll();
  };

  return (
    <div>
      <h1 className="p-page-title">Log Kegiatan</h1>
      <p style={{ color: '#64748b', marginTop: 0, marginBottom: 24 }}>
        Catat kunjungan, reses, bantuan sosial, dan kegiatan lain per wilayah untuk bahan evaluasi strategi.
      </p>

      <div className="p-card" style={{ padding: 20, marginBottom: 20 }}>
        <div className="p-grid-collapse" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          <input style={inputStyle} placeholder="Judul kegiatan" value={form.judul} onChange={(e) => setForm({ ...form, judul: e.target.value })} />
          <select style={inputStyle} value={form.jenis_kegiatan} onChange={(e) => setForm({ ...form, jenis_kegiatan: e.target.value })}>
            {JENIS_OPTIONS.map((j) => <option key={j} value={j}>{j}</option>)}
          </select>
          <input style={inputStyle} type="date" value={form.tanggal} onChange={(e) => setForm({ ...form, tanggal: e.target.value })} />
          <PemilihSelect
            value={form.kelurahan_id}
            onChange={(v) => setForm({ ...form, kelurahan_id: v })}
            options={kelurahanList.map((k) => ({ value: k.id, label: k.nama }))}
            allLabel="Pilih Kelurahan (opsional)"
            title="Pilih Kelurahan"
          />
          <input style={{ ...inputStyle, gridColumn: '1 / -1' }} placeholder="Deskripsi singkat..." value={form.deskripsi} onChange={(e) => setForm({ ...form, deskripsi: e.target.value })} />
        </div>
        <button className="p-btn-primary" style={{ marginTop: 14 }} onClick={handleAdd} disabled={saving}>
          {saving ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />} Tambah Kegiatan
        </button>
      </div>

      <div className="p-card" style={{ overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center' }}><Loader2 className="animate-spin" /></div>
        ) : rows.length === 0 ? (
          <p style={{ padding: 24, color: '#94a3b8', fontSize: 13, textAlign: 'center' }}>Belum ada log kegiatan.</p>
        ) : (
          <div className="p-table-wrap">
            <table className="p-table">
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Kegiatan</th>
                  <th>Wilayah</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td style={{ whiteSpace: 'nowrap', color: '#475569' }}>{r.tanggal}</td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{r.judul}</div>
                      <div style={{ color: '#94a3b8', fontSize: 11.5 }}>{r.jenis_kegiatan}{r.deskripsi ? ` — ${r.deskripsi}` : ''}</div>
                    </td>
                    <td style={{ color: '#475569' }}>
                      {r.pemilih_kelurahan?.nama || '-'}
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

export default PemilihKegiatan;