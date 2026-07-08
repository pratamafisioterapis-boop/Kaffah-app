import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/customSupabaseClient';

const todayStr = () => new Date().toISOString().split('T')[0];

const HARI = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
const BULAN = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

const formatTanggal = (dateStr) => {
  const d = new Date(dateStr + 'T00:00:00');
  return `${HARI[d.getDay()]}, ${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`;
};

// Emoji terapis - warna berbeda tiap terapis
const TERAPIS_COLORS = ['💙','💜','💛','💚','🧡','❤️','🩷','🩵'];

const RotasiTemplateWA = () => {
  const [date, setDate] = useState(todayStr());
  const [schedule, setSchedule] = useState([]);
  const [patients, setPatients] = useState([]);
  const [therapists, setTherapists] = useState([]);
  const [globalSlots, setGlobalSlots] = useState([]);
  const [dailySlotMap, setDailySlotMap] = useState({});
  const [insuranceTypes, setInsuranceTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  // Header & catatan bisa diedit
  const [headerText, setHeaderText] = useState('DAFTAR KEHADIRAN ANAK DI KLINIK TUMBUH KEMBANG - RSPB');
  const [catatanText, setCatatanText] = useState('Untuk kelancaran proses terapi kami mengharapkan kerja sama dari orang tua, apabila orang tua sdh mengisi daftar hadir d harapkan berkomitmen dan hadir tepat waktu, jika berhalangan hadir wajib konfirmasi d grup.');
  const [footerText, setFooterText] = useState('Terima kasih🙏🙏');
  const [showEdit, setShowEdit] = useState(false);

  useEffect(() => {
    loadStatic();
  }, []);

  useEffect(() => {
    loadForDate(date);
  }, [date]);

  const loadStatic = async () => {
    // Pasien dengan pagination
    let allPts = [];
    let from = 0;
    while (true) {
      const { data: batch } = await supabase
        .from('rotasi_patients')
        .select('id, name, insurance_type_id')
        .range(from, from + 999);
      if (!batch || batch.length === 0) break;
      allPts = [...allPts, ...batch];
      if (batch.length < 1000) break;
      from += 1000;
    }
    const [{ data: ths }, { data: ins }] = await Promise.all([
      supabase.from('rotasi_therapists').select('id, name').eq('is_active', true),
      supabase.from('rotasi_insurance_types').select('id, name'),
    ]);
    setPatients(allPts);
    setTherapists(ths || []);
    setInsuranceTypes(ins || []);
  };

  const loadForDate = async (d) => {
    setLoading(true);
    const [{ data: sched }, { data: slots }, { data: gslots }] = await Promise.all([
      supabase.from('rotasi_schedule').select('*').eq('visit_date', d),
      supabase.from('rotasi_daily_list').select('patient_id, global_slot_id').eq('visit_date', d),
      supabase.from('rotasi_global_slots').select('*').eq('slot_date', d).order('start_time', { ascending: true }),
    ]);
    setSchedule(sched || []);
    setGlobalSlots(gslots || []);
    const slotMap = {};
    (slots || []).forEach((r) => { slotMap[r.patient_id] = r.global_slot_id || null; });
    setDailySlotMap(slotMap);
    setLoading(false);
  };

  const patientMap = useMemo(() => {
    const m = {};
    patients.forEach((p) => { m[p.id] = p; });
    return m;
  }, [patients]);

  const therapistMap = useMemo(() => {
    const m = {};
    therapists.forEach((t, i) => { m[t.id] = { ...t, colorEmoji: TERAPIS_COLORS[i % TERAPIS_COLORS.length] }; });
    return m;
  }, [therapists]);

  const insuranceMap = useMemo(() => {
    const m = {};
    insuranceTypes.forEach((it) => { m[it.id] = it.name; });
    return m;
  }, [insuranceTypes]);

  // Kelompokkan schedule per slot global, urut by start_time
  const scheduleBySlot = useMemo(() => {
    const slotInfoMap = {};
    globalSlots.forEach((s) => { slotInfoMap[s.id] = s; });

    const grouped = {};
    schedule.forEach((s) => {
      const slotId = dailySlotMap[s.patient_id] || 'none';
      if (!grouped[slotId]) grouped[slotId] = [];
      grouped[slotId].push(s);
    });

    return Object.entries(grouped)
      .filter(([slotId]) => slotId !== 'none')
      .map(([slotId, rows]) => ({
        slotId,
        slotInfo: slotInfoMap[slotId] || null,
        rows,
      }))
      .sort((a, b) => (a.slotInfo?.start_time || '').localeCompare(b.slotInfo?.start_time || ''));
  }, [schedule, globalSlots, dailySlotMap]);

  // Generate teks WA
  const waText = useMemo(() => {
    const lines = [];
    lines.push(`*${headerText}*`);
    lines.push(`*Hari ${formatTanggal(date)}*`);
    lines.push('');
    lines.push('_*🌸 CATATAN 🌸*_');
    lines.push(`** *${catatanText}***`);
    lines.push('');

    scheduleBySlot.forEach(({ slotInfo, rows }) => {
      const jam = slotInfo?.start_time ? slotInfo.start_time.slice(0, 5) : '-';
      const label = slotInfo?.label || 'Sesi';
      lines.push(`☀️ **${label} Jam ${jam}*`);
      rows.forEach((row, idx) => {
        const patient = patientMap[row.patient_id];
        const therapist = therapistMap[row.therapist_id];
        const eselon = patient?.insurance_type_id ? insuranceMap[patient.insurance_type_id] || '' : '';
        const terapisNama = therapist?.name ? therapist.name.split(',')[0].trim() : '-';
        const terapisEmoji = therapist?.colorEmoji || '💙';

        // Nama pasien: ambil 2-3 kata pertama
        const namaAsli = patient?.name || '(?)';
        const namaParts = namaAsli.split(' ');
        const namaDisplay = namaParts.slice(0, 2).join(' ');

        lines.push(`${idx + 1}. ${namaDisplay} - ${eselon || 'Umum'} - ${terapisNama}`);
      });
      lines.push('');
    });

    lines.push(footerText);
    return lines.join('\n');
  }, [scheduleBySlot, patientMap, therapistMap, insuranceMap, date, headerText, catatanText, footerText]);

  const handleCopy = () => {
    navigator.clipboard.writeText(waText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const inputStyle = {
    padding: '8px 10px', borderRadius: 8, border: '1.5px solid #e2e8f0',
    fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box',
    fontFamily: 'inherit',
  };
  const textareaStyle = { ...inputStyle, minHeight: 70, resize: 'vertical' };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Template WA</h1>
          <p style={{ color: '#64748b', margin: '4px 0 0', fontSize: 13 }}>
            Generate pesan daftar hadir per sesi untuk dikirim ke grup WhatsApp.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={{ ...inputStyle, width: 160, flex: 'none' }}
          />
          <button
            onClick={() => setShowEdit(!showEdit)}
            style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', fontSize: 13, cursor: 'pointer', fontWeight: 600, color: '#475569' }}
          >
            {showEdit ? '▲ Tutup Edit' : '✏️ Edit Teks'}
          </button>
        </div>
      </div>

      {/* Edit header/catatan/footer */}
      {showEdit && (
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 20, marginBottom: 20, marginTop: 16 }}>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 4 }}>Header</label>
            <input value={headerText} onChange={(e) => setHeaderText(e.target.value)} style={inputStyle} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 4 }}>Catatan</label>
            <textarea value={catatanText} onChange={(e) => setCatatanText(e.target.value)} style={textareaStyle} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 4 }}>Footer</label>
            <input value={footerText} onChange={(e) => setFooterText(e.target.value)} style={inputStyle} />
          </div>
        </div>
      )}

      {loading ? (
        <p style={{ color: '#94a3b8' }}>Memuat jadwal...</p>
      ) : schedule.length === 0 ? (
        <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 10, padding: '14px 18px', color: '#9a3412', fontSize: 13, marginTop: 16 }}>
          ⚠️ Belum ada jadwal terkonfirmasi atau tergenerate untuk tanggal ini.
        </div>
      ) : (
        <div style={{ marginTop: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          {/* Preview */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#475569' }}>Preview Pesan</span>
              <button
                onClick={handleCopy}
                style={{
                  padding: '7px 16px', borderRadius: 8, border: 'none',
                  background: copied ? '#16a34a' : '#2563eb', color: '#fff',
                  fontWeight: 700, fontSize: 13, cursor: 'pointer', transition: 'background 0.2s',
                }}
              >
                {copied ? '✓ Tersalin!' : '📋 Salin Pesan'}
              </button>
            </div>
            <pre style={{
              background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12,
              padding: '16px 18px', fontSize: 12.5, lineHeight: 1.7, whiteSpace: 'pre-wrap',
              wordBreak: 'break-word', maxHeight: 600, overflowY: 'auto', margin: 0,
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            }}>
              {waText}
            </pre>
          </div>

          {/* Keterangan warna terapis */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 10 }}>Terapis Aktif</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
              {therapists.map((t) => (
                <div key={t.id} style={{ fontSize: 13, color: '#1e293b' }}>• {t.name}</div>
              ))}
            </div>

            <div style={{ marginTop: 24, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 16px' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 8 }}>REKAP HARI INI</div>
              <div style={{ fontSize: 13, color: '#1e293b' }}>
                <div>Total pasien: <strong>{schedule.length}</strong></div>
                <div>Total sesi: <strong>{scheduleBySlot.length}</strong></div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RotasiTemplateWA;
