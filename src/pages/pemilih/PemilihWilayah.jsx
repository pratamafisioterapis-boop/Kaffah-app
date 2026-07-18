import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Plus, Trash2, Pencil, Check, X } from 'lucide-react';

const inputStyle = { padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13.5 };

const PemilihWilayah = () => {
  const { toast } = useToast();
  const [tab, setTab] = useState('kecamatan');
  const [kecamatanList, setKecamatanList] = useState([]);
  const [kelurahanList, setKelurahanList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newKecamatan, setNewKecamatan] = useState('');
  const [newKelurahan, setNewKelurahan] = useState({ nama: '', kecamatan_id: '' });
  const [editId, setEditId] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    const [{ data: kec }, { data: kel }] = await Promise.all([
      supabase.from('pemilih_kecamatan').select('id, nama').order('nama'),
      supabase.from('pemilih_kelurahan').select('id, nama, kecamatan_id').order('nama'),
    ]);
    setKecamatanList(kec || []);
    setKelurahanList(kel || []);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const kecamatanMap = Object.fromEntries(kecamatanList.map((k) => [k.id, k.nama]));

  const addKecamatan = async () => {
    if (!newKecamatan.trim()) return;
    setSaving(true);
    const { error } = await supabase.from('pemilih_kecamatan').insert({ nama: newKecamatan.trim() });
    if (error) toast({ title: 'Gagal menambah', description: error.message, variant: 'destructive' });
    else { setNewKecamatan(''); fetchAll(); }
    setSaving(false);
  };

  const addKelurahan = async () => {
    if (!newKelurahan.nama.trim() || !newKelurahan.kecamatan_id) {
      toast({ title: 'Pilih kecamatan dan isi nama kelurahan', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('pemilih_kelurahan').insert({
      nama: newKelurahan.nama.trim(),
      kecamatan_id: newKelurahan.kecamatan_id,
    });
    if (error) toast({ title: 'Gagal menambah', description: error.message, variant: 'destructive' });
    else { setNewKelurahan({ nama: '', kecamatan_id: '' }); fetchAll(); }
    setSaving(false);
  };

  const deleteItem = async (table, id) => {
    if (!window.confirm('Hapus data ini? Data pemilih yang terkait wilayah ini bisa terpengaruh.')) return;
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) toast({ title: 'Gagal menghapus', description: error.message, variant: 'destructive' });
    else fetchAll();
  };

  const startEdit = (id, value) => { setEditId(id); setEditValue(value); };

  const saveEdit = async (table) => {
    const { error } = await supabase.from(table).update({ nama: editValue }).eq('id', editId);
    if (error) toast({ title: 'Gagal menyimpan', description: error.message, variant: 'destructive' });
    else { setEditId(null); fetchAll(); }
  };

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center' }}><Loader2 className="animate-spin" /></div>;
  }

  return (
    <div>
      <h1 className="p-page-title">Setup Wilayah</h1>
      <p style={{ color: '#64748b', marginTop: 0, marginBottom: 24 }}>
        Kelola master data Kecamatan dan Kelurahan/Desa untuk pengelompokan data pemilih.
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {['kecamatan', 'kelurahan'].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '8px 16px', borderRadius: 8,
              border: '1px solid ' + (tab === t ? '#dc2626' : '#cbd5e1'),
              background: tab === t ? '#dc2626' : '#fff',
              color: tab === t ? '#fff' : '#334155',
              fontWeight: 600, fontSize: 13, cursor: 'pointer',
            }}
          >
            {t === 'kecamatan' ? 'Kecamatan' : 'Kelurahan / Desa'}
          </button>
        ))}
      </div>

      {tab === 'kecamatan' && (
        <div className="p-card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <input style={{ ...inputStyle, flex: 1 }} placeholder="Nama kecamatan baru..." value={newKecamatan} onChange={(e) => setNewKecamatan(e.target.value)} />
            <button className="p-btn-primary" onClick={addKecamatan} disabled={saving}><Plus size={16} /> Tambah</button>
          </div>
          {kecamatanList.length === 0 ? (
            <p style={{ color: '#94a3b8', fontSize: 13 }}>Belum ada data kecamatan.</p>
          ) : (
            <div className="p-table-wrap">
              <table className="p-table">
                <tbody>
                  {kecamatanList.map((k) => (
                    <tr key={k.id}>
                      <td>
                        {editId === k.id ? (
                          <input style={inputStyle} value={editValue} onChange={(e) => setEditValue(e.target.value)} />
                        ) : k.nama}
                      </td>
                      <td style={{ textAlign: 'right', width: 100, whiteSpace: 'nowrap' }}>
                        {editId === k.id ? (
                          <>
                            <button onClick={() => saveEdit('pemilih_kecamatan')} style={{ marginRight: 8, color: '#16a34a' }}><Check size={16} /></button>
                            <button onClick={() => setEditId(null)} style={{ color: '#64748b' }}><X size={16} /></button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => startEdit(k.id, k.nama)} style={{ marginRight: 8, color: '#2563eb' }}><Pencil size={15} /></button>
                            <button onClick={() => deleteItem('pemilih_kecamatan', k.id)} style={{ color: '#dc2626' }}><Trash2 size={15} /></button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'kelurahan' && (
        <div className="p-card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            <select style={{ ...inputStyle, minWidth: 180 }} value={newKelurahan.kecamatan_id} onChange={(e) => setNewKelurahan({ ...newKelurahan, kecamatan_id: e.target.value })}>
              <option value="">Pilih Kecamatan</option>
              {kecamatanList.map((k) => <option key={k.id} value={k.id}>{k.nama}</option>)}
            </select>
            <input style={{ ...inputStyle, flex: 1, minWidth: 180 }} placeholder="Nama kelurahan/desa baru..." value={newKelurahan.nama} onChange={(e) => setNewKelurahan({ ...newKelurahan, nama: e.target.value })} />
            <button className="p-btn-primary" onClick={addKelurahan} disabled={saving}><Plus size={16} /> Tambah</button>
          </div>
          {kelurahanList.length === 0 ? (
            <p style={{ color: '#94a3b8', fontSize: 13 }}>Belum ada data kelurahan.</p>
          ) : (
            <div className="p-table-wrap">
              <table className="p-table">
                <thead>
                  <tr>
                    <th>Kelurahan/Desa</th>
                    <th>Kecamatan</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {kelurahanList.map((k) => (
                    <tr key={k.id}>
                      <td>
                        {editId === k.id ? (
                          <input style={inputStyle} value={editValue} onChange={(e) => setEditValue(e.target.value)} />
                        ) : k.nama}
                      </td>
                      <td style={{ color: '#64748b' }}>{kecamatanMap[k.kecamatan_id] || '-'}</td>
                      <td style={{ textAlign: 'right', width: 100, whiteSpace: 'nowrap' }}>
                        {editId === k.id ? (
                          <>
                            <button onClick={() => saveEdit('pemilih_kelurahan')} style={{ marginRight: 8, color: '#16a34a' }}><Check size={16} /></button>
                            <button onClick={() => setEditId(null)} style={{ color: '#64748b' }}><X size={16} /></button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => startEdit(k.id, k.nama)} style={{ marginRight: 8, color: '#2563eb' }}><Pencil size={15} /></button>
                            <button onClick={() => deleteItem('pemilih_kelurahan', k.id)} style={{ color: '#dc2626' }}><Trash2 size={15} /></button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PemilihWilayah;