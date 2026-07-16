import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import RotasiPwaStyles from './RotasiPwaStyles';

const TABS = [
  { key: 'eselon', label: 'Eselon' },
  { key: 'profesi', label: 'Profesi' },
  { key: 'diagnosa', label: 'Diagnosa' },
  { key: 'slot', label: 'Slot Aktif Terapis' },
  { key: 'slot_global', label: 'Slot Global' },
  { key: 'cuti', label: 'Cuti / Ijin Terapis' },
];

const RotasiSetup = () => {
  const [activeTab, setActiveTab] = useState('eselon');

  return (
    <div>
      <RotasiPwaStyles />
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Setup</h1>
      <p style={{ color: '#64748b', marginTop: 0, marginBottom: 24 }}>
        Kelola data master: Eselon, Profesi, Diagnosa, Slot Aktif Terapis, dan Cuti/Ijin Terapis.
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: '1px solid ' + (activeTab === tab.key ? '#2563eb' : '#cbd5e1'),
              background: activeTab === tab.key ? '#2563eb' : '#fff',
              color: activeTab === tab.key ? '#fff' : '#334155',
              fontWeight: 600,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'eselon' && <EselonSection />}
      {activeTab === 'profesi' && <ProfesiSection />}
      {activeTab === 'diagnosa' && <DiagnosaSection />}
      {activeTab === 'slot' && <SlotSection />}
      {activeTab === 'slot_global' && <SlotGlobalSection />}
      {activeTab === 'cuti' && <CutiSection />}
    </div>
  );
};

const EselonSection = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', priority_weight: 0 });
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', priority_weight: 0 });

  const fetchItems = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('rotasi_insurance_types')
      .select('*')
      .order('name', { ascending: true });
    if (!error) setItems(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    const trimmed = form.name.trim();
    if (!trimmed) return;
    setSaving(true);
    const { data, error } = await supabase
      .from('rotasi_insurance_types')
      .insert({ name: trimmed, priority_weight: Number(form.priority_weight) || 0 })
      .select()
      .single();
    if (!error) {
      setItems((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      setForm({ name: '', priority_weight: 0 });
    }
    setSaving(false);
  };

  const startEdit = (item) => {
    setEditingId(item.id);
    setEditForm({ name: item.name, priority_weight: item.priority_weight ?? 0 });
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const handleUpdate = async (id) => {
    const trimmed = editForm.name.trim();
    if (!trimmed) return;
    const { data, error } = await supabase
      .from('rotasi_insurance_types')
      .update({ name: trimmed, priority_weight: Number(editForm.priority_weight) || 0 })
      .eq('id', id)
      .select()
      .single();
    if (!error) {
      setItems((prev) =>
        prev.map((it) => (it.id === id ? data : it)).sort((a, b) => a.name.localeCompare(b.name))
      );
      setEditingId(null);
    } else {
      console.error('Gagal update eselon:', error);
      window.alert('Gagal menyimpan perubahan: ' + error.message);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Hapus data eselon ini? Semua pasien yang masih memakai eselon ini akan otomatis dikosongkan (bukan ikut terhapus).')) return;
    await supabase.from('rotasi_patient_insurance_types').delete().eq('insurance_type_id', id);
    await supabase.from('rotasi_patients').update({ insurance_type_id: null }).eq('insurance_type_id', id);
    const { error } = await supabase.from('rotasi_insurance_types').delete().eq('id', id);
    if (!error) {
      setItems((prev) => prev.filter((it) => it.id !== id));
    } else {
      console.error('Gagal hapus eselon:', error);
      window.alert('Gagal menghapus data: ' + error.message);
    }
  };

  return (
    <div>
      <form onSubmit={handleAdd} style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          placeholder="Nama eselon baru..."
          style={inputStyle}
        />
        <input
          type="number"
          value={form.priority_weight}
          onChange={(e) => setForm((f) => ({ ...f, priority_weight: e.target.value }))}
          placeholder="Bobot"
          style={{ ...inputStyle, width: 100, flex: 'none' }}
        />
        <button type="submit" disabled={saving} style={btnPrimaryStyle}>
          Tambah
        </button>
      </form>

      {loading ? (
        <p>Memuat...</p>
      ) : items.length === 0 ? (
        <p style={{ color: '#94a3b8' }}>Belum ada data eselon.</p>
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: 10 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={thStyle}>Nama Eselon</th>
                <th style={thStyle}>Bobot Prioritas</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} style={{ borderTop: '1px solid #e2e8f0' }}>
                  {editingId === item.id ? (
                    <>
                      <td style={tdStyle}>
                        <input
                          value={editForm.name}
                          onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                          style={inputStyle}
                        />
                      </td>
                      <td style={tdStyle}>
                        <input
                          type="number"
                          value={editForm.priority_weight}
                          onChange={(e) => setEditForm((f) => ({ ...f, priority_weight: e.target.value }))}
                          style={{ ...inputStyle, width: 100 }}
                        />
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button onClick={() => handleUpdate(item.id)} style={btnSaveStyle}>Simpan</button>
                        <button onClick={cancelEdit} style={btnCancelStyle}>Batal</button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td style={{ ...tdStyle, fontWeight: 600 }}>{item.name}</td>
                      <td style={tdStyle}>{item.priority_weight ?? 0}</td>
                      <td style={{ ...tdStyle, textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button onClick={() => startEdit(item)} style={btnEditStyle}>Edit</button>
                        <button onClick={() => handleDelete(item.id)} style={btnDeleteStyle}>Hapus</button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

const SimpleMasterSection = ({ tableName, addPlaceholder, emptyText, columnLabel }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');

  const fetchItems = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .order('name', { ascending: true });
    if (!error) setItems(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchItems();
  }, [tableName]);

  const handleAdd = async (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    const { data, error } = await supabase
      .from(tableName)
      .insert({ name: trimmed })
      .select()
      .single();
    if (!error) {
      setItems((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      setName('');
    }
    setSaving(false);
  };

  const toggleActive = async (item) => {
    const { data, error } = await supabase
      .from(tableName)
      .update({ is_active: !item.is_active })
      .eq('id', item.id)
      .select()
      .single();
    if (!error) {
      setItems((prev) => prev.map((it) => (it.id === item.id ? data : it)));
    }
  };

  const startEdit = (item) => {
    setEditingId(item.id);
    setEditName(item.name);
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const handleUpdate = async (id) => {
    const trimmed = editName.trim();
    if (!trimmed) return;
    const { data, error } = await supabase
      .from(tableName)
      .update({ name: trimmed })
      .eq('id', id)
      .select()
      .single();
    if (!error) {
      setItems((prev) =>
        prev.map((it) => (it.id === id ? data : it)).sort((a, b) => a.name.localeCompare(b.name))
      );
      setEditingId(null);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Hapus data ini?')) return;
    const { error } = await supabase.from(tableName).delete().eq('id', id);
    if (!error) setItems((prev) => prev.filter((it) => it.id !== id));
  };

  return (
    <div>
      <form onSubmit={handleAdd} style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={addPlaceholder}
          style={inputStyle}
        />
        <button type="submit" disabled={saving} style={btnPrimaryStyle}>
          Tambah
        </button>
      </form>

      {loading ? (
        <p>Memuat...</p>
      ) : items.length === 0 ? (
        <p style={{ color: '#94a3b8' }}>{emptyText}</p>
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: 10 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={thStyle}>{columnLabel}</th>
                <th style={thStyle}>Status</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} style={{ borderTop: '1px solid #e2e8f0' }}>
                  {editingId === item.id ? (
                    <>
                      <td style={tdStyle}>
                        <input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          style={inputStyle}
                        />
                      </td>
                      <td style={tdStyle}>-</td>
                      <td style={{ ...tdStyle, textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button onClick={() => handleUpdate(item.id)} style={btnSaveStyle}>Simpan</button>
                        <button onClick={cancelEdit} style={btnCancelStyle}>Batal</button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td style={{ ...tdStyle, fontWeight: 600 }}>{item.name}</td>
                      <td style={tdStyle}>
                        <span
                          onClick={() => toggleActive(item)}
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: 999,
                            cursor: 'pointer',
                            background: item.is_active !== false ? '#dcfce7' : '#f1f5f9',
                            color: item.is_active !== false ? '#15803d' : '#64748b',
                          }}
                        >
                          {item.is_active !== false ? 'Aktif' : 'Nonaktif'}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button onClick={() => startEdit(item)} style={btnEditStyle}>Edit</button>
                        <button onClick={() => handleDelete(item.id)} style={btnDeleteStyle}>Hapus</button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

const ProfesiSection = () => (
  <SimpleMasterSection
    tableName="rotasi_professions"
    addPlaceholder="Nama profesi baru..."
    emptyText="Belum ada data profesi."
    columnLabel="Nama Profesi"
  />
);

const DiagnosaSection = () => (
  <SimpleMasterSection
    tableName="rotasi_diagnoses"
    addPlaceholder="Nama diagnosa baru..."
    emptyText="Belum ada data diagnosa."
    columnLabel="Nama Diagnosa"
  />
);

const SlotSection = () => {
  const [items, setItems] = useState([]);
  const [therapists, setTherapists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ therapist_id: '', start_time: '', end_time: '' });
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ therapist_id: '', start_time: '', end_time: '' });

  const fetchItems = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('rotasi_slots')
      .select('*')
      .order('start_time', { ascending: true });
    if (!error) setItems(data || []);
    setLoading(false);
  };

  const fetchTherapists = async () => {
    const { data, error } = await supabase
      .from('rotasi_therapists')
      .select('id, name')
      .eq('is_active', true)
      .order('name', { ascending: true });
    if (!error) setTherapists(data || []);
  };

  useEffect(() => {
    fetchItems();
    fetchTherapists();
  }, []);

  const therapistMap = useMemo(() => {
    const map = {};
    therapists.forEach((t) => { map[t.id] = t.name; });
    return map;
  }, [therapists]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.therapist_id || !form.start_time || !form.end_time) return;
    setSaving(true);
    const { data, error } = await supabase
      .from('rotasi_slots')
      .insert({
        therapist_id: form.therapist_id,
        label: therapistMap[form.therapist_id] || '-',
        start_time: form.start_time,
        end_time: form.end_time,
      })
      .select()
      .single();
    if (!error) {
      setItems((prev) => [...prev, data].sort((a, b) => (a.start_time || '').localeCompare(b.start_time || '')));
      setForm({ therapist_id: '', start_time: '', end_time: '' });
    } else {
      window.alert('Gagal menambah jam kerja: ' + error.message);
    }
    setSaving(false);
  };

  const toggleActive = async (item) => {
    const { data, error } = await supabase
      .from('rotasi_slots')
      .update({ is_active: !item.is_active })
      .eq('id', item.id)
      .select()
      .single();
    if (!error) {
      setItems((prev) => prev.map((it) => (it.id === item.id ? data : it)));
    }
  };

  const startEdit = (item) => {
    setEditingId(item.id);
    setEditForm({
      therapist_id: item.therapist_id || '',
      start_time: item.start_time || '',
      end_time: item.end_time || '',
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const handleUpdate = async (id) => {
    if (!editForm.therapist_id || !editForm.start_time || !editForm.end_time) return;
    const { data, error } = await supabase
      .from('rotasi_slots')
      .update({
        therapist_id: editForm.therapist_id,
        label: therapistMap[editForm.therapist_id] || '-',
        start_time: editForm.start_time,
        end_time: editForm.end_time,
      })
      .eq('id', id)
      .select()
      .single();
    if (!error) {
      setItems((prev) =>
        prev.map((it) => (it.id === id ? data : it)).sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''))
      );
      setEditingId(null);
    } else {
      window.alert('Gagal menyimpan perubahan: ' + error.message);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Hapus jam kerja ini?')) return;
    const { error } = await supabase.from('rotasi_slots').delete().eq('id', id);
    if (!error) setItems((prev) => prev.filter((it) => it.id !== id));
  };

  return (
    <div>
      <form onSubmit={handleAdd} style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <select
          value={form.therapist_id}
          onChange={(e) => setForm((f) => ({ ...f, therapist_id: e.target.value }))}
          style={{ ...inputStyle, width: 200, flex: 'none' }}
        >
          <option value="">-- Pilih Terapis --</option>
          {therapists.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <input
          type="time"
          value={form.start_time}
          onChange={(e) => setForm((f) => ({ ...f, start_time: e.target.value }))}
          style={{ ...inputStyle, width: 130, flex: 'none' }}
        />
        <input
          type="time"
          value={form.end_time}
          onChange={(e) => setForm((f) => ({ ...f, end_time: e.target.value }))}
          style={{ ...inputStyle, width: 130, flex: 'none' }}
        />
        <button type="submit" disabled={saving} style={btnPrimaryStyle}>
          Tambah
        </button>
      </form>

      {loading ? (
        <p>Memuat...</p>
      ) : items.length === 0 ? (
        <p style={{ color: '#94a3b8' }}>Belum ada jam kerja terapis.</p>
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: 10 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={thStyle}>Terapis</th>
                <th style={thStyle}>Jam Mulai</th>
                <th style={thStyle}>Jam Selesai</th>
                <th style={thStyle}>Status</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} style={{ borderTop: '1px solid #e2e8f0' }}>
                  {editingId === item.id ? (
                    <>
                      <td style={tdStyle}>
                        <select
                          value={editForm.therapist_id}
                          onChange={(e) => setEditForm((f) => ({ ...f, therapist_id: e.target.value }))}
                          style={{ ...inputStyle, width: 180 }}
                        >
                          <option value="">-- Pilih Terapis --</option>
                          {therapists.map((t) => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                        </select>
                      </td>
                      <td style={tdStyle}>
                        <input
                          type="time"
                          value={editForm.start_time}
                          onChange={(e) => setEditForm((f) => ({ ...f, start_time: e.target.value }))}
                          style={{ ...inputStyle, width: 120 }}
                        />
                      </td>
                      <td style={tdStyle}>
                        <input
                          type="time"
                          value={editForm.end_time}
                          onChange={(e) => setEditForm((f) => ({ ...f, end_time: e.target.value }))}
                          style={{ ...inputStyle, width: 120 }}
                        />
                      </td>
                      <td style={tdStyle}>-</td>
                      <td style={{ ...tdStyle, textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button onClick={() => handleUpdate(item.id)} style={btnSaveStyle}>Simpan</button>
                        <button onClick={cancelEdit} style={btnCancelStyle}>Batal</button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td style={{ ...tdStyle, fontWeight: 600 }}>{therapistMap[item.therapist_id] || '-'}</td>
                      <td style={tdStyle}>{item.start_time || '-'}</td>
                      <td style={tdStyle}>{item.end_time || '-'}</td>
                      <td style={tdStyle}>
                        <span
                          onClick={() => toggleActive(item)}
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: 999,
                            cursor: 'pointer',
                            background: item.is_active !== false ? '#dcfce7' : '#f1f5f9',
                            color: item.is_active !== false ? '#15803d' : '#64748b',
                          }}
                        >
                          {item.is_active !== false ? 'Aktif' : 'Nonaktif'}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button onClick={() => startEdit(item)} style={btnEditStyle}>Edit</button>
                        <button onClick={() => handleDelete(item.id)} style={btnDeleteStyle}>Hapus</button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

const DEFAULT_SESSIONS = [
  { label: 'Sesi I', start_time: '08:00', capacity: 3 },
  { label: 'Sesi II', start_time: '08:30', capacity: 3 },
  { label: 'Sesi III', start_time: '09:00', capacity: 3 },
  { label: 'Sesi IV', start_time: '10:00', capacity: 3 },
  { label: 'Sesi V', start_time: '10:30', capacity: 3 },
  { label: 'Sesi VI', start_time: '11:00', capacity: 3 },
  { label: 'Sesi VII', start_time: '14:00', capacity: 3 },
  { label: 'Sesi VIII', start_time: '14:30', capacity: 3 },
  { label: 'Sesi IX', start_time: '15:00', capacity: 3 },
];

const DAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

const SlotGlobalSection = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form tambah/edit manual (satu slot, satu tanggal) - opsional, disembunyikan by default
  const [form, setForm] = useState({ slot_date: '', label: '', start_time: '', end_time: '', capacity: '' });
  const [saving, setSaving] = useState(false);
  const [showManualForm, setShowManualForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ slot_date: '', label: '', start_time: '', end_time: '', capacity: '' });

  // Terapkan default 9 sesi ke rentang tanggal, otomatis hanya Senin-Jumat
  const [applyRange, setApplyRange] = useState({ from_date: '', to_date: '' });
  const [applying, setApplying] = useState(false);

  const [deletingDate, setDeletingDate] = useState(null);
  const [expandedDates, setExpandedDates] = useState(() => new Set());
  const [visibleCount, setVisibleCount] = useState(8);

  const fetchItems = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('rotasi_global_slots')
      .select('*')
      .order('slot_date', { ascending: true })
      .order('start_time', { ascending: true });
    if (!error) setItems(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const formatTanggal = (dateStr) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr + 'T00:00:00');
    if (isNaN(d.getTime())) return '-';
    return `${DAY_NAMES[d.getDay()]}, ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  };

  const isWeekend = (d) => d.getDay() === 0 || d.getDay() === 6;

  const handleApplyWeekdayDefault = async () => {
    if (!applyRange.from_date || !applyRange.to_date) {
      window.alert('Isi tanggal mulai dan tanggal selesai dulu.');
      return;
    }
    if (applyRange.from_date > applyRange.to_date) {
      window.alert('Tanggal mulai harus sebelum tanggal selesai.');
      return;
    }
    const start = new Date(applyRange.from_date + 'T00:00:00');
    const end = new Date(applyRange.to_date + 'T00:00:00');
    const rows = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      if (isWeekend(d)) continue;
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      DEFAULT_SESSIONS.forEach((s) => {
        rows.push({ slot_date: dateStr, label: s.label, start_time: s.start_time, end_time: null, capacity: s.capacity });
      });
    }
    if (rows.length === 0) {
      window.alert('Rentang tanggal itu tidak mengandung hari kerja Senin-Jumat.');
      return;
    }
    if (!window.confirm(`Terapkan 9 sesi default ke ${rows.length / 9} hari kerja (Senin-Jumat) dari ${formatTanggal(applyRange.from_date)} sampai ${formatTanggal(applyRange.to_date)}?`)) return;
    setApplying(true);
    const { error } = await supabase
      .from('rotasi_global_slots')
      .upsert(rows, { onConflict: 'slot_date,label' });
    if (!error) {
      await fetchItems();
      setApplyRange({ from_date: '', to_date: '' });
    } else {
      window.alert('Gagal menerapkan default: ' + error.message);
    }
    setApplying(false);
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    const trimmed = form.label.trim();
    if (!trimmed || !form.slot_date) return;
    setSaving(true);
    const { error } = await supabase
      .from('rotasi_global_slots')
      .upsert(
        {
          slot_date: form.slot_date,
          label: trimmed,
          start_time: form.start_time || null,
          end_time: form.end_time || null,
          capacity: form.capacity ? Number(form.capacity) : null,
        },
        { onConflict: 'slot_date,label' }
      );
    if (!error) {
      await fetchItems();
      setForm({ slot_date: '', label: '', start_time: '', end_time: '', capacity: '' });
    } else {
      window.alert('Gagal menambah slot global: ' + error.message);
    }
    setSaving(false);
  };

  const startEdit = (item) => {
    setEditingId(item.id);
    setEditForm({
      slot_date: item.slot_date || '',
      label: item.label || '',
      start_time: item.start_time || '',
      end_time: item.end_time || '',
      capacity: item.capacity ?? '',
    });
  };

  const cancelEdit = () => setEditingId(null);

  const handleUpdate = async (id) => {
    const trimmed = editForm.label.trim();
    if (!trimmed || !editForm.slot_date) return;
    const { error } = await supabase
      .from('rotasi_global_slots')
      .update({
        slot_date: editForm.slot_date,
        label: trimmed,
        start_time: editForm.start_time || null,
        end_time: editForm.end_time || null,
        capacity: editForm.capacity ? Number(editForm.capacity) : null,
      })
      .eq('id', id);
    if (!error) {
      await fetchItems();
      setEditingId(null);
    } else {
      window.alert('Gagal menyimpan perubahan: ' + error.message);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Hapus slot ini?')) return;
    const { error } = await supabase.from('rotasi_global_slots').delete().eq('id', id);
    if (!error) setItems((prev) => prev.filter((it) => it.id !== id));
    else window.alert('Gagal menghapus data: ' + error.message);
  };

  const handleDeleteDate = async (dateStr) => {
    if (!window.confirm(`Hapus semua slot pada ${formatTanggal(dateStr)}?`)) return;
    setDeletingDate(dateStr);
    const { error } = await supabase.from('rotasi_global_slots').delete().eq('slot_date', dateStr);
    if (!error) setItems((prev) => prev.filter((it) => it.slot_date !== dateStr));
    else window.alert('Gagal menghapus data: ' + error.message);
    setDeletingDate(null);
  };

  const toggleDate = (dateStr) => {
    setExpandedDates((prev) => {
      const next = new Set(prev);
      if (next.has(dateStr)) next.delete(dateStr);
      else next.add(dateStr);
      return next;
    });
  };

  const groups = useMemo(() => {
    const byDate = {};
    items.forEach((it) => {
      if (!byDate[it.slot_date]) byDate[it.slot_date] = [];
      byDate[it.slot_date].push(it);
    });
    return Object.entries(byDate)
      .map(([date, rows]) => ({ date, rows: [...rows].sort((a, b) => (a.start_time || '').localeCompare(b.start_time || '')) }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [items]);

  const visibleGroups = groups.slice(0, visibleCount);

  return (
    <div>
      {/* ── Panel: Terapkan Default Mingguan ── */}
      <div style={{
        background: 'linear-gradient(135deg,#eff6ff,#f5f3ff)', border: '1px solid #dbeafe',
        borderRadius: 14, padding: 20, marginBottom: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 18 }}>📆</span>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#1e293b' }}>Terapkan Default 9 Sesi ke Hari Kerja (Senin–Jumat)</h3>
        </div>
        <p style={{ fontSize: 12.5, color: '#64748b', margin: '4px 0 14px' }}>
          Pilih rentang tanggal. Sistem otomatis mengisi Sesi I–IX ke setiap hari Senin sampai Jumat di rentang itu (Sabtu &amp; Minggu dilewati).
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#475569' }}>Dari tanggal</label>
            <input
              type="date"
              value={applyRange.from_date}
              onChange={(e) => setApplyRange((f) => ({ ...f, from_date: e.target.value }))}
              style={{ ...inputStyle, width: 160, flex: 'none' }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#475569' }}>Sampai tanggal</label>
            <input
              type="date"
              value={applyRange.to_date}
              onChange={(e) => setApplyRange((f) => ({ ...f, to_date: e.target.value }))}
              style={{ ...inputStyle, width: 160, flex: 'none' }}
            />
          </div>
          <button
            type="button"
            onClick={handleApplyWeekdayDefault}
            disabled={applying}
            style={{ ...btnPrimaryStyle, background: '#16a34a', padding: '10px 20px' }}
          >
            {applying ? 'Menerapkan...' : '✓ Terapkan ke Senin–Jumat'}
          </button>
        </div>
      </div>

      {/* ── Toggle form manual ── */}
      <button
        type="button"
        onClick={() => setShowManualForm((v) => !v)}
        style={{
          border: 'none', background: 'none', color: '#2563eb', fontWeight: 700, fontSize: 13,
          cursor: 'pointer', padding: 0, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6,
        }}
      >
        {showManualForm ? '▾' : '▸'} Tambah / edit slot manual (satu per satu)
      </button>

      {showManualForm && (
        <form onSubmit={handleAdd} className="rotasi-slot-form" style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 14 }}>
          <input
            type="date"
            value={form.slot_date}
            onChange={(e) => setForm((f) => ({ ...f, slot_date: e.target.value }))}
            style={{ ...inputStyle, width: 150, flex: 'none' }}
          />
          <input
            value={form.label}
            onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
            placeholder="Nama slot (mis. Sesi Pagi)..."
            style={inputStyle}
          />
          <input
            type="time"
            value={form.start_time}
            onChange={(e) => setForm((f) => ({ ...f, start_time: e.target.value }))}
            style={{ ...inputStyle, width: 130, flex: 'none' }}
          />
          <input
            type="time"
            value={form.end_time}
            onChange={(e) => setForm((f) => ({ ...f, end_time: e.target.value }))}
            style={{ ...inputStyle, width: 130, flex: 'none' }}
          />
          <input
            type="number"
            value={form.capacity}
            onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value }))}
            placeholder="Kapasitas"
            style={{ ...inputStyle, width: 100, flex: 'none' }}
          />
          <button type="submit" disabled={saving} style={btnPrimaryStyle}>
            {saving ? 'Menyimpan...' : 'Tambah'}
          </button>
        </form>
      )}

      {/* ── List, dikelompokkan per tanggal, accordion ── */}
      {loading ? (
        <p style={{ color: '#94a3b8' }}>Memuat...</p>
      ) : groups.length === 0 ? (
        <p style={{ color: '#94a3b8' }}>Belum ada slot global. Terapkan default di atas untuk memulai.</p>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {visibleGroups.map(({ date, rows }) => {
              const isOpen = expandedDates.has(date);
              return (
                <div key={date} style={{ border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden', background: '#fff' }}>
                  <div
                    onClick={() => toggleDate(date)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '12px 16px', cursor: 'pointer', background: isOpen ? '#f8fafc' : '#fff',
                      flexWrap: 'wrap', gap: 8,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 13, color: '#94a3b8', transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform .15s', display: 'inline-block' }}>▸</span>
                      <span style={{ fontWeight: 700, fontSize: 13.5, color: '#0f172a' }}>{formatTanggal(date)}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#2563eb', background: '#eff6ff', border: '1px solid #dbeafe', borderRadius: 999, padding: '2px 9px' }}>
                        {rows.length} slot
                      </span>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteDate(date); }}
                      disabled={deletingDate === date}
                      style={{ ...btnDeleteStyle, opacity: deletingDate === date ? 0.5 : 1 }}
                    >
                      {deletingDate === date ? 'Menghapus...' : 'Hapus Semua'}
                    </button>
                  </div>

                  {isOpen && (
                    <div style={{ padding: '4px 16px 16px', display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid #f1f5f9' }}>
                      {rows.map((item) => (
                        <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0', flexWrap: 'wrap' }}>
                          {editingId === item.id ? (
                            <>
                              <input value={editForm.label} onChange={(e) => setEditForm((f) => ({ ...f, label: e.target.value }))} style={{ ...inputStyle, width: 130 }} />
                              <input type="time" value={editForm.start_time} onChange={(e) => setEditForm((f) => ({ ...f, start_time: e.target.value }))} style={{ ...inputStyle, width: 110 }} />
                              <input type="time" value={editForm.end_time} onChange={(e) => setEditForm((f) => ({ ...f, end_time: e.target.value }))} style={{ ...inputStyle, width: 110 }} />
                              <input type="number" value={editForm.capacity} onChange={(e) => setEditForm((f) => ({ ...f, capacity: e.target.value }))} style={{ ...inputStyle, width: 80 }} />
                              <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                                <button onClick={() => handleUpdate(item.id)} style={btnSaveStyle}>Simpan</button>
                                <button onClick={cancelEdit} style={btnCancelStyle}>Batal</button>
                              </div>
                            </>
                          ) : (
                            <>
                              <span style={{ fontWeight: 700, fontSize: 13, color: '#0f172a', minWidth: 80 }}>{item.label}</span>
                              <span style={{ fontSize: 12.5, color: '#475569' }}>{item.start_time || '-'}{item.end_time ? ` – ${item.end_time}` : ''}</span>
                              <span style={{ fontSize: 11, color: '#94a3b8' }}>kapasitas {item.capacity ?? '-'}</span>
                              <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                                <button onClick={() => startEdit(item)} style={btnEditStyle}>Edit</button>
                                <button onClick={() => handleDelete(item.id)} style={btnDeleteStyle}>Hapus</button>
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {visibleCount < groups.length && (
            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <button
                onClick={() => setVisibleCount((v) => v + 8)}
                style={{ ...btnPrimaryStyle, background: '#fff', color: '#2563eb', border: '1px solid #dbeafe' }}
              >
                Tampilkan {Math.min(8, groups.length - visibleCount)} tanggal lagi ({groups.length - visibleCount} tersisa)
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

const CutiSection = () => {
  const [items, setItems] = useState([]);
  const [therapists, setTherapists] = useState([]);
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ therapist_id: '', leave_date: '', tipe: 'seharian', start_time: '', end_time: '', reason: '' });
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ therapist_id: '', leave_date: '', tipe: 'seharian', start_time: '', end_time: '', reason: '' });

  const fetchAll = async () => {
    setLoading(true);
    const [leaveRes, therapistRes, slotRes] = await Promise.all([
      supabase.from('rotasi_therapist_leave').select('*').order('leave_date', { ascending: false }),
      supabase.from('rotasi_therapists').select('id, name').order('name', { ascending: true }),
      supabase.from('rotasi_slots').select('id, label').order('start_time', { ascending: true }),
    ]);
    if (!leaveRes.error) setItems(leaveRes.data || []);
    if (!therapistRes.error) setTherapists(therapistRes.data || []);
    if (!slotRes.error) setSlots(slotRes.data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const therapistName = (id) => therapists.find((t) => t.id === id)?.name || '-';
  const slotLabel = (id) => (id ? slots.find((s) => s.id === id)?.label || '-' : 'Seharian');

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.therapist_id || !form.leave_date) return;
    if (form.tipe === 'parsial' && (!form.start_time || !form.end_time)) return;
    setSaving(true);
    const { data, error } = await supabase
      .from('rotasi_therapist_leave')
      .insert({
        therapist_id: form.therapist_id,
        leave_date: form.leave_date,
        slot_id: null,
        reason: form.tipe === 'parsial'
          ? `Parsial ${form.start_time}–${form.end_time}${form.reason.trim() ? ' | ' + form.reason.trim() : ''}`
          : form.reason.trim() || null,
      })
      .select()
      .single();
    if (!error) {
      setItems((prev) => [data, ...prev]);
      setForm({ therapist_id: '', leave_date: '', tipe: 'seharian', start_time: '', end_time: '', reason: '' });
    }
    setSaving(false);
  };

  const startEdit = (item) => {
    const isParsial = item.reason && item.reason.startsWith('Parsial ');
    let tipe = 'seharian';
    let start_time = '';
    let end_time = '';
    let reason = item.reason || '';
    if (isParsial) {
      tipe = 'parsial';
      const match = item.reason.match(/^Parsial (\d{2}:\d{2})–(\d{2}:\d{2})(?:\s\|\s(.*))?$/);
      if (match) { start_time = match[1]; end_time = match[2]; reason = match[3] || ''; }
    }
    setEditingId(item.id);
    setEditForm({
      therapist_id: item.therapist_id || '',
      leave_date: item.leave_date || '',
      tipe,
      start_time,
      end_time,
      reason,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const handleUpdate = async (id) => {
    if (!editForm.therapist_id || !editForm.leave_date) return;
    if (editForm.tipe === 'parsial' && (!editForm.start_time || !editForm.end_time)) return;
    const { data, error } = await supabase
      .from('rotasi_therapist_leave')
      .update({
        therapist_id: editForm.therapist_id,
        leave_date: editForm.leave_date,
        slot_id: null,
        reason: editForm.tipe === 'parsial'
          ? `Parsial ${editForm.start_time}–${editForm.end_time}${editForm.reason.trim() ? ' | ' + editForm.reason.trim() : ''}`
          : editForm.reason.trim() || null,
      })
      .eq('id', id)
      .select()
      .single();
    if (!error) {
      setItems((prev) => prev.map((it) => (it.id === id ? data : it)));
      setEditingId(null);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Hapus data cuti/ijin ini?')) return;
    const { error } = await supabase.from('rotasi_therapist_leave').delete().eq('id', id);
    if (!error) setItems((prev) => prev.filter((it) => it.id !== id));
  };

  return (
    <div>
      <form onSubmit={handleAdd} style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <select
          value={form.therapist_id}
          onChange={(e) => setForm((f) => ({ ...f, therapist_id: e.target.value }))}
          style={{ ...inputStyle, width: 180, flex: 'none' }}
        >
          <option value="">-- Pilih Terapis --</option>
          {therapists.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <input
          type="date"
          value={form.leave_date}
          onChange={(e) => setForm((f) => ({ ...f, leave_date: e.target.value }))}
          style={{ ...inputStyle, width: 150, flex: 'none' }}
        />
        <select
          value={form.tipe}
          onChange={(e) => setForm((f) => ({ ...f, tipe: e.target.value, start_time: '', end_time: '' }))}
          style={{ ...inputStyle, width: 130, flex: 'none' }}
        >
          <option value="seharian">Seharian</option>
          <option value="parsial">Parsial</option>
        </select>
        {form.tipe === 'parsial' && (
          <>
            <input
              type="time"
              value={form.start_time}
              onChange={(e) => setForm((f) => ({ ...f, start_time: e.target.value }))}
              style={{ ...inputStyle, width: 120, flex: 'none' }}
              placeholder="Jam mulai"
            />
            <input
              type="time"
              value={form.end_time}
              onChange={(e) => setForm((f) => ({ ...f, end_time: e.target.value }))}
              style={{ ...inputStyle, width: 120, flex: 'none' }}
              placeholder="Jam selesai"
            />
          </>
        )}
        <input
          value={form.reason}
          onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
          placeholder="Alasan (opsional)..."
          style={inputStyle}
        />
        <button type="submit" disabled={saving} style={btnPrimaryStyle}>
          Tambah
        </button>
      </form>

      {loading ? (
        <p>Memuat...</p>
      ) : items.length === 0 ? (
        <p style={{ color: '#94a3b8' }}>Belum ada data cuti/ijin.</p>
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: 10 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={thStyle}>Terapis</th>
                <th style={thStyle}>Tanggal</th>
                <th style={thStyle}>Slot</th>
                <th style={thStyle}>Alasan</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} style={{ borderTop: '1px solid #e2e8f0' }}>
                  {editingId === item.id ? (
                    <>
                      <td style={tdStyle}>
                        <select
                          value={editForm.therapist_id}
                          onChange={(e) => setEditForm((f) => ({ ...f, therapist_id: e.target.value }))}
                          style={inputStyle}
                        >
                          <option value="">-- Pilih Terapis --</option>
                          {therapists.map((t) => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                        </select>
                      </td>
                      <td style={tdStyle}>
                        <input
                          type="date"
                          value={editForm.leave_date}
                          onChange={(e) => setEditForm((f) => ({ ...f, leave_date: e.target.value }))}
                          style={inputStyle}
                        />
                      </td>
                      <td style={tdStyle}>
                        <select
                          value={editForm.tipe}
                          onChange={(e) => setEditForm((f) => ({ ...f, tipe: e.target.value, start_time: '', end_time: '' }))}
                          style={{ ...inputStyle, width: 110 }}
                        >
                          <option value="seharian">Seharian</option>
                          <option value="parsial">Parsial</option>
                        </select>
                        {editForm.tipe === 'parsial' && (
                          <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                            <input
                              type="time"
                              value={editForm.start_time}
                              onChange={(e) => setEditForm((f) => ({ ...f, start_time: e.target.value }))}
                              style={{ ...inputStyle, width: 110 }}
                            />
                            <input
                              type="time"
                              value={editForm.end_time}
                              onChange={(e) => setEditForm((f) => ({ ...f, end_time: e.target.value }))}
                              style={{ ...inputStyle, width: 110 }}
                            />
                          </div>
                        )}
                      </td>
                      <td style={tdStyle}>
                        <input
                          value={editForm.reason}
                          onChange={(e) => setEditForm((f) => ({ ...f, reason: e.target.value }))}
                          style={inputStyle}
                        />
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button onClick={() => handleUpdate(item.id)} style={btnSaveStyle}>Simpan</button>
                        <button onClick={cancelEdit} style={btnCancelStyle}>Batal</button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td style={{ ...tdStyle, fontWeight: 600 }}>{therapistName(item.therapist_id)}</td>
                      <td style={tdStyle}>{item.leave_date || '-'}</td>
                      <td style={tdStyle}>{slotLabel(item.slot_id)}</td>
                      <td style={tdStyle}>{item.reason || '-'}</td>
                      <td style={{ ...tdStyle, textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button onClick={() => startEdit(item)} style={btnEditStyle}>Edit</button>
                        <button onClick={() => handleDelete(item.id)} style={btnDeleteStyle}>Hapus</button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

const inputStyle = {
  flex: 1,
  padding: '8px 10px',
  borderRadius: 8,
  border: '1px solid #cbd5e1',
  fontSize: 13,
  boxSizing: 'border-box',
};

const thStyle = {
  textAlign: 'left',
  padding: '10px 14px',
  fontSize: 12,
  fontWeight: 700,
  color: '#475569',
};

const tdStyle = {
  padding: '10px 14px',
  color: '#334155',
};

const btnPrimaryStyle = {
  padding: '8px 16px',
  borderRadius: 8,
  border: 'none',
  background: '#2563eb',
  color: '#fff',
  fontWeight: 700,
  fontSize: 13,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

const btnEditStyle = {
  fontSize: 11,
  padding: '4px 8px',
  borderRadius: 6,
  border: '1px solid #bfdbfe',
  background: '#fff',
  color: '#1d4ed8',
  cursor: 'pointer',
  marginRight: 6,
};

const btnDeleteStyle = {
  fontSize: 11,
  padding: '4px 8px',
  borderRadius: 6,
  border: '1px solid #fecaca',
  background: '#fff',
  color: '#dc2626',
  cursor: 'pointer',
};

const btnSaveStyle = {
  fontSize: 11,
  padding: '4px 8px',
  borderRadius: 6,
  border: '1px solid #bbf7d0',
  background: '#fff',
  color: '#15803d',
  cursor: 'pointer',
  marginRight: 6,
};

const btnCancelStyle = {
  fontSize: 11,
  padding: '4px 8px',
  borderRadius: 6,
  border: '1px solid #cbd5e1',
  background: '#fff',
  color: '#334155',
  cursor: 'pointer',
};

export default RotasiSetup;