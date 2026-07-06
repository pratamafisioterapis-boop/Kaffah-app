import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { generateSchedule } from '@/lib/rotasiScheduler';

const todayStr = () => new Date().toISOString().split('T')[0];

const RotasiDailySchedule = () => {
  const [date, setDate] = useState(todayStr());
  const [allPatients, setAllPatients] = useState([]);
  const [therapists, setTherapists] = useState([]);
  const [dailyListIds, setDailyListIds] = useState([]);
  const [addPatientId, setAddPatientId] = useState('');
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    loadStatic();
  }, []);

  useEffect(() => {
    loadForDate(date);
  }, [date]);

  const loadStatic = async () => {
    const [{ data: pts }, { data: ths }] = await Promise.all([
      supabase.from('rotasi_patients').select('*').order('name'),
      supabase.from('rotasi_therapists').select('*').eq('is_active', true).order('created_at'),
    ]);
    setAllPatients(pts || []);
    setTherapists(ths || []);
  };

  const loadForDate = async (d) => {
    setLoading(true);
    setMessage(null);
    const [{ data: list }, { data: sched }] = await Promise.all([
      supabase.from('rotasi_daily_list').select('patient_id').eq('visit_date', d),
      supabase.from('rotasi_schedule').select('*').eq('visit_date', d),
    ]);
    setDailyListIds((list || []).map((r) => r.patient_id));
    setSchedule(sched || []);
    setLoading(false);
  };

  const patientMap = useMemo(() => {
    const m = {};
    allPatients.forEach((p) => { m[p.id] = p; });
    return m;
  }, [allPatients]);

  const availablePatientsToAdd = allPatients.filter((p) => !dailyListIds.includes(p.id));

  const handleAddPatient = async () => {
    if (!addPatientId) return;
    const { error } = await supabase
      .from('rotasi_daily_list')
      .insert({ visit_date: date, patient_id: addPatientId });
    if (!error) {
      setDailyListIds((prev) => [...prev, addPatientId]);
      setAddPatientId('');
    }
  };

  const handleRemovePatient = async (patientId) => {
    await supabase
      .from('rotasi_daily_list')
      .delete()
      .eq('visit_date', date)
      .eq('patient_id', patientId);
    setDailyListIds((prev) => prev.filter((id) => id !== patientId));
    setSchedule((prev) => prev.filter((s) => s.patient_id !== patientId));
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setMessage(null);
    try {
      if (therapists.length === 0) {
        throw new Error('Belum ada terapis aktif. Tambahkan terapis dulu di menu Terapis.');
      }
      if (dailyListIds.length === 0) {
        throw new Error('Belum ada pasien yang ditambahkan untuk tanggal ini.');
      }

      const { data: history, error: histErr } = await supabase
        .from('rotasi_schedule')
        .select('patient_id, therapist_id, visit_date')
        .in('patient_id', dailyListIds)
        .lt('visit_date', date)
        .order('visit_date', { ascending: false });

      if (histErr) throw histErr;

      const lastVisitMap = {};
      (history || []).forEach((row) => {
        if (!lastVisitMap[row.patient_id]) {
          lastVisitMap[row.patient_id] = row.therapist_id;
        }
      });

      const patientsToday = dailyListIds.map((id) => patientMap[id]).filter(Boolean);
      const result = generateSchedule({ patients: patientsToday, therapists, lastVisitMap });

      const rows = result.map((r) => ({
        visit_date: date,
        patient_id: r.patient_id,
        therapist_id: r.therapist_id,
        slot_number: r.slot_number,
        constraint_violated: r.constraint_violated,
      }));

      await supabase.from('rotasi_schedule').delete().eq('visit_date', date);
      const { data: inserted, error: insErr } = await supabase
        .from('rotasi_schedule')
        .insert(rows)
        .select();
      if (insErr) throw insErr;

      setSchedule(inserted || []);
      setMessage({ type: 'success', text: 'Jadwal berhasil dibuat.' });
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setGenerating(false);
    }
  };

  const scheduleBySlot = useMemo(() => {
    const grouped = {};
    schedule.forEach((s) => {
      if (!grouped[s.slot_number]) grouped[s.slot_number] = [];
      grouped[s.slot_number].push(s);
    });
    return Object.entries(grouped)
      .map(([slot, rows]) => ({ slot: Number(slot), rows }))
      .sort((a, b) => a.slot - b.slot);
  }, [schedule]);

  const violatedCount = schedule.filter((s) => s.constraint_violated).length;

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Jadwal Harian</h1>
      <p style={{ color: '#64748b', marginTop: 0, marginBottom: 24 }}>
        Input pasien yang datang hari ini, lalu sistem otomatis membagi ke terapis.
      </p>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>Tanggal:</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1' }}
        />
      </div>

      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 20, marginBottom: 24 }}>
        <h3 style={{ marginTop: 0, fontSize: 15 }}>
          Pasien Datang Hari Ini ({dailyListIds.length})
        </h3>

        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <select
            value={addPatientId}
            onChange={(e) => setAddPatientId(e.target.value)}
            style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1' }}
          >
            <option value="">-- Pilih pasien untuk ditambahkan --</option>
            {availablePatientsToAdd.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <button
            onClick={handleAddPatient}
            disabled={!addPatientId}
            style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#2563eb', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
          >
            + Tambah
          </button>
        </div>

        {dailyListIds.length === 0 ? (
          <p style={{ color: '#94a3b8', fontSize: 13 }}>Belum ada pasien ditambahkan untuk tanggal ini.</p>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {dailyListIds.map((id) => (
              <span
                key={id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '6px 10px', borderRadius: 999, background: '#eff6ff',
                  border: '1px solid #bfdbfe', fontSize: 13, color: '#1d4ed8',
                }}
              >
                {patientMap[id]?.name || '...'}
                <button
                  onClick={() => handleRemovePatient(id)}
                  style={{ border: 'none', background: 'none', color: '#1d4ed8', cursor: 'pointer', fontWeight: 700 }}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={handleGenerate}
        disabled={generating}
        style={{
          padding: '12px 24px', borderRadius: 10, border: 'none',
          background: '#16a34a', color: '#fff', fontWeight: 700, fontSize: 14,
          cursor: 'pointer', marginBottom: 20,
        }}
      >
        {generating ? 'Memproses...' : 'Generate Jadwal Otomatis'}
      </button>

      {message && (
        <p style={{ color: message.type === 'error' ? '#dc2626' : '#16a34a', fontWeight: 600, marginBottom: 16 }}>
          {message.text}
        </p>
      )}

      {loading ? (
        <p>Memuat...</p>
      ) : schedule.length === 0 ? (
        <p style={{ color: '#94a3b8' }}>Belum ada jadwal untuk tanggal ini. Klik "Generate Jadwal Otomatis" di atas.</p>
      ) : (
        <div>
          {violatedCount > 0 && (
            <div style={{ background: '#fef3c7', border: '1px solid #fde68a', color: '#92400e', padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
              ⚠️ {violatedCount} pasien terpaksa mendapat terapis yang sama dengan kunjungan sebelumnya (tidak ada opsi lain yang memungkinkan pada hari ini).
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {scheduleBySlot.map(({ slot, rows }) => (
              <div key={slot} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Slot {slot}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${therapists.length}, 1fr)`, gap: 12 }}>
                  {therapists.map((th) => {
                    const row = rows.find((r) => r.therapist_id === th.id);
                    return (
                      <div
                        key={th.id}
                        style={{
                          padding: '10px 14px', borderRadius: 8,
                          background: row ? (row.constraint_violated ? '#fef2f2' : '#f0fdf4') : '#f8fafc',
                          border: `1px solid ${row ? (row.constraint_violated ? '#fecaca' : '#bbf7d0') : '#e2e8f0'}`,
                        }}
                      >
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 4 }}>{th.name}</div>
                        {row ? (
                          <div style={{ fontSize: 14, fontWeight: 600 }}>
                            {patientMap[row.patient_id]?.name || '-'}
                            {row.constraint_violated && <span style={{ marginLeft: 6 }}>⚠️</span>}
                          </div>
                        ) : (
                          <div style={{ fontSize: 13, color: '#cbd5e1' }}>-</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default RotasiDailySchedule;