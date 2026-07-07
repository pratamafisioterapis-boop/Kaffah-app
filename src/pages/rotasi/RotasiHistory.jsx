import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';

const THERAPIST_COLORS = [
  { bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8', avatar: '#3b82f6' },
  { bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d', avatar: '#22c55e' },
  { bg: '#fdf4ff', border: '#e9d5ff', text: '#7e22ce', avatar: '#a855f7' },
  { bg: '#fff7ed', border: '#fed7aa', text: '#c2410c', avatar: '#f97316' },
  { bg: '#f0f9ff', border: '#bae6fd', text: '#0369a1', avatar: '#0ea5e9' },
  { bg: '#fef9c3', border: '#fde68a', text: '#854d0e', avatar: '#eab308' },
];

const RotasiHistory = () => {
  const [allSchedule, setAllSchedule] = useState([]);
  const [patients, setPatients] = useState([]);
  const [therapists, setTherapists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedDate, setExpandedDate] = useState(null);
  const [search, setSearch] = useState('');
  const [filterTherapist, setFilterTherapist] = useState('');
  const [deletingDate, setDeletingDate] = useState(null);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    const [{ data: sched }, { data: pts }, { data: ths }] = await Promise.all([
      supabase.from('rotasi_schedule').select('*').eq('confirmed', true).order('visit_date', { ascending: false }),
      supabase.from('rotasi_patients').select('id, name, medical_record_number'),
      supabase.from('rotasi_therapists').select('id, name'),
    ]);
    setAllSchedule(sched || []);
    setPatients(pts || []);
    setTherapists(ths || []);
    setLoading(false);
  };

  const patientMap = useMemo(() => {
    const m = {};
    patients.forEach((p) => { m[p.id] = p; });
    return m;
  }, [patients]);

  const therapistMap = useMemo(() => {
    const m = {};
    therapists.forEach((t) => { m[t.id] = t; });
    return m;
  }, [therapists]);

  const therapistColorMap = useMemo(() => {
    const m = {};
    therapists.forEach((t, i) => { m[t.id] = THERAPIST_COLORS[i % THERAPIST_COLORS.length]; });
    return m;
  }, [therapists]);

  const groupedByDate = useMemo(() => {
    const realSchedule = allSchedule.filter((s) => s.slot_number !== 0);
    const grouped = {};
    realSchedule.forEach((s) => {
      if (!grouped[s.visit_date]) grouped[s.visit_date] = [];
      grouped[s.visit_date].push(s);
    });
    return Object.entries(grouped)
      .map(([date, rows]) => {
        const byTherapist = {};
        rows.forEach((r) => {
          if (!byTherapist[r.therapist_id]) byTherapist[r.therapist_id] = [];
          byTherapist[r.therapist_id].push(r);
        });
        return {
          date,
          rows,
          byTherapist,
          violatedCount: rows.filter((r) => r.constraint_violated).length,
          totalPatients: rows.length,
        };
      })
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [allSchedule]);

  const filtered = useMemo(() => {
    let result = groupedByDate;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(({ rows }) =>
        rows.some((r) =>
          (patientMap[r.patient_id]?.name || '').toLowerCase().includes(q) ||
          (therapistMap[r.therapist_id]?.name || '').toLowerCase().includes(q)
        )
      );
    }
    if (filterTherapist) {
      result = result.filter(({ rows }) => rows.some((r) => r.therapist_id === filterTherapist));
    }
    return result;
  }, [groupedByDate, search, filterTherapist, patientMap, therapistMap]);

  const handleDelete = async (date) => {
    if (!window.confirm(`Hapus riwayat jadwal ${new Date(date + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}?\n\nSemua data pembagian terapis pada hari ini akan dihapus permanen.`)) return;
    setDeletingDate(date);
    const { error } = await supabase.from('rotasi_schedule').delete().eq('visit_date', date).eq('confirmed', true);
    if (!error) {
      setAllSchedule((prev) => prev.filter((s) => s.visit_date !== date));
      if (expandedDate === date) setExpandedDate(null);
    } else {
      window.alert('Gagal menghapus: ' + error.message);
    }
    setDeletingDate(null);
  };

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Riwayat Jadwal</h1>
        <p style={{ color: '#64748b', margin: '4px 0 0' }}>
          Jadwal yang sudah dikonfirmasi. Klik tanggal untuk melihat detail pembagian terapis.
        </p>
      </div>

      {!loading && groupedByDate.length > 0 && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama pasien / terapis..."
            style={{
              padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0',
              fontSize: 13, outline: 'none', flex: 1, minWidth: 200,
            }}
          />
          <select
            value={filterTherapist}
            onChange={(e) => setFilterTherapist(e.target.value)}
            style={{
              padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0',
              fontSize: 13, background: '#fff', color: '#334155',
            }}
          >
            <option value="">Semua Terapis</option>
            {therapists.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          {(search || filterTherapist) && (
            <button
              onClick={() => { setSearch(''); setFilterTherapist(''); }}
              style={{
                padding: '8px 14px', borderRadius: 8, border: '1px solid #e2e8f0',
                background: '#f8fafc', color: '#64748b', cursor: 'pointer', fontSize: 13,
              }}
            >
              ✕ Reset
            </button>
          )}
        </div>
      )}

      {loading ? (
        <p style={{ color: '#94a3b8' }}>Memuat...</p>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
          <p style={{ fontWeight: 700, fontSize: 15, color: '#334155', margin: '0 0 4px' }}>
            {groupedByDate.length === 0 ? 'Belum ada riwayat jadwal' : 'Tidak ada hasil pencarian'}
          </p>
          <p style={{ fontSize: 13, color: '#94a3b8', margin: 0 }}>
            {groupedByDate.length === 0
              ? 'Buat jadwal di menu Jadwal Hari Ini, lalu konfirmasi agar masuk ke riwayat.'
              : 'Coba kata kunci atau filter yang berbeda.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(({ date, rows, byTherapist, violatedCount, totalPatients }) => {
            const isOpen = expandedDate === date;
            const therapistIds = Object.keys(byTherapist);
            const isDeleting = deletingDate === date;
            return (
              <div
                key={date}
                style={{
                  background: '#fff',
                  border: `1px solid ${isOpen ? '#bfdbfe' : '#e2e8f0'}`,
                  borderRadius: 14,
                  overflow: 'hidden',
                  boxShadow: isOpen ? '0 4px 16px rgba(37,99,235,0.08)' : '0 1px 3px rgba(0,0,0,0.03)',
                }}
              >
                {/* Header baris tanggal */}
                <div style={{ display: 'flex', alignItems: 'center', padding: '14px 18px', gap: 12 }}>
                  {/* Tanggal */}
                  <div
                    style={{
                      flexShrink: 0, textAlign: 'center', background: '#f8fafc',
                      border: '1px solid #e2e8f0', borderRadius: 10, padding: '8px 12px', minWidth: 52,
                    }}
                  >
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      {new Date(date + 'T00:00:00').toLocaleDateString('id-ID', { month: 'short' })}
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', lineHeight: 1.1 }}>
                      {new Date(date + 'T00:00:00').getDate()}
                    </div>
                    <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600 }}>
                      {new Date(date + 'T00:00:00').getFullYear()}
                    </div>
                  </div>

                  {/* Info klik-able */}
                  <button
                    onClick={() => setExpandedDate(isOpen ? null : date)}
                    style={{
                      flex: 1, minWidth: 0, background: 'none', border: 'none',
                      cursor: 'pointer', textAlign: 'left', padding: 0,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>
                        {new Date(date + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long' })}
                      </span>
                      {violatedCount > 0 && (
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
                          background: '#fef3c7', color: '#92400e',
                        }}>
                          ⚠️ {violatedCount} pelanggaran
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 14, marginTop: 5, flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: '#64748b' }}>
                        <strong style={{ color: '#0f172a' }}>{totalPatients}</strong> pasien
                      </span>
                      <span style={{ fontSize: 12, color: '#64748b' }}>
                        <strong style={{ color: '#0f172a' }}>{therapistIds.length}</strong> terapis
                      </span>
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                        {therapistIds.slice(0, 4).map((tid) => {
                          const col = therapistColorMap[tid] || THERAPIST_COLORS[0];
                          return (
                            <span key={tid} style={{
                              fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999,
                              background: col.bg, color: col.text, border: `1px solid ${col.border}`,
                            }}>
                              {therapistMap[tid]?.name || '-'}
                            </span>
                          );
                        })}
                        {therapistIds.length > 4 && (
                          <span style={{ fontSize: 11, color: '#94a3b8' }}>+{therapistIds.length - 4}</span>
                        )}
                      </div>
                    </div>
                  </button>

                  {/* Aksi kanan */}
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' }}>
                    <button
                      onClick={() => handleDelete(date)}
                      disabled={isDeleting}
                      title="Hapus riwayat hari ini"
                      style={{
                        padding: '6px 10px', borderRadius: 7, border: '1px solid #fecaca',
                        background: '#fef2f2', color: '#dc2626', cursor: 'pointer',
                        fontSize: 12, fontWeight: 600,
                      }}
                    >
                      {isDeleting ? '...' : 'Hapus'}
                    </button>
                    <div style={{
                      width: 28, height: 28, borderRadius: 7, cursor: 'pointer',
                      background: isOpen ? '#eff6ff' : '#f8fafc',
                      border: `1px solid ${isOpen ? '#bfdbfe' : '#e2e8f0'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, color: isOpen ? '#2563eb' : '#94a3b8',
                    }}
                      onClick={() => setExpandedDate(isOpen ? null : date)}
                    >
                      {isOpen ? '▲' : '▼'}
                    </div>
                  </div>
                </div>

                {/* Detail expand: kolom per terapis */}
                {isOpen && (
                  <div style={{ borderTop: '1px solid #f1f5f9', padding: 18 }}>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: `repeat(${Math.min(therapistIds.length, 3)}, 1fr)`,
                      gap: 12,
                    }}>
                      {therapistIds.map((tid) => {
                        const col = therapistColorMap[tid] || THERAPIST_COLORS[0];
                        const tRows = byTherapist[tid].sort((a, b) => a.slot_number - b.slot_number);
                        return (
                          <div key={tid} style={{ background: col.bg, border: `1px solid ${col.border}`, borderRadius: 12, overflow: 'hidden' }}>
                            {/* Header kolom */}
                            <div style={{
                              padding: '10px 14px', borderBottom: `1px solid ${col.border}`,
                              display: 'flex', alignItems: 'center', gap: 8,
                            }}>
                              <div style={{
                                width: 30, height: 30, borderRadius: 8,
                                background: col.avatar, color: '#fff',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontWeight: 800, fontSize: 13, flexShrink: 0,
                              }}>
                                {(therapistMap[tid]?.name || '?').charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div style={{ fontWeight: 700, fontSize: 13, color: col.text }}>
                                  {therapistMap[tid]?.name || '-'}
                                </div>
                                <div style={{ fontSize: 11, color: col.text, opacity: 0.7 }}>
                                  {tRows.length} pasien
                                </div>
                              </div>
                            </div>
                            {/* Daftar pasien */}
                            <div style={{ padding: '6px 0' }}>
                              {tRows.map((r, idx) => {
                                const patient = patientMap[r.patient_id];
                                return (
                                  <div key={r.id} style={{
                                    padding: '8px 14px',
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    borderBottom: idx < tRows.length - 1 ? `1px solid ${col.border}` : 'none',
                                  }}>
                                    <div>
                                      <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>
                                        {patient?.name || '(dihapus)'}
                                        {r.constraint_violated && <span style={{ marginLeft: 5 }}>⚠️</span>}
                                      </div>
                                      {patient?.medical_record_number && (
                                        <div style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'monospace' }}>
                                          {patient.medical_record_number}
                                        </div>
                                      )}
                                    </div>
                                    <span style={{
                                      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
                                      background: 'rgba(255,255,255,0.7)', color: col.text,
                                      border: `1px solid ${col.border}`, flexShrink: 0,
                                    }}>
                                      Sesi {r.slot_number}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {violatedCount > 0 && (
                      <div style={{
                        marginTop: 12, padding: '10px 14px', borderRadius: 10,
                        background: '#fef3c7', border: '1px solid #fde68a',
                        fontSize: 12, color: '#92400e', fontWeight: 600,
                      }}>
                        ⚠️ {violatedCount} pasien mendapat terapis yang sama dengan kunjungan sebelumnya karena tidak ada pilihan lain.
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div style={{ marginTop: 20, fontSize: 13, color: '#94a3b8', textAlign: 'center' }}>
          Menampilkan <strong style={{ color: '#334155' }}>{filtered.length}</strong> dari{' '}
          <strong style={{ color: '#334155' }}>{groupedByDate.length}</strong> hari jadwal
        </div>
      )}
    </div>
  );
};

export default RotasiHistory;