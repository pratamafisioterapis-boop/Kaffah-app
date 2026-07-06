import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';

const RotasiHistory = () => {
  const [allSchedule, setAllSchedule] = useState([]);
  const [patients, setPatients] = useState([]);
  const [therapists, setTherapists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedDate, setExpandedDate] = useState(null);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    const [{ data: sched }, { data: pts }, { data: ths }] = await Promise.all([
      supabase.from('rotasi_schedule').select('*').order('visit_date', { ascending: false }),
      supabase.from('rotasi_patients').select('*'),
      supabase.from('rotasi_therapists').select('*'),
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

  const groupedByDate = useMemo(() => {
    const grouped = {};
    allSchedule.forEach((s) => {
      if (!grouped[s.visit_date]) grouped[s.visit_date] = [];
      grouped[s.visit_date].push(s);
    });
    return Object.entries(grouped)
      .map(([date, rows]) => ({
        date,
        rows,
        violatedCount: rows.filter((r) => r.constraint_violated).length,
      }))
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [allSchedule]);

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Riwayat Jadwal</h1>
      <p style={{ color: '#64748b', marginTop: 0, marginBottom: 24 }}>
        Semua jadwal yang pernah dibuat, terbaru di atas.
      </p>

      {loading ? (
        <p>Memuat...</p>
      ) : groupedByDate.length === 0 ? (
        <p style={{ color: '#94a3b8' }}>Belum ada riwayat jadwal.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {groupedByDate.map(({ date, rows, violatedCount }) => {
            const isOpen = expandedDate === date;
            return (
              <div key={date} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
                <button
                  onClick={() => setExpandedDate(isOpen ? null : date)}
                  style={{
                    width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '14px 18px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>
                      {new Date(date + 'T00:00:00').toLocaleDateString('id-ID', {
                        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                      })}
                    </div>
                    <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
                      {rows.length} pasien dijadwalkan
                      {violatedCount > 0 && (
                        <span style={{ color: '#d97706', fontWeight: 600 }}> · {violatedCount} pelanggaran syarat</span>
                      )}
                    </div>
                  </div>
                  <span style={{ fontSize: 18 }}>{isOpen ? '−' : '+'}</span>
                </button>

                {isOpen && (
                  <div style={{ padding: '0 18px 18px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {rows
                      .sort((a, b) => a.slot_number - b.slot_number)
                      .map((r) => (
                        <div
                          key={r.id}
                          style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            padding: '8px 12px', borderRadius: 8,
                            background: r.constraint_violated ? '#fef2f2' : '#f8fafc',
                            fontSize: 13,
                          }}
                        >
                          <span>
                            <strong>Slot {r.slot_number}</strong> — {patientMap[r.patient_id]?.name || '(dihapus)'}
                          </span>
                          <span style={{ color: '#64748b' }}>
                            {therapistMap[r.therapist_id]?.name || '(dihapus)'}
                            {r.constraint_violated && <span style={{ marginLeft: 6 }}>⚠️</span>}
                          </span>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default RotasiHistory;