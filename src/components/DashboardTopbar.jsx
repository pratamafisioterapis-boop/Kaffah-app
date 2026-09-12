import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Bell, X, User as UserIcon,
  Calendar as CalendarIcon, LayoutGrid, Activity as ActivityIcon,
  Package as PackageIcon, FileText as FileTextIcon, Award
} from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { cn } from '@/lib/utils';

const ACTIVITY_LIMIT = 20;

function timeAgo(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '-';
  const diffMin = Math.floor((Date.now() - d.getTime()) / 60000);
  if (diffMin < 1) return 'Baru saja';
  if (diffMin < 60) return `${diffMin} menit lalu`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} jam lalu`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay} hari lalu`;
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

function formatApptDate(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '-';
  return `${d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })} • ${d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`;
}

function formatShortDate(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

function flattenNavItems(items) {
  const out = [];
  (items || []).forEach((item) => {
    if (item.path) out.push({ label: item.label, path: item.path });
    (item.submenu || []).forEach((sub) => {
      if (sub.path) out.push({ label: `${item.label} · ${sub.label}`, path: sub.path });
    });
  });
  return out;
}

// `changes` on appointment audit rows is either the raw row (INSERT/DELETE)
// or { old, new } (UPDATE) — action_by_name/action_by_role live inside it.
function mapAppointmentLog(row) {
  const c = row.changes || {};
  const data = row.action === 'UPDATE' ? (c.new || c) : c;
  const old = row.action === 'UPDATE' ? (c.old || null) : null;
  const who = data.guest_name || 'pasien';
  const actorRole = (data.action_by_role || '').toLowerCase() === 'therapist' ? 'therapist' : 'admin';

  let text;
  if (row.action === 'INSERT') {
    text = `menambahkan appointment baru untuk ${who}`;
  } else if (row.action === 'DELETE') {
    text = `menghapus appointment ${who}`;
  } else if (old && old.status !== data.status && data.status === 'cancelled') {
    text = `membatalkan appointment ${who}`;
  } else {
    text = `memperbarui appointment ${who}`;
  }

  return {
    id: row.id,
    time: row.created_at,
    isRead: !!row.is_read,
    actorName: data.action_by_name || 'Seseorang',
    actorRole,
    text,
  };
}

function mapRecapLog(row) {
  const data = (row.changes || {}).new || {};
  return {
    id: row.id,
    time: row.created_at,
    isRead: !!row.is_read,
    actorName: data.therapist_name || 'Terapis',
    actorRole: 'therapist',
    text: `menyelesaikan sesi terapi untuk ${data.full_name || data.guest_name || 'pasien'}`,
  };
}

// Ringkasan pasien: total sesi selesai, terapis paling sering menangani,
// tanggal sesi terakhir, dan paket yang sedang aktif (kalau ada).
async function loadPatientSummary(patientId) {
  try {
    const [{ count: totalSessions }, { data: completedRecaps }, { data: activePackage }] = await Promise.all([
      supabase
        .from('daily_recaps')
        .select('id', { count: 'exact', head: true })
        .eq('patient_id', patientId)
        .eq('status', 'completed'),
      supabase
        .from('daily_recaps')
        .select('recap_date, therapist:physiotherapists!therapist_id(name)')
        .eq('patient_id', patientId)
        .eq('status', 'completed')
        .order('recap_date', { ascending: false })
        .limit(50),
      supabase
        .from('package_tracking')
        .select('package_name, sessions_used, total_sessions, status')
        .eq('patient_id', patientId)
        .in('status', ['aktif', 'diperpanjang', 'active'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const recaps = completedRecaps || [];
    const therapistCounts = {};
    recaps.forEach((r) => {
      const name = r.therapist?.name;
      if (!name) return;
      therapistCounts[name] = (therapistCounts[name] || 0) + 1;
    });
    const favoriteTherapist = Object.entries(therapistCounts).sort((a, b) => b[1] - a[1])[0] || null;

    return {
      totalSessions: totalSessions || 0,
      lastSessionDate: recaps[0]?.recap_date || null,
      favoriteTherapistName: favoriteTherapist?.[0] || null,
      favoriteTherapistCount: favoriteTherapist?.[1] || 0,
      activePackage: activePackage || null,
    };
  } catch (err) {
    console.error('Failed to load patient summary:', err);
    return null;
  }
}

const DashboardTopbar = ({ role, userName, clinicName, navItems = [], clinicId }) => {
  const navigate = useNavigate();
  const searchRef = useRef(null);
  const bellRef = useRef(null);
  const inputRef = useRef(null);

  const [query, setQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState({ patients: [], appointments: [], packages: [], medicalRecords: [], menu: [], summary: null });

  const [activities, setActivities] = useState([]);
  const [isLoadingActivities, setIsLoadingActivities] = useState(true);
  const [isActivityOpen, setIsActivityOpen] = useState(false);
  const [activityFilter, setActivityFilter] = useState('all');

  const menuItems = useMemo(() => flattenNavItems(navItems), [navItems]);

  // ⌘K / Ctrl+K to open search, Esc to close popovers
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen(true);
        setTimeout(() => inputRef.current?.focus(), 0);
      }
      if (e.key === 'Escape') {
        setIsSearchOpen(false);
        setIsActivityOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) setIsSearchOpen(false);
      if (bellRef.current && !bellRef.current.contains(e.target)) setIsActivityOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults({ patients: [], appointments: [], packages: [], medicalRecords: [], menu: [], summary: null });
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const handle = setTimeout(async () => {
      try {
        const menuMatches = menuItems
          .filter((m) => m.label.toLowerCase().includes(q.toLowerCase()))
          .slice(0, 5);

        // Match by name, no. RM, or no. HP so a receptionist can search however
        // the patient gives their info.
        let patientQuery = supabase
          .from('patients')
          .select('id, full_name, medical_record_number, phone')
          .or(`full_name.ilike.%${q}%,medical_record_number.ilike.%${q}%,phone.ilike.%${q}%`)
          .limit(5);
        if (clinicId) patientQuery = patientQuery.eq('clinic_id', clinicId);
        const { data: patientRows } = await patientQuery;

        const patientIds = (patientRows || []).map((p) => p.id);

        let apptQuery = supabase
          .from('appointments')
          .select('id, appointment_date, status, guest_name, patient_id, patients(full_name)')
          .order('appointment_date', { ascending: false })
          .limit(5);
        if (clinicId) apptQuery = apptQuery.eq('clinic_id', clinicId);
        apptQuery = patientIds.length
          ? apptQuery.or(`patient_id.in.(${patientIds.join(',')}),guest_name.ilike.%${q}%`)
          : apptQuery.ilike('guest_name', `%${q}%`);

        let packagePromise = Promise.resolve({ data: [] });
        let medicalRecordPromise = Promise.resolve({ data: [] });
        if (patientIds.length) {
          packagePromise = supabase
            .from('package_tracking')
            .select('id, package_name, sessions_used, total_sessions, status, patient_id, patients(full_name)')
            .in('patient_id', patientIds)
            .order('created_at', { ascending: false })
            .limit(5);

          medicalRecordPromise = supabase
            .from('medical_records')
            .select('id, patient_id, created_at, created_by, assessment, patients(full_name), daily_recap:daily_recaps(recap_date)')
            .in('patient_id', patientIds)
            .order('created_at', { ascending: false })
            .limit(5);
        }

        const [{ data: apptRows }, { data: packageRows }, { data: mrRows }] = await Promise.all([
          apptQuery,
          packagePromise,
          medicalRecordPromise,
        ]);

        let medicalRecords = mrRows || [];
        const therapistIds = [...new Set(medicalRecords.map((r) => r.created_by).filter(Boolean))];
        if (therapistIds.length) {
          const { data: therapists } = await supabase
            .from('physiotherapists')
            .select('user_id, name')
            .in('user_id', therapistIds);
          const nameByUserId = Object.fromEntries((therapists || []).map((t) => [t.user_id, t.name]));
          medicalRecords = medicalRecords.map((r) => ({ ...r, therapist_name: nameByUserId[r.created_by] || null }));
        }

        // Only worth the extra round-trip when the search clearly points at one
        // patient (e.g. by no. RM/HP) — not on every keystroke of a name search.
        let summary = null;
        if (patientIds.length === 1) {
          summary = await loadPatientSummary(patientIds[0]);
        }

        setResults({
          patients: patientRows || [],
          appointments: apptRows || [],
          packages: packageRows || [],
          medicalRecords,
          menu: menuMatches,
          summary,
        });
      } catch (err) {
        console.error('Search error:', err);
        setResults({ patients: [], appointments: [], packages: [], medicalRecords: [], menu: [], summary: null });
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(handle);
  }, [query, menuItems, clinicId]);

  const loadActivities = useCallback(async () => {
    setIsLoadingActivities(true);
    try {
      let apptLogQuery = supabase
        .from('audit_logs')
        .select('id, action, resource_type, changes, created_at, is_read')
        .eq('resource_type', 'appointments')
        .order('created_at', { ascending: false })
        .limit(ACTIVITY_LIMIT);
      let recapLogQuery = supabase
        .from('audit_logs')
        .select('id, action, resource_type, changes, created_at, is_read')
        .eq('resource_type', 'daily_recaps')
        .eq('action', 'UPDATE')
        .eq('changes->new->>status', 'completed')
        .neq('changes->old->>status', 'completed')
        .order('created_at', { ascending: false })
        .limit(ACTIVITY_LIMIT);
      if (clinicId) {
        apptLogQuery = apptLogQuery.eq('clinic_id', clinicId);
        recapLogQuery = recapLogQuery.eq('clinic_id', clinicId);
      }

      const [{ data: apptLogs }, { data: recapLogs }] = await Promise.all([apptLogQuery, recapLogQuery]);

      const mapped = [...(apptLogs || []).map(mapAppointmentLog), ...(recapLogs || []).map(mapRecapLog)]
        .sort((a, b) => new Date(b.time) - new Date(a.time))
        .slice(0, ACTIVITY_LIMIT);

      setActivities(mapped);
    } catch (err) {
      console.error('Failed to load activity center:', err);
    } finally {
      setIsLoadingActivities(false);
    }
  }, [clinicId]);

  useEffect(() => { loadActivities(); }, [loadActivities]);

  useEffect(() => {
    const channel = supabase
      .channel('topbar-audit-logs')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'audit_logs' }, () => {
        loadActivities();
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [loadActivities]);

  const unreadCount = activities.filter((a) => !a.isRead).length;
  const filteredActivities = activityFilter === 'all'
    ? activities
    : activities.filter((a) => a.actorRole === activityFilter);

  const markAsRead = async (id) => {
    setActivities((prev) => prev.map((a) => (a.id === id ? { ...a, isRead: true } : a)));
    await supabase.rpc('mark_audit_log_read', { p_id: id });
  };

  const goTo = (path) => {
    navigate(path);
    setIsSearchOpen(false);
    setQuery('');
  };

  const hasQuery = query.trim().length >= 2;
  const hasResults = results.patients.length || results.appointments.length
    || results.packages.length || results.medicalRecords.length || results.menu.length;

  return (
    <div className="relative sticky top-0 z-20 mb-4 -mx-4 sm:mx-0 px-4 sm:px-0 pt-2.5 sm:pt-0 pb-2 sm:pb-0 overflow-hidden sm:overflow-visible bg-gradient-to-b from-[#EAF4FF]/80 via-[#F5F9FC]/95 to-[#F5F9FC]/95 sm:bg-none sm:bg-[#F5F9FC]/95 backdrop-blur-sm rounded-b-[20px] sm:rounded-none">
      <div className="absolute -top-12 -right-8 w-28 h-28 rounded-full bg-[#1677D2]/10 blur-2xl pointer-events-none sm:hidden" aria-hidden="true" />
      <div className="absolute -top-6 right-16 w-14 h-14 rounded-full bg-[#2F8CFF]/10 blur-xl pointer-events-none sm:hidden" aria-hidden="true" />
      <div className="relative flex items-center gap-2 sm:gap-3">
        <div className="relative flex-1 min-w-0 max-w-md" ref={searchRef}>
          <div
            className={cn(
              'flex items-center gap-1.5 bg-white border rounded-full sm:rounded-xl px-2.5 h-9 transition-colors shadow-sm',
              isSearchOpen ? 'border-[#1677D2]' : 'border-[#DCE8F2]'
            )}
          >
            <Search className="w-3.5 h-3.5 text-[#5B6B7D] flex-shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => { setQuery(e.target.value); setIsSearchOpen(true); }}
              onFocus={() => setIsSearchOpen(true)}
              placeholder="Cari pasien, appointment..."
              className="flex-1 min-w-0 bg-transparent outline-none text-[13px] sm:text-sm text-[#102F52] placeholder:text-[#5B6B7D] placeholder:truncate"
            />
            {query && (
              <button
                onClick={() => { setQuery(''); inputRef.current?.focus(); }}
                className="text-[#5B6B7D] hover:text-[#102F52] flex-shrink-0"
                aria-label="Hapus pencarian"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {isSearchOpen && hasQuery && (
            <div className="absolute left-0 right-0 mt-2 bg-white border border-[#DCE8F2] rounded-xl shadow-lg max-h-[70vh] overflow-y-auto z-30">
              {isSearching ? (
                <div className="p-4 text-sm text-[#5B6B7D]">Mencari...</div>
              ) : !hasResults ? (
                <div className="p-4 text-sm text-[#5B6B7D]">Tidak ada hasil untuk &ldquo;{query}&rdquo;</div>
              ) : (
                <div className="py-2">
                  {results.summary && (
                    <div className="mx-2 mb-2 p-3 rounded-lg bg-[#EAF4FF] border border-[#DCE8F2]">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-[#1677D2] mb-1.5">Ringkasan Pasien</div>
                      <div className="grid grid-cols-2 gap-y-1.5 gap-x-3 text-xs text-[#102F52]">
                        <span className="text-[#5B6B7D]">Total sesi selesai</span>
                        <span className="font-medium text-right">{results.summary.totalSessions}x</span>
                        <span className="text-[#5B6B7D]">Terapis favorit</span>
                        <span className="font-medium text-right truncate flex items-center justify-end gap-1">
                          {results.summary.favoriteTherapistName ? (
                            <>
                              <Award className="w-3 h-3 text-[#1677D2] flex-shrink-0" />
                              {results.summary.favoriteTherapistName} ({results.summary.favoriteTherapistCount}x)
                            </>
                          ) : '-'}
                        </span>
                        <span className="text-[#5B6B7D]">Sesi terakhir</span>
                        <span className="font-medium text-right">{results.summary.lastSessionDate ? formatShortDate(results.summary.lastSessionDate) : '-'}</span>
                        <span className="text-[#5B6B7D]">Paket aktif</span>
                        <span className="font-medium text-right truncate">
                          {results.summary.activePackage
                            ? `${results.summary.activePackage.package_name} (${results.summary.activePackage.sessions_used}/${results.summary.activePackage.total_sessions})`
                            : '-'}
                        </span>
                      </div>
                    </div>
                  )}

                  {results.patients.length > 0 && (
                    <div className="px-2">
                      <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[#5B6B7D]">Pasien</div>
                      {results.patients.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => goTo(`/${role}/database-patients`)}
                          className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-[#F5F9FC] text-left"
                        >
                          <span className="w-8 h-8 rounded-full bg-[#EAF4FF] flex items-center justify-center text-[#1677D2] flex-shrink-0">
                            <UserIcon className="w-4 h-4" />
                          </span>
                          <span className="min-w-0">
                            <span className="block text-sm font-medium text-[#102F52] truncate">{p.full_name}</span>
                            <span className="block text-xs text-[#5B6B7D] truncate">{p.medical_record_number || 'Pasien'}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  {results.appointments.length > 0 && (
                    <div className="px-2 mt-1">
                      <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[#5B6B7D]">Appointment</div>
                      {results.appointments.map((a) => (
                        <button
                          key={a.id}
                          onClick={() => goTo(`/${role}/appointments`)}
                          className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-[#F5F9FC] text-left"
                        >
                          <span className="w-8 h-8 rounded-full bg-[#EAF4FF] flex items-center justify-center text-[#1677D2] flex-shrink-0">
                            <CalendarIcon className="w-4 h-4" />
                          </span>
                          <span className="min-w-0">
                            <span className="block text-sm font-medium text-[#102F52] truncate">{a.patients?.full_name || a.guest_name || 'Tamu'}</span>
                            <span className="block text-xs text-[#5B6B7D] truncate">{formatApptDate(a.appointment_date)}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  {results.packages.length > 0 && (
                    <div className="px-2 mt-1">
                      <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[#5B6B7D]">Rekap Paket</div>
                      {results.packages.map((pkg) => (
                        <button
                          key={pkg.id}
                          onClick={() => goTo(`/${role}/package-recaps`)}
                          className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-[#F5F9FC] text-left"
                        >
                          <span className="w-8 h-8 rounded-full bg-[#EAF4FF] flex items-center justify-center text-[#1677D2] flex-shrink-0">
                            <PackageIcon className="w-4 h-4" />
                          </span>
                          <span className="min-w-0">
                            <span className="block text-sm font-medium text-[#102F52] truncate">{pkg.package_name} · {pkg.patients?.full_name}</span>
                            <span className="block text-xs text-[#5B6B7D] truncate">
                              {pkg.sessions_used}/{pkg.total_sessions} sesi · {pkg.status || '-'}
                            </span>
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  {results.medicalRecords.length > 0 && (
                    <div className="px-2 mt-1">
                      <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[#5B6B7D]">Medical Record</div>
                      {results.medicalRecords.map((mr) => (
                        <button
                          key={mr.id}
                          onClick={() => goTo(`/${role}/medical-records`)}
                          className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-[#F5F9FC] text-left"
                        >
                          <span className="w-8 h-8 rounded-full bg-[#EAF4FF] flex items-center justify-center text-[#1677D2] flex-shrink-0">
                            <FileTextIcon className="w-4 h-4" />
                          </span>
                          <span className="min-w-0">
                            <span className="block text-sm font-medium text-[#102F52] truncate">{mr.patients?.full_name || 'Pasien'}</span>
                            <span className="block text-xs text-[#5B6B7D] truncate">
                              {formatShortDate(mr.daily_recap?.recap_date || mr.created_at)}
                              {mr.therapist_name ? ` · ${mr.therapist_name}` : ''}
                            </span>
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  {results.menu.length > 0 && (
                    <div className="px-2 mt-1">
                      <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[#5B6B7D]">Menu</div>
                      {results.menu.map((m, i) => (
                        <button
                          key={`${m.path}-${i}`}
                          onClick={() => goTo(m.path)}
                          className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-[#F5F9FC] text-left"
                        >
                          <span className="w-8 h-8 rounded-full bg-[#EAF4FF] flex items-center justify-center text-[#1677D2] flex-shrink-0">
                            <LayoutGrid className="w-4 h-4" />
                          </span>
                          <span className="text-sm font-medium text-[#102F52]">{m.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="relative flex-shrink-0" ref={bellRef}>
          <button
            onClick={() => setIsActivityOpen((o) => !o)}
            className="relative w-9 h-9 rounded-full sm:rounded-xl border border-[#DCE8F2] bg-white flex items-center justify-center text-[#102F52] hover:text-[#1677D2] hover:bg-[#F5F9FC] transition-colors shadow-sm"
            aria-label="Aktivitas"
          >
            <Bell className="w-3.5 h-3.5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#F16063] border border-white" />
            )}
          </button>

          {isActivityOpen && (
            <div className="absolute right-0 mt-2 w-[340px] max-w-[85vw] bg-white border border-[#DCE8F2] rounded-xl shadow-lg z-30 overflow-hidden">
              <div className="px-4 pt-3 pb-2 border-b border-[#DCE8F2]">
                <p className="text-sm font-bold text-[#102F52]">Aktivitas</p>
                <p className="text-xs text-[#5B6B7D]">Aktivitas terbaru klinik</p>
                <div className="flex items-center gap-1.5 mt-2">
                  {[['all', 'Semua'], ['admin', 'Admin'], ['therapist', 'Terapis']].map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setActivityFilter(key)}
                      className={cn(
                        'px-2.5 py-1 rounded-full text-xs font-medium transition-colors',
                        activityFilter === key ? 'bg-[#EAF4FF] text-[#1677D2]' : 'text-[#5B6B7D] hover:bg-[#F5F9FC]'
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="max-h-80 overflow-y-auto">
                {isLoadingActivities ? (
                  <div className="p-4 text-sm text-[#5B6B7D]">Memuat aktivitas...</div>
                ) : filteredActivities.length === 0 ? (
                  <div className="p-4 text-sm text-[#5B6B7D]">Belum ada aktivitas.</div>
                ) : (
                  filteredActivities.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => markAsRead(item.id)}
                      className={cn(
                        'w-full flex items-start gap-3 px-4 py-3 text-left border-b border-[#F5F9FC] last:border-0 hover:bg-[#F5F9FC] transition-colors',
                        !item.isRead && 'bg-[#EAF4FF]/40'
                      )}
                    >
                      <span
                        className={cn(
                          'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
                          item.actorRole === 'therapist' ? 'bg-[#E6FBF9] text-[#35C8C1]' : 'bg-[#EAF4FF] text-[#1677D2]'
                        )}
                      >
                        {item.actorRole === 'therapist' ? <ActivityIcon className="w-4 h-4" /> : <UserIcon className="w-4 h-4" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm text-[#102F52]">
                          <span className="font-semibold">{item.actorName}</span> {item.text}
                        </span>
                        <span className="block text-xs text-[#5B6B7D] mt-0.5">{timeAgo(item.time)}</span>
                      </span>
                      {!item.isRead && <span className="w-2 h-2 rounded-full bg-[#1677D2] mt-1.5 flex-shrink-0" />}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default DashboardTopbar;
