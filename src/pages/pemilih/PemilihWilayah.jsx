import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Plus, Trash2, Pencil, Check, X } from 'lucide-react';

const DAPIL_KECAMATAN = 'Balikpapan Utara';

const PemilihWilayah = () => {
  const { toast } = useToast();
  const [dapilKecamatanId, setDapilKecamatanId] = useState(null);
  const [kelurahanList, setKelurahanList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newKelurahan, setNewKelurahan] = useState('');
  const [editId, setEditId] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    let { data: kec } = await supabase
      .from('pemilih_kecamatan')
      .select('id')
      .ilike('nama', DAPIL_KECAMATAN)
      .maybeSingle();

    if (!kec) {
      const { data: created } = await supabase
        .from('pemilih_kecamatan')
        .insert({ nama: DAPIL_KECAMATAN })
        .select('id')
        .single();
      kec = created;
    }
    if (kec) setDapilKecamatanId(kec.id);

    const { data: kel } = await supabase.from('pemilih_kelurahan').select('id, nama').order('nama');
    setKelurahanList(kel || []);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const addKelurahan = async () => {
    if (!newKelurahan.trim()) return;
    setSaving(true);
    const { error } = await supabase.from('pemilih_kelurahan').insert({
      nama: newKelurahan.trim(),
      kecamatan_id: dapilKecamatanId,
    });
    if (error) toast({ title: 'Gagal menambah', description: error.message, variant: 'destructive' });
    else { setNewKelurahan(''); fetchAll(); }
    setSaving(false);
  };

  const deleteKelurahan = async (id) => {
    if (!window.confirm('Hapus kelurahan/desa ini? Data pemilih yang terkait wilayah ini bisa terpengaruh.')) return;
    const { error } = await supabase.from('pemilih_kelurahan').delete().eq('id', id);
    if (error) toast({ title: 'Gagal menghapus', description: error.message, variant: 'destructive' });
    else fetchAll();
  };

  const startEdit = (id, value) => { setEditId(id); setEditValue(value); };

  const saveEdit = async () => {
    const { error } = await supabase.from('pemilih_kelurahan').update({ nama: editValue }).eq('id', editId);
    if (error) toast({ title: 'Gagal menyimpan', description: error.message, variant: 'destructive' });
    else { setEditId(null); fetchAll(); }
  };

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center' }}><Loader2 className="animate-spin" /></div>;
  }

  return (
    <div>
      <h1 className="p-page-title">Setup Wilayah</h1>
      <p className="p-page-subtitle">
        Kelola master data Kelurahan/Desa untuk pengelompokan data pemilih ({DAPIL_KECAMATAN}).
      </p>

      <div className="p-card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <input
            className="p-input"
            style={{ flex: 1, minWidth: 180 }}
            placeholder="Nama kelurahan/desa baru..."
            value={newKelurahan}
            onChange={(e) => setNewKelurahan(e.target.value)}
          />
          <button className="p-btn-primary" onClick={addKelurahan} disabled={saving || !dapilKecamatanId}>
            {saving ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />} Tambah
          </button>
        </div>
        {kelurahanList.length === 0 ? (
          <p style={{ color: '#94a3b8', fontSize: 13 }}>Belum ada data kelurahan.</p>
        ) : (
          <div className="p-table-wrap">
            <table className="p-table">
              <tbody>
                {kelurahanList.map((k) => (
                  <tr key={k.id}>
                    <td>
                      {editId === k.id ? (
                        <input className="p-input" value={editValue} onChange={(e) => setEditValue(e.target.value)} />
                      ) : k.nama}
                    </td>
                    <td style={{ textAlign: 'right', width: 100, whiteSpace: 'nowrap' }}>
                      {editId === k.id ? (
                        <>
                          <button onClick={saveEdit} style={{ marginRight: 8, color: '#16a34a' }}><Check size={16} /></button>
                          <button onClick={() => setEditId(null)} style={{ color: '#64748b' }}><X size={16} /></button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => startEdit(k.id, k.nama)} style={{ marginRight: 8, color: '#2563eb' }}><Pencil size={15} /></button>
                          <button onClick={() => deleteKelurahan(k.id)} style={{ color: '#dc2626' }}><Trash2 size={15} /></button>
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
    </div>
  );
};

export default PemilihWilayah;
