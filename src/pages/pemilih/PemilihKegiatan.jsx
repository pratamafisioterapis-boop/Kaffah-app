import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Plus, Trash2 } from 'lucide-react';

const JENIS_OPTIONS = ['Kunjungan Warga', 'Bantuan Sosial', 'Sosialisasi Program', 'Reses DPRD', 'Rapat Koordinasi', 'Lainnya'];
const inputStyle = { padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13.5 };

const PemilihKegiatan = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [rows, setRows] = useState([]);
  const [kecamatanList, setKecamatanList] = useState([]);
  const [kelurahanList, setKelurahanList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    judul: '', jenis_kegiatan: JENIS_OPTIONS[0], tanggal: new Date().toISOString().slice(0, 10),
    kecamatan_id: '', kelurahan_id: '', deskripsi: '',
  });

  const fetchAll = async () => {
    setLoading(true);
    const [{ data: r }, { data: kec }, { data: kel }] = await Promise.all([
      supabase.from('pemilih_kegiatan').select('id, judul, jenis_kegiatan, tanggal, deskripsi, kecamatan_id, kelurahan_id, pemilih_kecamatan(nama), pemilih_kelurahan(nama)').order('tanggal', { ascending: false }).limit(200),
      supabase.from('pemilih_kecamatan').select('id, nama').order('nama'),
      supabase.from('pemilih_kelurahan').select('id, nama, kecamatan_id').order('nama'),
    ]);
    setRows(r || []);
    setKecamatanList(kec || []);
    setKelurahanList(kel || []);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const filteredKelurahan = kelurahanList.filter((k) => k.kecamatan_id === form.kecamatan_id);

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
      kecamatan_id: form.kecamatan_id || null,
      kelurahan_id: form.kelurahan_id || null,
      deskripsi: form.deskripsi || null,
      petugas_id: user.id,
    });
    if (error) toast({ title: 'Gagal menambah', description: error.message, variant: 'destructive' });
    else {
      setForm({ judul: '', jenis_kegiatan: JENIS_OPTIONS[0], tanggal: new Date().toISOString().slice(0, 10), kecamatan_id: '', kelurahan_id: '', deskripsi: '' });
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          <input style={inputStyle} placeholder="Judul kegiatan" value={form.judul} onChange={(e) => setForm({ ...form, judul: e.target.value })} />
          <select style={inputStyle} value={form.jenis_kegiatan} onChange={(e) => setForm({ ...form, jenis_kegiatan: e.target.value })}>
            {JENIS_OPTIONS.map((j) => <option key={j} value={j}>{j}</option>)}
          </select>
          <input style={inputStyle} type="date" value={form.tanggal} onChange={(e) => setForm({ ...form, tanggal: e.target.value })} />
          <select style={inputStyle} value={form.kecamatan_id} onChange={(e) => setForm({ ...form, kecamatan_id: e.target.value, kelurahan_id: '' })}>
            <option value="">Pilih Kecamatan</option>
            {kecamatanList.map((k) => <option key={k.id} value={k.id}>{k.nama}</option>)}
          </select>
          <select style={inputStyle} value={form.kelurahan_id} onChange={(e) => setForm({ ...form, kelurahan_id: e.target.value })} disabled={!form.kecamatan_id}>
            <option value="">Pilih Kelurahan (opsional)</option>
            {filteredKelurahan.map((k) => <option key={k.id} value={k.id}>{k.nama}</option>)}
          </select>
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
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                <th style={{ textAlign: 'left', padding: '10px 12px', color: '#64748b', fontSize: 11.5 }}>Tanggal</th>
                <th style={{ textAlign: 'left', padding: '10px 12px', color: '#64748b', fontSize: 11.5 }}>Kegiatan</th>
                <th style={{ textAlign: 'left', padding: '10px 12px', color: '#64748b', fontSize: 11.5 }}>Wilayah</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', color: '#475569' }}>{r.tanggal}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ fontWeight: 600 }}>{r.judul}</div>
                    <div style={{ color: '#94a3b8', fontSize: 11.5 }}>{r.jenis_kegiatan}{r.deskripsi ? ` — ${r.deskripsi}` : ''}</div>
                  </td>
                  <td style={{ padding: '10px 12px', color: '#475569' }}>
                    {r.pemilih_kelurahan?.nama ? `${r.pemilih_kelurahan.nama}, ` : ''}{r.pemilih_kecamatan?.nama || '-'}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                    <button onClick={() => handleDelete(r.id)} style={{ color: '#dc2626' }}><Trash2 size={15} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default PemilihKegiatan;