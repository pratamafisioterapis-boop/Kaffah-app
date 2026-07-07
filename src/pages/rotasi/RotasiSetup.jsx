import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';

const TABS = [
  { key: 'eselon', label: 'Eselon' },
  { key: 'profesi', label: 'Profesi' },
  { key: 'diagnosa', label: 'Diagnosa' },
  { key: 'slot', label: 'Slot Aktif Terapis' },
  { key: 'cuti', label: 'Cuti / Ijin Terapis' },
];

const RotasiSetup = () => {
  const [activeTab, setActiveTab] = useState('eselon');

  return (
    <div>
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
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Hapus data eselon ini?')) return;
    const { error } = await supabase.from('rotasi_insurance_types').delete().eq('id', id);
    if (!error) setItems((prev) => prev.filter((it) => it.id !== id));
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
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ label: '', start_time: '', end_time: '', sort_order: 0 });
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ label: '', start_time: '', end_time: '', sort_order: 0 });

  const fetchItems = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('rotasi_slots')
      .select('*')
      .order('sort_order', { ascending: true });
    if (!error) setItems(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    const trimmed = form.label.trim();
    if (!trimmed || !form.start_time || !form.end_time) return;
    setSaving(true);
    const { data, error } = await supabase
      .from('rotasi_slots')
      .insert({
        label: trimmed,
        start_time: form.start_time,
        end_time: form.end_time,
        sort_order: Number(form.sort_order) || 0,
      })
      .select()
      .single();
    if (!error) {
      setItems((prev) => [...prev, data].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)));
      setForm({ label: '', start_time: '', end_time: '', sort_order: 0 });
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
      label: item.label || '',
      start_time: item.start_time || '',
      end_time: item.end_time || '',
      sort_order: item.sort_order ?? 0,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const handleUpdate = async (id) => {
    const trimmed = editForm.label.trim();
    if (!trimmed) return;
    const { data, error } = await supabase
      .from('rotasi_slots')
      .update({
        label: trimmed,
        start_time: editForm.start_time || null,
        end_time: editForm.end_time || null,
        sort_order: Number(editForm.sort_order) || 0,
      })
      .eq('id', id)
      .select()
      .single();
    if (!error) {
      setItems((prev) =>
        prev.map((it) => (it.id === id ? data : it)).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      );
      setEditingId(null);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Hapus slot ini?')) return;
    const { error } = await supabase.from('rotasi_slots').delete().eq('id', id);
    if (!error) setItems((prev) => prev.filter((it) => it.id !== id));
  };

  return (
    <div>
      <form onSubmit={handleAdd} style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
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
          value={form.sort_order}
          onChange={(e) => setForm((f) => ({ ...f, sort_order: e.target.value }))}
          placeholder="Urutan"
          style={{ ...inputStyle, width: 90, flex: 'none' }}
        />
        <button type="submit" disabled={saving} style={btnPrimaryStyle}>
          Tambah
        </button>
      </form>

      {loading ? (
        <p>Memuat...</p>
      ) : items.length === 0 ? (
        <p style={{ color: '#94a3b8' }}>Belum ada slot.</p>
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: 10 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={thStyle}>Nama Slot</th>
                <th style={thStyle}>Jam Mulai</th>
                <th style={thStyle}>Jam Selesai</th>
                <th style={thStyle}>Urutan</th>
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
                          value={editForm.label}
                          onChange={(e) => setEditForm((f) => ({ ...f, label: e.target.value }))}
                          style={inputStyle}
                        />
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
                      <td style={tdStyle}>
                        <input
                          type="number"
                          value={editForm.sort_order}
                          onChange={(e) => setEditForm((f) => ({ ...f, sort_order: e.target.value }))}
                          style={{ ...inputStyle, width: 70 }}
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
                      <td style={{ ...tdStyle, fontWeight: 600 }}>{item.label}</td>
                      <td style={tdStyle}>{item.start_time || '-'}</td>
                      <td style={tdStyle}>{item.end_time || '-'}</td>
                      <td style={tdStyle}>{item.sort_order ?? 0}</td>
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

const CutiSection = () => {
  const [items, setItems] = useState([]);
  const [therapists, setTherapists] = useState([]);
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ therapist_id: '', leave_date: '', slot_id: '', reason: '' });
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ therapist_id: '', leave_date: '', slot_id: '', reason: '' });

  const fetchAll = async () => {
    setLoading(true);
    const [leaveRes, therapistRes, slotRes] = await Promise.all([
      supabase.from('rotasi_therapist_leave').select('*').order('leave_date', { ascending: false }),
      supabase.from('rotasi_therapists').select('id, name').order('name', { ascending: true }),
      supabase.from('rotasi_slots').select('id, label').order('sort_order', { ascending: true }),
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
    setSaving(true);
    const { data, error } = await supabase
      .from('rotasi_therapist_leave')
      .insert({
        therapist_id: form.therapist_id,
        leave_date: form.leave_date,
        slot_id: form.slot_id || null,
        reason: form.reason.trim() || null,
      })
      .select()
      .single();
    if (!error) {
      setItems((prev) => [data, ...prev]);
      setForm({ therapist_id: '', leave_date: '', slot_id: '', reason: '' });
    }
    setSaving(false);
  };

  const startEdit = (item) => {
    setEditingId(item.id);
    setEditForm({
      therapist_id: item.therapist_id || '',
      leave_date: item.leave_date || '',
      slot_id: item.slot_id || '',
      reason: item.reason || '',
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const handleUpdate = async (id) => {
    if (!editForm.therapist_id || !editForm.leave_date) return;
    const { data, error } = await supabase
      .from('rotasi_therapist_leave')
      .update({
        therapist_id: editForm.therapist_id,
        leave_date: editForm.leave_date,
        slot_id: editForm.slot_id || null,
        reason: editForm.reason.trim() || null,
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
          value={form.slot_id}
          onChange={(e) => setForm((f) => ({ ...f, slot_id: e.target.value }))}
          style={{ ...inputStyle, width: 150, flex: 'none' }}
        >
          <option value="">Seharian</option>
          {slots.map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>
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
                          value={editForm.slot_id}
                          onChange={(e) => setEditForm((f) => ({ ...f, slot_id: e.target.value }))}
                          style={inputStyle}
                        >
                          <option value="">Seharian</option>
                          {slots.map((s) => (
                            <option key={s.id} value={s.id}>{s.label}</option>
                          ))}
                        </select>
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
