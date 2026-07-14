import React, { useState, useEffect, useCallback } from 'react';
import { getAdminChecklistHistory } from '@/lib/api';
import { Loader2, CalendarDays, CheckCircle2, Circle, StickyNote, User, ListChecks } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { Input } from '@/components/ui/input';

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

const AdminChecklistHistory = () => {
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 6), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    const { data, error } = await getAdminChecklistHistory(startDate, endDate);
    if (!error) setHistory(data || []);
    setLoading(false);
  }, [startDate, endDate]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-[#0f1e3d]" />
            Riwayat & Catatan Checklist Admin
          </h3>
          <p className="text-sm text-slate-500 mt-0.5">
            Lihat hasil pengerjaan dan catatan yang diisi admin setiap hari.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={startDate}
            max={endDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-[150px]"
          />
          <span className="text-slate-400 text-sm">—</span>
          <Input
            type="date"
            value={endDate}
            min={startDate}
            max={format(new Date(), 'yyyy-MM-dd')}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-[150px]"
          />
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
        <div className="space-y-6">
          {history.map(({ date, entries }) => {
            const doneCount = entries.filter(e => e.is_done).length;
            return (
              <div key={date} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <p className="font-semibold text-slate-800 text-sm">{formatDateLabel(date)}</p>
                  <span className="text-xs font-medium text-slate-500">{doneCount}/{entries.length} selesai</span>
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
                          <p className={`font-medium text-sm ${entry.is_done ? 'text-slate-800' : 'text-slate-400'}`}>
                            {entry.item_title}
                          </p>
                          {entry.item_description && (
                            <p className="text-xs text-slate-400 mt-0.5">{entry.item_description}</p>
                          )}
                          {entry.is_done && (
                            <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-1">
                              <User className="w-3 h-3" />
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
