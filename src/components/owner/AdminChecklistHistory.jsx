import React, { useState, useEffect, useCallback } from 'react';
import { getAdminChecklistHistory, getAdmins } from '@/lib/api';
import { Loader2, CalendarDays, CheckCircle2, Circle, StickyNote, ListChecks, Users, TrendingUp } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const formatDateLabel = (dateStr) => {
  try {
    return format(new Date(dateStr + 'T00:00:00'), "EEEE, d MMMM yyyy", { locale: idLocale });
  } catch {
    return dateStr;
  }
};

const formatTime = (isoStr) => {
  if (!isoStr) return '-';
  try {
    return format(new Date(isoStr), 'HH:mm');
  } catch {
    return '-';
  }
};

const initials = (name) => (name || 'A').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();

const AdminChecklistHistory = () => {
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 6), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [admins, setAdmins] = useState([]);
  const [scope, setScope] = useState(null); // null = semua admin
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAdmins().then(({ data }) => setAdmins(data || []));
  }, []);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    const { data, error } = await getAdminChecklistHistory(startDate, endDate, scope);
    if (!error) setHistory(data || []);
    setLoading(false);
  }, [startDate, endDate, scope]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const allEntries = history.flatMap(h => h.entries);
  const totalDone = allEntries.filter(e => e.is_done).length;
  const totalTasks = allEntries.length;
  const overallPercent = totalTasks > 0 ? Math.round((totalDone / totalTasks) * 100) : 0;

  return (
    <div className="space-y-5">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-[24px] bg-gradient-to-br from-[#0f1e3d] via-[#132348] to-[#0f1e3d] border border-white/5 shadow-[0_25px_60px_-25px_rgba(15,30,61,0.5)]">
        <div className="absolute -top-16 -right-16 w-48 h-48 bg-[#b8935f]/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-[#1e3a8a]/20 rounded-full blur-3xl" />
        <div className="relative z-10 p-5 sm:p-7">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#b8935f] to-[#d4b378] flex items-center justify-center shadow-lg shadow-[#b8935f]/20 shrink-0">
                <CalendarDays className="w-5 h-5 text-[#0f1e3d]" />
              </div>
              <div>
                <h3 className="text-white font-bold text-base sm:text-lg tracking-tight">Riwayat & Catatan Checklist Admin</h3>
                <p className="text-slate-400 text-xs sm:text-sm">Hasil pengerjaan dan catatan yang diisi admin setiap hari</p>
              </div>
            </div>

            {totalTasks > 0 && (
              <div className="flex items-center gap-4 shrink-0">
                <div className="flex flex-col items-end">
                  <span className="text-2xl font-black text-white leading-none">{overallPercent}%</span>
                  <span className="text-[11px] text-slate-400 font-medium mt-0.5 flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" /> {totalDone}/{totalTasks} selesai
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3 mt-6">
            <Input
              type="date"
              value={startDate}
              max={endDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full sm:w-[160px] bg-white/[0.06] border-white/10 text-white [color-scheme:dark]"
            />
            <span className="text-slate-500 text-sm hidden sm:block">—</span>
            <Input
              type="date"
              value={endDate}
              min={startDate}
              max={format(new Date(), 'yyyy-MM-dd')}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full sm:w-[160px] bg-white/[0.06] border-white/10 text-white [color-scheme:dark]"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto mt-3 pb-0.5">
            <button
              type="button"
              onClick={() => setScope(null)}
              className={cn(
                "shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-medium border transition-colors",
                scope === null
                  ? "bg-gradient-to-br from-[#b8935f] to-[#d4b378] text-[#0f1e3d] border-transparent"
                  : "bg-white/[0.06] text-slate-300 border-white/10 hover:bg-white/[0.09]"
              )}
            >
              <Users className="w-3.5 h-3.5" /> Semua Admin
            </button>
            {admins.map((admin) => (
              <button
                key={admin.id}
                type="button"
                onClick={() => setScope(admin.id)}
                className={cn(
                  "shrink-0 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-medium border transition-colors",
                  scope === admin.id
                    ? "bg-gradient-to-br from-[#b8935f] to-[#d4b378] text-[#0f1e3d] border-transparent"
                    : "bg-white/[0.06] text-slate-300 border-white/10 hover:bg-white/[0.09]"
                )}
              >
                {admin.full_name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-7 h-7 animate-spin text-slate-300" />
        </div>
      ) : history.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-slate-200 text-center">
          <ListChecks className="w-10 h-10 text-slate-300 mb-3" />
          <p className="text-slate-500 font-medium">Belum ada riwayat pada rentang tanggal ini</p>
        </div>
      ) : (
        <div className="space-y-5">
          {history.map(({ date, entries }) => {
            const doneCount = entries.filter(e => e.is_done).length;
            const datePercent = entries.length > 0 ? Math.round((doneCount / entries.length) * 100) : 0;
            return (
              <div key={date} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-5 py-3.5 bg-gradient-to-r from-[#0f1e3d] to-[#132348] flex items-center justify-between">
                  <p className="font-semibold text-white text-sm capitalize">{formatDateLabel(date)}</p>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-16 bg-white/15 rounded-full overflow-hidden hidden sm:block">
                      <div
                        className={cn("h-full rounded-full", datePercent === 100 ? "bg-emerald-400" : "bg-gradient-to-r from-[#b8935f] to-[#d4b378]")}
                        style={{ width: `${datePercent}%` }}
                      />
                    </div>
                    <span className="text-xs font-semibold text-slate-300">{doneCount}/{entries.length}</span>
                  </div>
                </div>
                <div className="divide-y divide-slate-100">
                  {entries.map((entry) => (
                    <div key={entry.id} className="p-4 flex flex-col gap-2">
                      <div className="flex items-start gap-3">
                        {entry.is_done ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                        ) : (
                          <Circle className="w-5 h-5 text-slate-300 shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center flex-wrap gap-x-2 gap-y-1">
                            <p className={`font-medium text-sm ${entry.is_done ? 'text-slate-800' : 'text-slate-400'}`}>
                              {entry.item_title}
                            </p>
                            {scope === null && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-[#0f1e3d]/5 text-[#0f1e3d] border border-[#0f1e3d]/10">
                                {entry.assigned_admin_name ? initials(entry.assigned_admin_name) : 'UMUM'}
                              </span>
                            )}
                          </div>
                          {entry.item_description && (
                            <p className="text-xs text-slate-400 mt-0.5">{entry.item_description}</p>
                          )}
                          {entry.is_done && (
                            <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-1">
                              <div className="w-4 h-4 rounded-full bg-[#0f1e3d] text-white flex items-center justify-center text-[8px] font-bold shrink-0">
                                {initials(entry.completed_by_name)}
                              </div>
                              <span>{entry.completed_by_name || 'Admin'}</span>
                              <span>·</span>
                              <span>{formatTime(entry.completed_at)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      {entry.note && (
                        <div className="ml-8 flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                          <StickyNote className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                          <p className="text-sm text-amber-800 whitespace-pre-wrap">{entry.note}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AdminChecklistHistory;
