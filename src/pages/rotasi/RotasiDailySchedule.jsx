import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  const [globalSlots, setGlobalSlots] = useState([]);
  const [dailySlotMap, setDailySlotMap] = useState({});
  const [selectedSlotId, setSelectedSlotId] = useState('');
  const [patientSearch, setPatientSearch] = useState('');
  const [showPatientSuggestions, setShowPatientSuggestions] = useState(false);
  const searchInputRef = useRef(null);

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
    const [{ data: list }, { data: sched }, { data: gslots }] = await Promise.all([
      supabase.from('rotasi_daily_list').select('patient_id, global_slot_id').eq('visit_date', d),
      supabase.from('rotasi_schedule').select('*').eq('visit_date', d),
      supabase.from('rotasi_global_slots').select('*').eq('slot_date', d).order('start_time', { ascending: true }),
    ]);
    setDailyListIds((list || []).map((r) => r.patient_id));
    const slotMap = {};
    (list || []).forEach((r) => {
      slotMap[r.patient_id] = r.global_slot_id || null;
    });
    setDailySlotMap(slotMap);
    setSchedule(sched || []);
    setGlobalSlots(gslots || []);
    setSelectedSlotId('');
    setLoading(false);
  };

  const patientMap = useMemo(() => {
    const m = {};
    allPatients.forEach((p) => { m[p.id] = p; });
    return m;
  }, [allPatients]);

  const availablePatientsToAdd = useMemo(
    () => allPatients.filter((p) => !dailyListIds.includes(p.id)),
    [allPatients, dailyListIds]
  );

  const filteredPatientsToAdd = useMemo(() => {
    const q = patientSearch.trim().toLowerCase();
    if (!q) return availablePatientsToAdd;
    const startsWithMatch = [];
    const containsMatch = [];
    availablePatientsToAdd.forEach((p) => {
      const name = p.name.toLowerCase();
      if (name.startsWith(q)) {
        startsWithMatch.push(p);
      } else if (name.includes(q)) {
        containsMatch.push(p);
      }
    });
    return [...startsWithMatch, ...containsMatch];
  }, [availablePatientsToAdd, patientSearch]);

  const handleSelectPatient = (p) => {
    if (selectedSlotId) {
      insertPatientToSlot(p.id, selectedSlotId);
      return;
    }
    setAddPatientId(p.id);
    setPatientSearch(p.name);
    setShowPatientSuggestions(false);
  };

  const patientsBySlot = useMemo(() => {
    const map = {};
    dailyListIds.forEach((id) => {
      const slotId = dailySlotMap[id] || 'none';
      if (!map[slotId]) map[slotId] = [];
      map[slotId].push(id);
    });
    return map;
  }, [dailyListIds, dailySlotMap]);

  const unassignedPatients = patientsBySlot['none'] || [];

  const insertPatientToSlot = async (patientId, slotId) => {
    const { error } = await supabase
      .from('rotasi_daily_list')
      .insert({ visit_date: date, patient_id: patientId, global_slot_id: slotId || null });
    if (!error) {
      setDailyListIds((prev) => [...prev, patientId]);
      setDailySlotMap((prev) => ({ ...prev, [patientId]: slotId || null }));
      setAddPatientId('');
      setPatientSearch('');
      setShowPatientSuggestions(false);
    } else {
      window.alert('Gagal menambah pasien: ' + error.message);
    }
  };

  const handleAddPatient = async () => {
    if (!addPatientId) return;
    await insertPatientToSlot(addPatientId, selectedSlotId);
  };

  const handleSlotCardClick = (slotId) => {
    setSelectedSlotId(slotId);
    setPatientSearch('');
    setAddPatientId('');
    setShowPatientSuggestions(false);
    setTimeout(() => searchInputRef.current?.focus(), 0);
  };

  const handleRemovePatient = async (patientId) => {
    await supabase
      .from('rotasi_daily_list')
      .delete()
      .eq('visit_date', date)
      .eq('patient_id', patientId);
    setDailyListIds((prev) => prev.filter((id) => id !== patientId));
    setDailySlotMap((prev) => {
      const next = { ...prev };
      delete next[patientId];
      return next;
    });
    setSchedule((prev) => prev.filter((s) => s.patient_id !== patientId));
  };

  const handleMovePatientSlot = async (patientId, newSlotId) => {
    const { error } = await supabase
      .from('rotasi_daily_list')
      .update({ global_slot_id: newSlotId || null })
      .eq('visit_date', date)
      .eq('patient_id', patientId);
    if (!error) {
      setDailySlotMap((prev) => ({ ...prev, [patientId]: newSlotId || null }));
    } else {
      window.alert('Gagal memindahkan slot: ' + error.message);
    }
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

      const [
        { data: history, error: histErr },
        { data: workingHoursRows, error: whErr },
        { data: leaveRows, error: leaveErr },
      ] = await Promise.all([
        supabase
          .from('rotasi_schedule')
          .select('patient_id, therapist_id, visit_date')
          .in('patient_id', dailyListIds)
          .lt('visit_date', date)
          .order('visit_date', { ascending: false }),
        supabase
          .from('rotasi_slots')
          .select('therapist_id, start_time, end_time')
          .eq('is_active', true),
        supabase
          .from('rotasi_therapist_leave')
          .select('therapist_id')
          .eq('leave_date', date),
      ]);

      if (histErr) throw histErr;
      if (whErr) throw whErr;
      if (leaveErr) throw leaveErr;

      const lastVisitMap = {};
      (history || []).forEach((row) => {
        if (!lastVisitMap[row.patient_id]) {
          lastVisitMap[row.patient_id] = row.therapist_id;
        }
      });

      const therapistWorkingHours = {};
      (workingHoursRows || []).forEach((row) => {
        if (!row.therapist_id) return;
        if (!therapistWorkingHours[row.therapist_id]) therapistWorkingHours[row.therapist_id] = [];
        therapistWorkingHours[row.therapist_id].push({ start_time: row.start_time, end_time: row.end_time });
      });

      const leaveTherapistIds = new Set((leaveRows || []).map((r) => r.therapist_id));

      const patientsToday = dailyListIds.map((id) => patientMap[id]).filter(Boolean);
      const { assignments, unassigned } = generateSchedule({
        patients: patientsToday,
        therapists,
        lastVisitMap,
        patientSlotMap: dailySlotMap,
        globalSlots,
        therapistWorkingHours,
        leaveTherapistIds,
      });

      const rows = assignments.map((r) => ({
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
      if (unassigned.length > 0) {
        setMessage({
          type: 'error',
          text: `Jadwal dibuat, tapi ${unassigned.length} pasien tidak kebagian terapis di sesinya (sesi penuh / terapis cuti / jam kerja tidak cocok). Pindahkan pasien tersebut ke sesi lain, lalu generate ulang.`,
        });
      } else {
        setMessage({ type: 'success', text: 'Jadwal berhasil dibuat.' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setGenerating(false);
    }
  };

  const scheduleBySlot = useMemo(() => {
    const slotInfoMap = {};
    globalSlots.forEach((s) => {
      slotInfoMap[s.id] = s;
    });
    const grouped = {};
    schedule.forEach((s) => {
      const gid = dailySlotMap[s.patient_id] || 'none';
      if (!grouped[gid]) grouped[gid] = [];
      grouped[gid].push(s);
    });
    return Object.entries(grouped)
      .map(([slotId, rows]) => ({
        slotId,
        slotInfo: slotInfoMap[slotId] || null,
        rows,
      }))
      .sort((a, b) => {
        if (a.slotId === 'none') return 1;
        if (b.slotId === 'none') return -1;
        return (a.slotInfo?.start_time || '').localeCompare(b.slotInfo?.start_time || '');
      });
  }, [schedule, globalSlots, dailySlotMap]);

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

      <div
        style={{
          background: 'linear-gradient(180deg, #ffffff 0%, #fafbff 100%)',
          border: '1px solid #e5e9f2',
          borderRadius: 18,
          padding: 24,
          marginBottom: 24,
          boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04), 0 8px 24px rgba(15, 23, 42, 0.04)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0f172a', letterSpacing: -0.2 }}>
            Booking Pasien per Slot
          </h3>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>
            {dailyListIds.length} pasien terdaftar
          </span>
        </div>
        <p style={{ color: '#94a3b8', fontSize: 12.5, marginTop: 2, marginBottom: 20 }}>
          Pilih slot dan pasien, sistem otomatis menempatkannya ke kartu slot yang sesuai.
        </p>

        <div
          style={{
            background: selectedSlotId ? '#eff6ff' : '#f8fafc',
            border: `1px solid ${selectedSlotId ? '#bfdbfe' : '#eef1f6'}`,
            borderRadius: 14,
            padding: 12,
            marginBottom: 24,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: selectedSlotId ? '#1d4ed8' : '#94a3b8' }}>
              {selectedSlotId
                ? `Menambahkan pasien ke: ${globalSlots.find((s) => s.id === selectedSlotId)?.label || ''}`
                : '↑ Klik salah satu kartu slot di bawah untuk mulai menambahkan pasien'}
            </span>
            {selectedSlotId && (
              <button
                onClick={() => { setSelectedSlotId(''); setPatientSearch(''); setAddPatientId(''); }}
                style={{ border: 'none', background: 'none', color: '#1d4ed8', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
              >
                Batal pilih slot
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
              <input
                ref={searchInputRef}
                type="text"
                value={patientSearch}
                onChange={(e) => {
                  setPatientSearch(e.target.value);
                  setAddPatientId('');
                  setShowPatientSuggestions(true);
                }}
                onFocus={() => setShowPatientSuggestions(true)}
                onBlur={() => setTimeout(() => setShowPatientSuggestions(false), 150)}
                placeholder={selectedSlotId ? 'Ketik nama pasien, klik untuk langsung menambahkan...' : 'Ketik nama pasien untuk mencari...'}
                style={{
                  width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10,
                  border: '1px solid #dbe2ee', fontSize: 13.5, background: '#fff',
                }}
              />
              {showPatientSuggestions && patientSearch && (
                <div
                  style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4,
                    background: '#fff', border: '1px solid #dbe2ee', borderRadius: 10,
                    boxShadow: '0 8px 24px rgba(15,23,42,0.08)', maxHeight: 220, overflowY: 'auto', zIndex: 20,
                  }}
                >
                  {filteredPatientsToAdd.length === 0 ? (
                    <div style={{ padding: '10px 12px', fontSize: 13, color: '#94a3b8' }}>Tidak ada pasien ditemukan.</div>
                  ) : (
                    filteredPatientsToAdd.slice(0, 30).map((p) => (
                      <div
                        key={p.id}
                        onMouseDown={() => handleSelectPatient(p)}
                        style={{
                          padding: '9px 12px', fontSize: 13, color: '#1e293b', cursor: 'pointer',
                          borderBottom: '1px solid #f1f5f9',
                        }}
                      >
                        {p.name}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
            {!selectedSlotId && (
              <button
                onClick={handleAddPatient}
                disabled={!addPatientId}
                style={{
                  padding: '10px 20px', borderRadius: 10, border: 'none',
                  background: !addPatientId ? '#cbd5e1' : 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                  color: '#fff', fontWeight: 700, fontSize: 13.5,
                  cursor: !addPatientId ? 'not-allowed' : 'pointer',
                  boxShadow: !addPatientId ? 'none' : '0 4px 12px rgba(37, 99, 235, 0.28)',
                }}
              >
                + Tambah
              </button>
            )}
          </div>
        </div>

        {globalSlots.length === 0 ? (
          <p style={{ color: '#94a3b8', fontSize: 13 }}>
            Belum ada slot global untuk tanggal ini. Tambahkan di menu Setup &gt; Slot Global.
          </p>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
              gap: 14,
              marginBottom: unassignedPatients.length > 0 ? 18 : 0,
            }}
          >
            {globalSlots.map((s) => {
              const patientIds = patientsBySlot[s.id] || [];
              const used = patientIds.length;
              const pct = s.capacity ? Math.min(100, Math.round((used / s.capacity) * 100)) : 0;
              const barColor = s.capacity == null ? '#94a3b8' : pct >= 100 ? '#dc2626' : pct >= 70 ? '#d97706' : '#16a34a';
              const isFull = s.capacity != null && used >= s.capacity;
              const isSelected = selectedSlotId === s.id;
              return (
                <div
                  key={s.id}
                  onClick={() => !isFull && handleSlotCardClick(s.id)}
                  style={{
                    background: isSelected ? '#eff6ff' : '#fff',
                    borderRadius: 14,
                    border: `1px solid ${isSelected ? '#93c5fd' : '#e9edf4'}`,
                    borderLeft: `4px solid ${barColor}`,
                    padding: 14,
                    boxShadow: isSelected ? '0 0 0 3px rgba(59,130,246,0.15)' : '0 1px 2px rgba(15,23,42,0.03)',
                    cursor: isFull ? 'not-allowed' : 'pointer',
                    opacity: isFull ? 0.7 : 1,
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <div style={{ fontSize: 13.5, fontWeight: 800, color: '#0f172a' }}>{s.label}</div>
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: barColor }}>
                      {used}{s.capacity != null ? `/${s.capacity}` : ''}
                    </div>
                  </div>
                  <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 1, marginBottom: 8 }}>
                    {s.start_time || '-'}{s.end_time ? ` - ${s.end_time}` : ''}
                  </div>

                  {s.capacity != null && (
                    <div style={{ height: 5, borderRadius: 999, background: '#f1f5f9', overflow: 'hidden', marginBottom: 10 }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: 999, transition: 'width 0.2s' }} />
                    </div>
                  )}

                  {patientIds.length === 0 ? (
                    <div style={{ fontSize: 12, color: '#cbd5e1', fontStyle: 'italic' }}>Belum ada pasien</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {patientIds.map((id) => (
                        <div
                          key={id}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '6px 10px', borderRadius: 9, background: '#f8fafc',
                            border: '1px solid #eef1f6', fontSize: 12.5, color: '#334155',
                          }}
                        >
                          <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {patientMap[id]?.name || '...'}
                          </span>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleRemovePatient(id); }}
                            style={{ border: 'none', background: 'none', color: '#94a3b8', cursor: 'pointer', fontWeight: 700, marginLeft: 8, flexShrink: 0 }}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {unassignedPatients.length > 0 && (
          <div style={{ borderTop: '1px dashed #e2e8f0', paddingTop: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.4 }}>
              Belum Ditentukan Slot ({unassignedPatients.length})
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {unassignedPatients.map((id) => (
                <div
                  key={id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '6px 8px 6px 12px', borderRadius: 999, background: '#fff7ed',
                    border: '1px solid #fed7aa', fontSize: 12.5, color: '#9a3412',
                  }}
                >
                  {patientMap[id]?.name || '...'}
                  <select
                    value=""
                    onChange={(e) => e.target.value && handleMovePatientSlot(id, e.target.value)}
                    style={{ fontSize: 11, border: 'none', background: 'transparent', color: '#c2410c', fontWeight: 700, cursor: 'pointer' }}
                  >
                    <option value="">Pindah ke slot...</option>
                    {globalSlots.map((s) => (
                      <option key={s.id} value={s.id}>{s.label}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => handleRemovePatient(id)}
                    style={{ border: 'none', background: 'none', color: '#c2410c', cursor: 'pointer', fontWeight: 700 }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
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
            {scheduleBySlot.map(({ slotId, slotInfo, rows }) => (
              <div key={slotId} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  {slotInfo
                    ? `${slotInfo.label}${slotInfo.start_time ? ` • ${slotInfo.start_time}` : ''}`
                    : 'Belum Ditentukan Slot'}
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