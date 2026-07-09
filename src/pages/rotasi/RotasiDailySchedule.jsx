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
  const [confirmed, setConfirmed] = useState(false);
  const [confirming, setConfirming] = useState(false);

  // State untuk modal riwayat terapis sebelumnya
  const [historyModal, setHistoryModal] = useState(null); // { patientId, patientName }
  const [historySelections, setHistorySelections] = useState(['', '', '']); // maks 3 sesi
  const [historySaving, setHistorySaving] = useState(false);

  // Modal cek/edit riwayat dari kartu jadwal
  const [historyViewModal, setHistoryViewModal] = useState(null); // { patientId, patientName }
  const [historyViewData, setHistoryViewData] = useState([]); // [{id, visit_date, therapist_id, therapist_name}]
  const [historyViewLoading, setHistoryViewLoading] = useState(false);
  const [historyViewEditing, setHistoryViewEditing] = useState({}); // { [rowId]: therapistId }
  const [historyViewSaving, setHistoryViewSaving] = useState(false);

  // State untuk modal cancel pasien (setelah jadwal dikonfirmasi)
  const [cancelModal, setCancelModal] = useState(null); // { patientId, patientName, scheduleId }
  const [cancelReplaceId, setCancelReplaceId] = useState('');
  const [cancelReplaceSearch, setCancelReplaceSearch] = useState('');
  const [cancelSaving, setCancelSaving] = useState(false);

  useEffect(() => {
    loadStatic();
  }, []);

  useEffect(() => {
    loadForDate(date);
  }, [date]);

  const loadStatic = async () => {
    // Ambil semua pasien dengan pagination karena bisa > 1000
    let allPts = [];
    let from = 0;
    const batchSize = 1000;
    while (true) {
      const { data: batch, error } = await supabase
        .from('rotasi_patients')
        .select('*')
        .order('name')
        .range(from, from + batchSize - 1);
      if (error || !batch || batch.length === 0) break;
      allPts = [...allPts, ...batch];
      if (batch.length < batchSize) break;
      from += batchSize;
    }

    const [{ data: ths }] = await Promise.all([
      supabase.from('rotasi_therapists').select('*').eq('is_active', true).order('created_at'),
    ]);
    setAllPatients(allPts);
    setTherapists(ths || []);
  };

  const loadForDate = async (d) => {
    setLoading(true);
    setMessage(null);
    const [{ data: list }, { data: sched }, { data: gslots }] = await Promise.all([
      supabase.from('rotasi_daily_list').select('patient_id, global_slot_id').eq('visit_date', d),
      supabase.from('rotasi_schedule').select('*').eq('visit_date', d).eq('cancelled', false),
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
    const isConfirmed = (sched || []).some((r) => r.confirmed === true);
    setConfirmed(isConfirmed);
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
      // Cek apakah pasien sudah punya riwayat; jika belum, tawarkan input riwayat awal
      const { data: existing } = await supabase
        .from('rotasi_schedule')
        .select('id')
        .eq('patient_id', patientId)
        .limit(1);
      const patient = allPatients.find((p) => p.id === patientId);
      // Ambil riwayat 3 sesi terakhir dari DB (ada atau tidak)
      const { data: recentHistory } = await supabase
        .from('rotasi_schedule')
        .select('id, therapist_id, visit_date')
        .eq('patient_id', patientId)
        .order('visit_date', { ascending: false })
        .limit(3);

      if (!existing || existing.length === 0) {
        // Pasien baru: tampilkan modal riwayat, pre-fill dari DB jika ada
        const prefilled = ['', '', ''];
        (recentHistory || []).forEach((r, i) => {
          if (i < 3) prefilled[i] = r.therapist_id || '';
        });
        setHistorySelections(prefilled);
        setHistoryModal({ patientId, patientName: patient?.name || '' });
      } else if (recentHistory && recentHistory.length > 0) {
        // Pasien sudah punya riwayat: tampilkan modal juga agar bisa diperiksa/update
        const prefilled = ['', '', ''];
        recentHistory.forEach((r, i) => {
          if (i < 3) prefilled[i] = r.therapist_id || '';
        });
        setHistorySelections(prefilled);
        setHistoryModal({ patientId, patientName: patient?.name || '', existingHistoryIds: recentHistory.map((r) => r.id) });
      }
    } else {
      window.alert('Gagal menambah pasien: ' + error.message);
    }
  };

  const handleAddPatient = async () => {
    if (!addPatientId) return;
    await insertPatientToSlot(addPatientId, selectedSlotId);
  };

  const openHistoryView = async (patientId, patientName) => {
    setHistoryViewModal({ patientId, patientName });
    setHistoryViewEditing({});
    setHistoryViewLoading(true);
    const { data } = await supabase
      .from('rotasi_schedule')
      .select('id, visit_date, therapist_id')
      .eq('patient_id', patientId)
      .lt('visit_date', date)
      .order('visit_date', { ascending: false })
      .limit(3);
    const therapistMap2 = {};
    therapists.forEach((t) => { therapistMap2[t.id] = t.name; });
    const mapped = (data || []).map((r) => ({ ...r, therapist_name: therapistMap2[r.therapist_id] || '-' }));
    setHistoryViewData(mapped);
    // Set editing dengan nilai existing dari DB sebagai initial value
    const initEditing = {};
    mapped.forEach((r) => { initEditing[r.id] = r.therapist_id || ''; });
    setHistoryViewEditing(initEditing);
    setHistoryViewLoading(false);
  };

  const handleSaveHistoryView = async () => {
    setHistoryViewSaving(true);
    const therapistMap2 = {};
    therapists.forEach((t) => { therapistMap2[t.id] = t.name; });

    const deletedIds = [];
    for (const [rowId, newTherapistId] of Object.entries(historyViewEditing)) {
      if (!newTherapistId) {
        // therapist_id NOT NULL — hapus row jika dikosongkan
        await supabase.from('rotasi_schedule').delete().eq('id', rowId);
        deletedIds.push(rowId);
      } else {
        await supabase
          .from('rotasi_schedule')
          .update({ therapist_id: newTherapistId })
          .eq('id', rowId);
      }
    }

    // Update state lokal
    setHistoryViewData((prev) =>
      prev
        .filter((r) => !deletedIds.includes(r.id))
        .map((r) => {
          if (r.id in historyViewEditing && historyViewEditing[r.id]) {
            const newId = historyViewEditing[r.id];
            return { ...r, therapist_id: newId, therapist_name: therapistMap2[newId] || '-' };
          }
          return r;
        })
    );

    // Sync editing state — hapus deleted rows
    setHistoryViewEditing((prev) => {
      const next = { ...prev };
      deletedIds.forEach((id) => delete next[id]);
      return next;
    });

    setHistoryViewSaving(false);
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

  const handleCancelPatient = async () => {
    if (!cancelModal) return;
    if (!window.confirm(`Batalkan kunjungan ${cancelModal.patientName} dari jadwal ini? Tindakan ini tidak bisa dibatalkan.`)) return;
    setCancelSaving(true);
    try {
      const cancelledSlotId = dailySlotMap[cancelModal.patientId] || null;

      // 1. Hapus row riwayat pasien A di tanggal ini (cancelled = true tidak cukup, riwayat harus bersih)
      await supabase
        .from('rotasi_schedule')
        .delete()
        .eq('id', cancelModal.scheduleId);

      // 2. Hapus dari rotasi_daily_list
      await supabase
        .from('rotasi_daily_list')
        .delete()
        .eq('visit_date', date)
        .eq('patient_id', cancelModal.patientId);

      // 3. Update state lokal
      setSchedule((prev) => prev.filter((s) => s.id !== cancelModal.scheduleId));
      setDailyListIds((prev) => prev.filter((id) => id !== cancelModal.patientId));
      setDailySlotMap((prev) => {
        const next = { ...prev };
        delete next[cancelModal.patientId];
        return next;
      });

      const closingModal = { ...cancelModal };
      const closingReplaceId = cancelReplaceId;
      setCancelModal(null);
      setCancelReplaceId('');
      setCancelReplaceSearch('');

      // 4. Kalau ada pasien pengganti, tambahkan ke list lalu cek riwayatnya
      if (closingReplaceId) {
        const { error: listErr } = await supabase
          .from('rotasi_daily_list')
          .upsert({ visit_date: date, patient_id: closingReplaceId, global_slot_id: cancelledSlotId }, { onConflict: 'visit_date,patient_id' });
        if (!listErr) {
          setDailyListIds((prev) => [...prev, closingReplaceId]);
          setDailySlotMap((prev) => ({ ...prev, [closingReplaceId]: cancelledSlotId }));

          // Cek apakah pasien pengganti punya riwayat
          const { data: recentHistory } = await supabase
            .from('rotasi_schedule')
            .select('id, therapist_id, visit_date')
            .eq('patient_id', closingReplaceId)
            .order('visit_date', { ascending: false })
            .limit(3);

          const patient = allPatients.find((p) => p.id === closingReplaceId);
          const prefilled = ['', '', ''];
          (recentHistory || []).forEach((r, i) => {
            if (i < 3) prefilled[i] = r.therapist_id || '';
          });

          if (!recentHistory || recentHistory.length === 0) {
            // Pasien belum punya riwayat sama sekali → tampilkan modal riwayat
            setHistorySelections(prefilled);
            setHistoryModal({
              patientId: closingReplaceId,
              patientName: patient?.name || '',
              existingHistoryIds: [],
              afterCancelSlotId: cancelledSlotId,
            });
            setMessage({ type: 'success', text: `${closingModal.patientName} dibatalkan. ${patient?.name} ditambahkan sebagai pengganti. Isi riwayat lalu generate ulang.` });
          } else {
            // Sudah ada riwayat → langsung tanpa modal
            setMessage({ type: 'success', text: `${closingModal.patientName} dibatalkan. ${patient?.name} ditambahkan sebagai pengganti. Silakan generate ulang jadwal.` });
          }
        }
      } else {
        setMessage({ type: 'success', text: `Kunjungan ${closingModal.patientName} berhasil dibatalkan.` });
      }
    } catch (err) {
      window.alert('Gagal membatalkan: ' + err.message);
    }
    setCancelSaving(false);
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

  const handleSaveHistory = async () => {
    if (!historyModal) return;
    setHistorySaving(true);
    const existingIds = historyModal.existingHistoryIds || [];
    const base = new Date(date);

    if (existingIds.length > 0) {
      // Update baris yang sudah ada
      for (let i = 0; i < existingIds.length; i++) {
        const newTherapistId = historySelections[i];
        if (!newTherapistId) {
          await supabase.from('rotasi_schedule').delete().eq('id', existingIds[i]);
        } else {
          await supabase.from('rotasi_schedule').update({ therapist_id: newTherapistId }).eq('id', existingIds[i]);
        }
      }
      // Kalau ada slot baru yang diisi (lebih dari existing), insert
      for (let i = existingIds.length; i < 3; i++) {
        if (historySelections[i]) {
          await supabase.from('rotasi_schedule').insert({
            visit_date: new Date(base.getTime() - (999 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            patient_id: historyModal.patientId,
            therapist_id: historySelections[i],
            slot_number: 0,
            constraint_violated: false,
          });
        }
      }
    } else {
      // Pasien benar-benar baru, insert semua yang diisi
      const filled = historySelections.map((id, i) => id ? {
        visit_date: new Date(base.getTime() - (999 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        patient_id: historyModal.patientId,
        therapist_id: id,
        slot_number: 0,
        constraint_violated: false,
      } : null).filter(Boolean);
      if (filled.length > 0) {
        const { error } = await supabase.from('rotasi_schedule').insert(filled);
        if (error) window.alert('Gagal menyimpan riwayat: ' + error.message);
      }
    }

    setHistoryModal(null);
    setHistorySelections(['', '', '']);
    setHistorySaving(false);
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

      // Ambil semua baris existing hari ini
      const { data: existingRows } = await supabase
        .from('rotasi_schedule')
        .select('id, patient_id, confirmed, cancelled')
        .eq('visit_date', date);

      // Patient ID yang sudah confirmed dan TIDAK cancelled = tidak boleh diubah sama sekali
      const lockedPatientIds = new Set(
        (existingRows || [])
          .filter((r) => r.confirmed && !r.cancelled)
          .map((r) => r.patient_id)
      );

      // Hanya upsert baris untuk pasien yang TIDAK locked
      const rowsToUpsert = rows.filter((r) => !lockedPatientIds.has(r.patient_id));

      // Hapus baris tidak confirmed + tidak cancelled yang tidak ada di list hari ini
      const patientIdsToday = rows.map((r) => r.patient_id);
      const toDelete = (existingRows || [])
        .filter((r) => !r.confirmed && !r.cancelled && !patientIdsToday.includes(r.patient_id))
        .map((r) => r.id);
      if (toDelete.length > 0) {
        await supabase.from('rotasi_schedule').delete().in('id', toDelete);
      }

      if (rowsToUpsert.length === 0) {
        const { data: allExisting } = await supabase
          .from('rotasi_schedule')
          .select('*')
          .eq('visit_date', date)
          .eq('cancelled', false);
        setSchedule(allExisting || []);
        return;
      }

      const { data: inserted, error: insErr } = await supabase
        .from('rotasi_schedule')
        .upsert(rowsToUpsert, { onConflict: 'visit_date,patient_id', ignoreDuplicates: false })
        .select();
      if (insErr) throw insErr;

      // Ambil ulang semua baris (exclude cancelled)
      const { data: allAfter } = await supabase
        .from('rotasi_schedule')
        .select('*')
        .eq('visit_date', date)
        .eq('cancelled', false);
      setSchedule(allAfter || []);

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

  const handleConfirm = async () => {
    if (!window.confirm(`Konfirmasi jadwal ${new Date(date + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}?\n\nSetelah dikonfirmasi, jadwal ini akan masuk ke Riwayat dan tidak bisa digenerate ulang.`)) return;
    setConfirming(true);
    const { error } = await supabase
      .from('rotasi_schedule')
      .update({ confirmed: true })
      .eq('visit_date', date);
    if (!error) {
      setConfirmed(true);
      setMessage({ type: 'success', text: 'Jadwal berhasil dikonfirmasi dan masuk ke Riwayat.' });
    } else {
      window.alert('Gagal konfirmasi: ' + error.message);
    }
    setConfirming(false);
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
                          {confirmed ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const sched = schedule.find((s) => s.patient_id === id);
                                setCancelModal({ patientId: id, patientName: patientMap[id]?.name || id, scheduleId: sched?.id });
                                setCancelReplaceId('');
                                setCancelReplaceSearch('');
                              }}
                              title="Batalkan kunjungan pasien ini"
                              style={{ border: 'none', background: 'none', color: '#dc2626', cursor: 'pointer', fontWeight: 700, marginLeft: 8, flexShrink: 0 }}
                            >
                              ✕
                            </button>
                          ) : (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleRemovePatient(id); }}
                              style={{ border: 'none', background: 'none', color: '#94a3b8', cursor: 'pointer', fontWeight: 700, marginLeft: 8, flexShrink: 0 }}
                            >
                              ×
                            </button>
                          )}
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
          {/* Banner konfirmasi */}
          {confirmed ? (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 18px', borderRadius: 10, marginBottom: 16,
              background: '#f0fdf4', border: '1px solid #bbf7d0',
            }}>
              <span style={{ fontSize: 20 }}>✅</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#15803d' }}>Jadwal sudah dikonfirmasi</div>
                <div style={{ fontSize: 12, color: '#16a34a' }}>Data ini sudah tercatat di Riwayat Jadwal.</div>
              </div>
            </div>
          ) : (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
              padding: '12px 18px', borderRadius: 10, marginBottom: 16,
              background: '#fffbeb', border: '1px solid #fde68a', flexWrap: 'wrap',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 20 }}>⏳</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#92400e' }}>Jadwal belum dikonfirmasi</div>
                  <div style={{ fontSize: 12, color: '#b45309' }}>Pastikan pembagian terapis sudah benar, lalu klik Konfirmasi untuk menyimpan ke Riwayat.</div>
                </div>
              </div>
              <button
                onClick={handleConfirm}
                disabled={confirming}
                style={{
                  padding: '9px 20px', borderRadius: 8, border: 'none',
                  background: '#2563eb', color: '#fff', fontWeight: 700,
                  fontSize: 13, cursor: 'pointer', flexShrink: 0,
                }}
              >
                {confirming ? 'Mengkonfirmasi...' : '✓ Konfirmasi Jadwal'}
              </button>
            </div>
          )}

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
                          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 4 }}>
                            <div
                              onClick={() => openHistoryView(row.patient_id, patientMap[row.patient_id]?.name || '-')}
                              style={{ fontSize: 14, fontWeight: 600, cursor: 'pointer', textDecoration: 'underline dotted', textUnderlineOffset: 3 }}
                              title="Klik untuk lihat riwayat 3 sesi terakhir"
                            >
                              {patientMap[row.patient_id]?.name || '-'}
                              {row.constraint_violated && <span style={{ marginLeft: 6 }}>⚠️</span>}
                            </div>
                            {confirmed && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCancelModal({ patientId: row.patient_id, patientName: patientMap[row.patient_id]?.name || '-', scheduleId: row.id });
                                  setCancelReplaceId('');
                                  setCancelReplaceSearch('');
                                }}
                                title="Batalkan kunjungan pasien ini"
                                style={{ border: 'none', background: 'none', color: '#dc2626', cursor: 'pointer', fontWeight: 700, fontSize: 14, padding: 0, flexShrink: 0, lineHeight: 1 }}
                              >
                                ✕
                              </button>
                            )}
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
    {/* ── Modal Cek/Edit Riwayat 3 Sesi Terakhir ── */}
      {historyViewModal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={(e) => { if (e.target === e.currentTarget) setHistoryViewModal(null); }}
        >
          <div style={{ background: '#fff', borderRadius: 14, padding: 28, width: '100%', maxWidth: 460, boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}>
            <h2 style={{ fontSize: 17, fontWeight: 800, margin: '0 0 4px' }}>Riwayat 3 Sesi Terakhir</h2>
            <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 20px' }}>
              <strong>{historyViewModal.patientName}</strong>
            </p>

            {historyViewLoading ? (
              <p style={{ color: '#94a3b8', fontSize: 13 }}>Memuat riwayat...</p>
            ) : historyViewData.length === 0 ? (
              <p style={{ color: '#94a3b8', fontSize: 13 }}>Belum ada riwayat sesi sebelumnya.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                {historyViewData.map((row, i) => (
                  <div key={row.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: 11, color: '#94a3b8', width: 80, flexShrink: 0 }}>
                      {i === 0 ? 'Sesi terakhir' : `Sesi ke-${i + 1}`}<br />
                      <span style={{ fontFamily: 'monospace', fontSize: 10 }}>{row.visit_date}</span>
                    </span>
                    <select
                      value={historyViewEditing[row.id] ?? ''}
                      onChange={(e) => setHistoryViewEditing((prev) => ({ ...prev, [row.id]: e.target.value }))}
                      style={{ flex: 1, padding: '7px 10px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, background: '#fff' }}
                    >
                      <option value="">-- Kosongkan --</option>
                      {therapists.map((t) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setHistoryViewModal(null)}
                style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#f8fafc', color: '#475569', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}
              >
                Tutup
              </button>
              <button
                onClick={handleSaveHistoryView}
                disabled={historyViewSaving}
                style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#2563eb', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}
              >
                {historyViewSaving ? 'Menyimpan...' : 'Simpan Perubahan'}
              </button>
            </div>
          </div>
        </div>
      )}

    {/* ── Modal Riwayat Terapis Sebelumnya ── */}
      {historyModal && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setHistoryModal(null); }}
        >
          <div style={{
            background: '#fff', borderRadius: 14, padding: 28, width: '100%', maxWidth: 440,
            boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
          }}>
            <h2 style={{ fontSize: 17, fontWeight: 800, margin: '0 0 6px' }}>Riwayat Terapis Sebelumnya</h2>
            <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 20px' }}>
              <strong>{historyModal.patientName}</strong> belum punya riwayat. Isi terapis yang pernah menangani sebelumnya (opsional, maks 3 sesi terakhir).
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
              {[0, 1, 2].map((i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 12, color: '#94a3b8', width: 60, flexShrink: 0 }}>
                    Sesi {i === 0 ? 'terakhir' : i === 1 ? 'ke-2' : 'ke-3'}
                  </span>
                  <select
                    value={historySelections[i]}
                    onChange={(e) => setHistorySelections((prev) => {
                      const next = [...prev];
                      next[i] = e.target.value;
                      return next;
                    })}
                    style={{
                      flex: 1, padding: '8px 10px', borderRadius: 8,
                      border: '1px solid #e2e8f0', fontSize: 13, background: '#fff',
                    }}
                  >
                    <option value="">-- Tidak diisi --</option>
                    {therapists.map((th) => (
                      <option key={th.id} value={th.id}>{th.name}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setHistoryModal(null)}
                style={{
                  padding: '8px 16px', borderRadius: 8, border: '1px solid #e2e8f0',
                  background: '#f8fafc', color: '#475569', cursor: 'pointer', fontWeight: 600, fontSize: 13,
                }}
              >
                Lewati
              </button>
              <button
                onClick={handleSaveHistory}
                disabled={historySaving}
                style={{
                  padding: '8px 18px', borderRadius: 8, border: 'none',
                  background: '#2563eb', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 13,
                }}
              >
                {historySaving ? 'Menyimpan...' : 'Simpan Riwayat'}
              </button>
            </div>
          </div>
        </div>
      )}
    {/* Modal Cancel Pasien */}
      {cancelModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 420, boxShadow: '0 8px 40px rgba(15,23,42,0.18)' }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', marginBottom: 6 }}>Batalkan Kunjungan</div>
            <p style={{ fontSize: 14, color: '#64748b', marginTop: 0, marginBottom: 20 }}>
              Pasien <strong>{cancelModal.patientName}</strong> akan dihapus dari jadwal hari ini.
            </p>

            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 8 }}>Pasien Pengganti (opsional)</div>
              <input
                value={cancelReplaceSearch}
                onChange={(e) => {
                  setCancelReplaceSearch(e.target.value);
                  setCancelReplaceId('');
                }}
                placeholder="Cari nama pasien pengganti..."
                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, boxSizing: 'border-box', outline: 'none' }}
              />
              {cancelReplaceSearch.trim() && (
                <div style={{ marginTop: 4, border: '1px solid #e2e8f0', borderRadius: 8, maxHeight: 160, overflowY: 'auto', background: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
                  {allPatients
                    .filter((p) =>
                      p.id !== cancelModal.patientId &&
                      !dailyListIds.includes(p.id) &&
                      p.name.toLowerCase().includes(cancelReplaceSearch.toLowerCase())
                    )
                    .slice(0, 8)
                    .map((p) => (
                      <div
                        key={p.id}
                        onClick={() => { setCancelReplaceId(p.id); setCancelReplaceSearch(p.name); }}
                        style={{
                          padding: '9px 14px', cursor: 'pointer', fontSize: 13,
                          background: cancelReplaceId === p.id ? '#eff6ff' : 'transparent',
                          color: '#0f172a',
                        }}
                      >
                        {p.name}
                      </div>
                    ))}
                  {allPatients.filter((p) =>
                    p.id !== cancelModal.patientId &&
                    !dailyListIds.includes(p.id) &&
                    p.name.toLowerCase().includes(cancelReplaceSearch.toLowerCase())
                  ).length === 0 && (
                    <div style={{ padding: '9px 14px', fontSize: 13, color: '#94a3b8' }}>Tidak ada pasien ditemukan</div>
                  )}
                </div>
              )}
              {cancelReplaceId && (
                <div style={{ marginTop: 6, fontSize: 12, color: '#16a34a', fontWeight: 600 }}>
                  ✓ {patientMap[cancelReplaceId]?.name} dipilih sebagai pengganti
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setCancelModal(null); setCancelReplaceId(''); setCancelReplaceSearch(''); }}
                disabled={cancelSaving}
                style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#f8fafc', color: '#64748b', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
              >
                Tutup
              </button>
              <button
                onClick={handleCancelPatient}
                disabled={cancelSaving}
                style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: '#dc2626', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
              >
                {cancelSaving ? 'Memproses...' : 'Batalkan Kunjungan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RotasiDailySchedule;