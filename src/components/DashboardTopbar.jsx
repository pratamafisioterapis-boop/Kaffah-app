import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Bell, X, User as UserIcon,
  Calendar as CalendarIcon, LayoutGrid, Activity as ActivityIcon
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

const DashboardTopbar = ({ role, userName, clinicName, navItems = [], clinicId }) => {
  const navigate = useNavigate();
  const searchRef = useRef(null);
  const bellRef = useRef(null);
  const inputRef = useRef(null);

  const [query, setQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState({ patients: [], appointments: [], menu: [] });

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
      setResults({ patients: [], appointments: [], menu: [] });
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const handle = setTimeout(async () => {
      try {
        const menuMatches = menuItems
          .filter((m) => m.label.toLowerCase().includes(q.toLowerCase()))
          .slice(0, 5);

        let patientQuery = supabase
          .from('patients')
          .select('id, full_name, medical_record_number')
          .ilike('full_name', `%${q}%`)
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
        const { data: apptRows } = await apptQuery;

        setResults({ patients: patientRows || [], appointments: apptRows || [], menu: menuMatches });
      } catch (err) {
        console.error('Search error:', err);
        setResults({ patients: [], appointments: [], menu: [] });
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
  const hasResults = results.patients.length || results.appointments.length || results.menu.length;

  return (
    <div className="sticky top-0 z-20 mb-4 -mx-4 sm:mx-0 px-4 sm:px-0 pt-2 sm:pt-0 bg-[#F5F9FC]/95 backdrop-blur-sm">
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="relative flex-1 min-w-0 max-w-md" ref={searchRef}>
          <div
            className={cn(
              'flex items-center gap-2 bg-white border rounded-xl px-3 h-10 transition-colors shadow-sm',
              isSearchOpen ? 'border-[#1677D2]' : 'border-[#DCE8F2]'
            )}
          >
            <Search className="w-4 h-4 text-[#5B6B7D] flex-shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => { setQuery(e.target.value); setIsSearchOpen(true); }}
              onFocus={() => setIsSearchOpen(true)}
              placeholder="Cari pasien, appointment, atau menu lainnya..."
              className="flex-1 min-w-0 bg-transparent outline-none text-sm text-[#102F52] placeholder:text-[#5B6B7D]"
            />
            {query ? (
              <button
                onClick={() => { setQuery(''); inputRef.current?.focus(); }}
                className="text-[#5B6B7D] hover:text-[#102F52] flex-shrink-0"
                aria-label="Hapus pencarian"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : (
              <kbd className="hidden sm:inline-flex items-center gap-0.5 text-[10px] font-semibold text-[#5B6B7D] bg-[#F5F9FC] border border-[#DCE8F2] rounded px-1.5 py-0.5 flex-shrink-0">
                ⌘K
              </kbd>
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
            className="relative w-10 h-10 rounded-xl border border-[#DCE8F2] bg-white flex items-center justify-center text-[#102F52] hover:text-[#1677D2] hover:bg-[#F5F9FC] transition-colors shadow-sm"
            aria-label="Aktivitas"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#F16063] border border-white" />
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
