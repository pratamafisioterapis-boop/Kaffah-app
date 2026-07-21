import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Search, Pencil, Trash2, X, Check, CreditCard, ImageOff, Download, Users } from 'lucide-react';
import PemilihSelect from './PemilihSelect';

const KATEGORI_LABEL = {
  pendukung: { label: 'Pendukung', color: '#16a34a', bg: '#f0fdf4' },
  simpatisan: { label: 'Simpatisan', color: '#2563eb', bg: '#eff6ff' },
  netral: { label: 'Netral', color: '#6b7280', bg: '#f9fafb' },
  tidak_mendukung: { label: 'Tidak Mendukung', color: '#dc2626', bg: '#fef2f2' },
  belum_diketahui: { label: 'Belum Diketahui', color: '#d97706', bg: '#fffbeb' },
};

const PemilihData = () => {
  const { toast } = useToast();
  const [rows, setRows] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterKelurahan, setFilterKelurahan] = useState('');
  const [filterKategori, setFilterKategori] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const [kelurahanList, setKelurahanList] = useState([]);
  const [editRow, setEditRow] = useState(null);
  const [saving, setSaving] = useState(false);
  const [viewingKtp, setViewingKtp] = useState(null);

  useEffect(() => {
    supabase.from('pemilih_kelurahan').select('id, nama').order('nama').then(({ data }) => setKelurahanList(data || []));
  }, []);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    let query = supabase
      .from('pemilih_data')
      .select('id, nama, nik, jenis_kelamin, alamat, rt, rw, no_hp, kategori_dukungan, tps, foto_ktp_path, pemilih_kelurahan(nama)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (search.trim()) {
      const escaped = search.trim().replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      const pattern = `"%${escaped}%"`;
      query = query.or(`nama.ilike.${pattern},nik.ilike.${pattern}`);
    }
    if (filterKelurahan) query = query.eq('kelurahan_id', filterKelurahan);
    if (filterKategori) query = query.eq('kategori_dukungan', filterKategori);

    const { data, error, count } = await query;
    if (!error) { setRows(data || []); setTotalCount(count || 0); }
    setLoading(false);
  }, [page, search, filterKelurahan, filterKategori]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const openEdit = (row) => setEditRow({ ...row });

  const saveEdit = async () => {
    setSaving(true);
    const { error } = await supabase.from('pemilih_data').update({
      nama: editRow.nama,
      nik: editRow.nik,
      no_hp: editRow.no_hp,
      alamat: editRow.alamat,
      rt: editRow.rt,
      rw: editRow.rw,
      tps: editRow.tps,
      kategori_dukungan: editRow.kategori_dukungan,
    }).eq('id', editRow.id);
    if (error) toast({ title: 'Gagal menyimpan', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Data diperbarui' }); setEditRow(null); fetchRows(); }
    setSaving(false);
  };

  const deleteRow = async (id) => {
    if (!window.confirm('Hapus data pemilih ini secara permanen?')) return;
    const row = rows.find((r) => r.id === id);
    const { error } = await supabase.from('pemilih_data').delete().eq('id', id);
    if (error) { toast({ title: 'Gagal menghapus', description: error.message, variant: 'destructive' }); return; }
    if (row?.foto_ktp_path) {
      await supabase.storage.from('pemilih-ktp').remove([row.foto_ktp_path]);
    }
    toast({ title: 'Data dihapus' });
    fetchRows();
  };

  const openKtp = async (row) => {
    const { data, error } = await supabase.storage
      .from('pemilih-ktp')
      .createSignedUrl(row.foto_ktp_path, 60 * 10);
    if (error || !data?.signedUrl) {
      toast({ title: 'Gagal memuat foto KTP', description: error?.message, variant: 'destructive' });
      return;
    }
    setViewingKtp({ url: data.signedUrl, nama: row.nama });
  };

  const downloadBtnProps = viewingKtp ? {
    href: viewingKtp.url,
    download: 'KTP_' + viewingKtp.nama.replace(/\s+/g, '_') + '.jpg',
    className: 'p-btn-primary',
    style: { marginTop: 18, width: '100%', justifyContent: 'center', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 },
  } : {};

  return (
    <div>
      <h1 className="p-page-title">Data Pemilih</h1>
      <p className="p-page-subtitle">
        Total <b style={{ color: '#1a1d29' }}>{totalCount.toLocaleString('id-ID')}</b> data pemilih tercatat.
      </p>

      <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
          <Search size={15} style={{ position: 'absolute', left: 12, top: 12, color: '#9ca3af' }} />
          <input
            className="p-input"
            style={{ paddingLeft: 36 }}
            placeholder="Cari nama atau NIK..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <PemilihSelect
          value={filterKelurahan}
          onChange={(v) => { setFilterKelurahan(v); setPage(1); }}
          options={kelurahanList.map((k) => ({ value: k.id, label: k.nama }))}
          allLabel="Semua Kelurahan"
          title="Pilih Kelurahan"
          style={{ width: 'auto', minWidth: 170 }}
        />
        <PemilihSelect
          value={filterKategori}
          onChange={(v) => { setFilterKategori(v); setPage(1); }}
          options={Object.entries(KATEGORI_LABEL).map(([k, v]) => ({ value: k, label: v.label }))}
          allLabel="Semua Kategori"
          title="Pilih Kategori"
          style={{ width: 'auto', minWidth: 170 }}
        />
      </div>

      {loading ? (
        <div className="p-card" style={{ padding: 60, textAlign: 'center' }}><Loader2 className="animate-spin" size={26} color="#dc2626" /></div>
      ) : rows.length === 0 ? (
        <div className="p-card" style={{ padding: 50, textAlign: 'center' }}>
          <Users size={32} color="#d4d4d8" style={{ marginBottom: 10 }} />
          <p style={{ color: '#9ca3af', fontSize: 13, margin: 0 }}>Tidak ada data.</p>
        </div>
      ) : (
        <>
          <div className="p-card p-desktop-only" style={{ overflow: 'hidden' }}>
            <div className="p-table-wrap">
              <table className="p-table">
                <thead>
                  <tr>
                    <th>Nama / NIK</th>
                    <th>Alamat</th>
                    <th>Wilayah</th>
                    <th>Kategori</th>
                    <th style={{ textAlign: 'center' }}>KTP</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <div style={{ fontWeight: 700, color: '#1a1d29' }}>{r.nama}</div>
                        <div style={{ color: '#9ca3af', fontSize: 11.5, marginTop: 2 }}>{r.nik || '-'}</div>
                      </td>
                      <td style={{ color: '#4b5563' }}>
                        {r.alamat || '-'} {r.rt && `RT${r.rt}`}{r.rw && `/RW${r.rw}`}
                      </td>
                      <td style={{ color: '#4b5563' }}>
                        {r.pemilih_kelurahan?.nama || '-'}
                      </td>
                      <td>
                        <span className="p-badge" style={{
                          color: KATEGORI_LABEL[r.kategori_dukungan]?.color,
                          background: KATEGORI_LABEL[r.kategori_dukungan]?.bg,
                        }}>
                          {KATEGORI_LABEL[r.kategori_dukungan]?.label}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {r.foto_ktp_path ? (
                          <button
                            onClick={() => openKtp(r)}
                            className="p-btn-ghost"
                            style={{ padding: '5px 12px', fontSize: 11 }}
                          >
                            <CreditCard size={13} /> Lihat
                          </button>
                        ) : (
                          <span style={{ color: '#d4d4d8', display: 'inline-flex', alignItems: 'center' }}>
                            <ImageOff size={14} />
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button onClick={() => openEdit(r)} style={{ marginRight: 10, color: '#2563eb', padding: 4 }}><Pencil size={15} /></button>
                        <button onClick={() => deleteRow(r.id)} style={{ color: '#dc2626', padding: 4 }}><Trash2 size={15} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="p-mobile-only">
            {rows.map((r) => (
              <div key={r.id} className="p-card" style={{ padding: 16, marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, color: '#1a1d29', fontSize: 14 }}>{r.nama}</div>
                    <div style={{ color: '#9ca3af', fontSize: 11.5, marginTop: 2 }}>{r.nik || '-'}</div>
                  </div>
                  <span className="p-badge" style={{
                    color: KATEGORI_LABEL[r.kategori_dukungan]?.color,
                    background: KATEGORI_LABEL[r.kategori_dukungan]?.bg,
                    flexShrink: 0,
                  }}>
                    {KATEGORI_LABEL[r.kategori_dukungan]?.label}
                  </span>
                </div>
                <div style={{ marginTop: 10, fontSize: 12.5, color: '#4b5563', lineHeight: 1.5 }}>
                  {r.alamat || '-'} {r.rt && `RT${r.rt}`}{r.rw && `/RW${r.rw}`}
                  <br />
                  <span style={{ color: '#9ca3af' }}>{r.pemilih_kelurahan?.nama || '-'}</span>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 12, paddingTop: 12, borderTop: '1px solid #f1f1f3' }}>
                  {r.foto_ktp_path && (
                    <button
                      onClick={() => openKtp(r)}
                      className="p-btn-ghost"
                      style={{ flex: 1, justifyContent: 'center', padding: '8px 10px', fontSize: 12 }}
                    >
                      <CreditCard size={13} /> KTP
                    </button>
                  )}
                  <button onClick={() => openEdit(r)} className="p-btn-ghost" style={{ flex: 1, justifyContent: 'center', padding: '8px 10px', fontSize: 12, color: '#2563eb' }}>
                    <Pencil size={13} /> Edit
                  </button>
                  <button onClick={() => deleteRow(r.id)} className="p-btn-ghost" style={{ flex: 1, justifyContent: 'center', padding: '8px 10px', fontSize: 12, color: '#dc2626' }}>
                    <Trash2 size={13} /> Hapus
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 18, fontSize: 13 }}>
        <span style={{ color: '#6b7280' }}>Halaman {page} dari {totalPages}</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="p-btn-ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} style={{ opacity: page <= 1 ? 0.5 : 1 }}>Sebelumnya</button>
          <button className="p-btn-ghost" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} style={{ opacity: page >= totalPages ? 0.5 : 1 }}>Berikutnya</button>
        </div>
      </div>

      {editRow && (
        <div className="p-modal-overlay" onClick={() => setEditRow(null)}>
          <div className="p-modal" style={{ padding: 26, width: 440, maxWidth: '90vw' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <h3 style={{ margin: 0, fontWeight: 700, fontSize: 15.5 }}>Edit Data Pemilih</h3>
              <button onClick={() => setEditRow(null)} style={{ color: '#9ca3af' }}><X size={19} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input className="p-input" placeholder="Nama" value={editRow.nama || ''} onChange={(e) => setEditRow({ ...editRow, nama: e.target.value })} />
              <input className="p-input" placeholder="NIK" value={editRow.nik || ''} onChange={(e) => setEditRow({ ...editRow, nik: e.target.value })} />
              <input className="p-input" placeholder="No. HP" value={editRow.no_hp || ''} onChange={(e) => setEditRow({ ...editRow, no_hp: e.target.value })} />
              <input className="p-input" placeholder="Alamat" value={editRow.alamat || ''} onChange={(e) => setEditRow({ ...editRow, alamat: e.target.value })} />
              <div style={{ display: 'flex', gap: 10 }}>
                <input className="p-input" placeholder="RT" value={editRow.rt || ''} onChange={(e) => setEditRow({ ...editRow, rt: e.target.value })} />
                <input className="p-input" placeholder="RW" value={editRow.rw || ''} onChange={(e) => setEditRow({ ...editRow, rw: e.target.value })} />
                <input className="p-input" placeholder="TPS" value={editRow.tps || ''} onChange={(e) => setEditRow({ ...editRow, tps: e.target.value })} />
              </div>
              <select className="p-select" value={editRow.kategori_dukungan} onChange={(e) => setEditRow({ ...editRow, kategori_dukungan: e.target.value })}>
                {Object.entries(KATEGORI_LABEL).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <button className="p-btn-primary" style={{ marginTop: 18, width: '100%', justifyContent: 'center' }} onClick={saveEdit} disabled={saving}>
              {saving ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />} Simpan
            </button>
          </div>
        </div>
      )}

      {viewingKtp && (
        <div className="p-modal-overlay" onClick={() => setViewingKtp(null)}>
          <div className="p-modal" style={{ padding: 22, maxWidth: 480, width: '100%', maxHeight: '90vh', overflow: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontWeight: 700, fontSize: 14.5 }}>KTP - {viewingKtp.nama}</h3>
              <button onClick={() => setViewingKtp(null)} style={{ color: '#9ca3af' }}><X size={19} /></button>
            </div>
            <img
              src={viewingKtp.url}
              alt="KTP"
              style={{ width: '100%', borderRadius: 12, border: '1px solid #e8e9ec', display: 'block', boxShadow: '0 4px 12px rgba(16,24,40,0.08)' }}
            />
            {React.createElement('a', downloadBtnProps, React.createElement(Download, { size: 16 }), ' Download')}
          </div>
        </div>
      )}
    </div>
  );
};

export default PemilihData;