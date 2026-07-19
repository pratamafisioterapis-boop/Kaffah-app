import React, { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { getDailyRecaps } from '@/lib/api';
import { getTherapistPeriodRange, formatTherapistPeriodLabel, cn } from '@/lib/utils';
import { displayDateID, parseDateFromDisplay } from '@/lib/dateFormatHelpers';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import {
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell
} from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';
import DatePicker from '@/components/DatePicker';
import {
  Sparkles, Search, Loader2, Users, CalendarRange, Stethoscope,
  ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight,
  RefreshCcw, History
} from 'lucide-react';

const QUICK_FILTERS = [
  { key: 'period', label: 'Periode Saya' },
  { key: 'today', label: 'Hari Ini' },
  { key: 'week', label: 'Minggu Ini' },
  { key: 'month', label: 'Bulan Ini' },
  { key: 'all', label: 'Semua' },
];

const TYPE_COLOR_PALETTE = [
  'bg-indigo-50 text-indigo-700 border-indigo-200',
  'bg-emerald-50 text-emerald-700 border-emerald-200',
  'bg-amber-50 text-amber-700 border-amber-200',
  'bg-rose-50 text-rose-700 border-rose-200',
  'bg-sky-50 text-sky-700 border-sky-200',
  'bg-violet-50 text-violet-700 border-violet-200',
];

const colorForLabel = (label) => {
  if (!label) return 'bg-slate-100 text-slate-600 border-slate-200';
  let hash = 0;
  for (let i = 0; i < label.length; i++) hash = (hash * 31 + label.charCodeAt(i)) % TYPE_COLOR_PALETTE.length;
  return TYPE_COLOR_PALETTE[Math.abs(hash) % TYPE_COLOR_PALETTE.length];
};

const getPatientName = (recap) =>
  recap.actual_patients?.full_name || recap.patients?.full_name || recap.guest_name || 'Tanpa Nama';

const getPatientRM = (recap) =>
  recap.actual_patients?.medical_record_number || recap.patients?.medical_record_number || '-';

const getPatientKey = (recap) =>
  recap.actual_patient_id || recap.patient_id || recap.guest_name || recap.id;

const getDiagnosisList = (recap) => {
  if (Array.isArray(recap.diagnosis)) return recap.diagnosis.filter(Boolean);
  return recap.diagnosis ? [recap.diagnosis] : [];
};

const formatLocalDate = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const buildQuickRange = (key, therapist) => {
  const now = new Date();
  switch (key) {
    case 'today': {
      const t = formatLocalDate(now);
      return { start: t, end: t };
    }
    case 'week': {
      const day = now.getDay();
      const diffToMonday = (day + 6) % 7;
      const monday = new Date(now);
      monday.setDate(now.getDate() - diffToMonday);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      return { start: formatLocalDate(monday), end: formatLocalDate(sunday) };
    }
    case 'month':
      return {
        start: formatLocalDate(new Date(now.getFullYear(), now.getMonth(), 1)),
        end: formatLocalDate(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
      };
    case 'all':
      return { start: '', end: '' };
    case 'period':
    default: {
      const { startDate, endDate } = getTherapistPeriodRange(therapist);
      return { start: formatLocalDate(startDate), end: formatLocalDate(endDate) };
    }
  }
};

const TherapistPatientHistory = ({ therapist }) => {
  const { toast } = useToast();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  const [activeQuickFilter, setActiveQuickFilter] = useState('period');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [showStartCalendar, setShowStartCalendar] = useState(false);
  const [showEndCalendar, setShowEndCalendar] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [sortConfig, setSortConfig] = useState({ sortBy: 'recap_date', sortOrder: 'desc' });
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  const isPWA = (() => {
    try {
      return window.matchMedia('(display-mode: standalone)').matches ||
        window.navigator.standalone === true;
    } catch {
      return false;
    }
  })();

  useEffect(() => {
    if (!therapist?.id) return;
    const range = buildQuickRange('period', therapist);
    setDateRange(range);
    fetchHistory(range);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [therapist?.id]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, typeFilter, dateRange.start, dateRange.end]);

  const fetchHistory = async (range) => {
    if (!therapist?.id) return;
    setLoading(true);
    const { data, error } = await getDailyRecaps({
      therapistId: therapist.id,
      startDate: range.start || undefined,
      endDate: range.end || undefined,
      limit: 'all',
      sort: { key: 'recap_date', direction: 'desc' },
    });

    if (error) {
      toast({ variant: 'destructive', title: 'Gagal memuat riwayat', description: error.message });
      setRecords([]);
    } else {
      setRecords(data || []);
    }
    setLoading(false);
  };

  const handleQuickFilter = (key) => {
    setActiveQuickFilter(key);
    const range = buildQuickRange(key, therapist);
    setDateRange(range);
    fetchHistory(range);
  };

  const handleCustomDate = (field, isoValue) => {
    setActiveQuickFilter('custom');
    setDateRange((prev) => {
      const next = { ...prev, [field]: isoValue };
      fetchHistory(next);
      return next;
    });
  };

  const handleSort = (field) => {
    setSortConfig((prev) => {
      if (prev.sortBy === field) {
        return { ...prev, sortOrder: prev.sortOrder === 'asc' ? 'desc' : 'asc' };
      }
      return { sortBy: field, sortOrder: 'asc' };
    });
  };

  const renderSortIcon = (field) => {
    if (sortConfig.sortBy !== field) return <ArrowUpDown className="w-3 h-3 text-slate-300 ml-1" />;
    return sortConfig.sortOrder === 'asc'
      ? <ArrowUp className="w-3 h-3 text-indigo-600 ml-1" />
      : <ArrowDown className="w-3 h-3 text-indigo-600 ml-1" />;
  };

  const patientTypeOptions = useMemo(() => {
    const set = new Set(records.map((r) => r.patient_type).filter(Boolean));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [records]);

  const filteredList = useMemo(() => {
    const searchLower = searchTerm.trim().toLowerCase();
    return records.filter((r) => {
      const matchesType = typeFilter === 'all' ? true : r.patient_type === typeFilter;
      if (!matchesType) return false;
      if (!searchLower) return true;
      const haystack = [
        getPatientName(r),
        getPatientRM(r),
        r.patient_type || '',
        getDiagnosisList(r).join(' '),
      ].join(' ').toLowerCase();
      return haystack.includes(searchLower);
    });
  }, [records, searchTerm, typeFilter]);

  const sortedList = useMemo(() => {
    const list = [...filteredList];
    list.sort((a, b) => {
      let comparison = 0;
      if (sortConfig.sortBy === 'patient_name') {
        comparison = getPatientName(a).localeCompare(getPatientName(b));
      } else if (sortConfig.sortBy === 'patient_type') {
        comparison = (a.patient_type || '').localeCompare(b.patient_type || '');
      } else {
        comparison = (a.recap_date || '').localeCompare(b.recap_date || '');
      }
      return sortConfig.sortOrder === 'asc' ? comparison : -comparison;
    });
    return list;
  }, [filteredList, sortConfig]);

  const totalPages = Math.max(1, Math.ceil(sortedList.length / itemsPerPage));
  const paginatedList = sortedList.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const stats = useMemo(() => {
    const uniquePatients = new Set(records.map(getPatientKey)).size;
    const diagnosisCount = {};
    records.forEach((r) => getDiagnosisList(r).forEach((d) => {
      diagnosisCount[d] = (diagnosisCount[d] || 0) + 1;
    }));
    const topDiagnosis = Object.entries(diagnosisCount).sort((a, b) => b[1] - a[1])[0]?.[0] || '-';
    return { totalVisits: records.length, uniquePatients, topDiagnosis };
  }, [records]);

  const periodLabel = therapist ? formatTherapistPeriodLabel(therapist) : '';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-6 shadow-xl">
        <div className="absolute -top-16 -right-16 w-56 h-56 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-10 w-56 h-56 bg-amber-400/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/20 backdrop-blur">
              <Sparkles className="h-6 w-6 text-amber-300" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-indigo-300">
                {therapist?.name || 'Terapis'}
              </p>
              <h2 className="text-xl md:text-2xl font-bold text-white">Riwayat Pasien</h2>
              <p className="text-sm text-slate-400 mt-0.5">Rekam jejak terapi &amp; diagnosa pasien Anda</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 w-full md:w-auto">
            <div className="rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-center backdrop-blur">
              <p className="text-lg font-bold text-white">{stats.totalVisits}</p>
              <p className="text-[10px] uppercase tracking-wide text-slate-400 mt-0.5">Kunjungan</p>
            </div>
            <div className="rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-center backdrop-blur">
              <p className="text-lg font-bold text-white">{stats.uniquePatients}</p>
              <p className="text-[10px] uppercase tracking-wide text-slate-400 mt-0.5">Pasien Unik</p>
            </div>
            <div className="rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-center backdrop-blur">
              <p className="text-[11px] font-bold text-white truncate" title={periodLabel}>{periodLabel}</p>
              <p className="text-[10px] uppercase tracking-wide text-slate-400 mt-0.5">Periode Saya</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <Card className="p-4 space-y-4">
        <div className="flex flex-wrap gap-2">
          {QUICK_FILTERS.map((f) => (
            <Button
              key={f.key}
              size="sm"
              variant={activeQuickFilter === f.key ? 'default' : 'outline'}
              className={activeQuickFilter === f.key ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : ''}
              onClick={() => handleQuickFilter(f.key)}
            >
              {f.label}
            </Button>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchHistory(dateRange)}
            className="gap-1.5 w-full sm:w-auto sm:ml-auto"
          >
            <RefreshCcw className="w-3.5 h-3.5" /> Segarkan
          </Button>
        </div>

        <div className="flex flex-col md:flex-row gap-3 md:items-end">
          <div className="flex flex-wrap items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-200">
            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 shrink-0">
              <CalendarRange className="w-3.5 h-3.5" />Periode:
            </div>
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className="relative flex-1 min-w-0">
                <Input
                  value={displayDateID(dateRange.start)}
                  onChange={(e) => handleCustomDate('start', parseDateFromDisplay(e.target.value) || '')}
                  onClick={() => setShowStartCalendar(true)}
                  className="w-full min-w-0 text-xs h-8 bg-white border-slate-200"
                  placeholder="dd/MM/yyyy"
                />
                {showStartCalendar && (
                  <div className="absolute top-full left-0 z-50 mt-1">
                    <DatePicker
                      value={dateRange.start}
                      onChange={(val) => { handleCustomDate('start', val); setShowStartCalendar(false); }}
                      onClose={() => setShowStartCalendar(false)}
                    />
                  </div>
                )}
              </div>
              <span className="text-slate-400 shrink-0">-</span>
              <div className="relative flex-1 min-w-0">
                <Input
                  value={displayDateID(dateRange.end)}
                  onChange={(e) => handleCustomDate('end', parseDateFromDisplay(e.target.value) || '')}
                  onClick={() => setShowEndCalendar(true)}
                  className="w-full min-w-0 text-xs h-8 bg-white border-slate-200"
                  placeholder="dd/MM/yyyy"
                />
                {showEndCalendar && (
                  <div className="absolute top-full right-0 sm:left-0 sm:right-auto z-50 mt-1">
                    <DatePicker
                      value={dateRange.end}
                      onChange={(val) => { handleCustomDate('end', val); setShowEndCalendar(false); }}
                      onClose={() => setShowEndCalendar(false)}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex-1 space-y-1">
            <label className="text-xs font-semibold text-slate-500">Cari Pasien / Diagnosa</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <Input
                placeholder="Nama pasien, No. RM, atau diagnosa..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="w-full md:w-52 space-y-1">
            <label className="text-xs font-semibold text-slate-500">Tipe Pasien</label>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger><SelectValue placeholder="Semua Tipe" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Tipe</SelectItem>
                {patientTypeOptions.map((opt) => (
                  <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Content */}
      {isPWA ? (
        <div className="space-y-2">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="animate-spin w-6 h-6 text-indigo-600" /></div>
          ) : paginatedList.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">
              <History className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              {records.length === 0 ? 'Belum ada riwayat terapi pada periode ini.' : 'Tidak ada data yang cocok.'}
            </div>
          ) : paginatedList.map((r) => {
            const diagnosisList = getDiagnosisList(r);
            return (
              <div key={r.id} className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-bold text-slate-800 text-sm truncate">{getPatientName(r)}</p>
                    <p className="text-xs text-slate-400">{getPatientRM(r)}</p>
                  </div>
                  <Badge variant="outline" className="shrink-0 text-[10px] border-slate-200 text-slate-600">
                    {r.recap_date ? format(new Date(`${r.recap_date}T00:00:00`), 'dd MMM yyyy', { locale: idLocale }) : '-'}
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  {r.patient_type && (
                    <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full border', colorForLabel(r.patient_type))}>
                      {r.patient_type}
                    </span>
                  )}
                  {diagnosisList.length === 0 ? (
                    <span className="text-[10px] text-slate-400 italic">Belum ada diagnosa</span>
                  ) : diagnosisList.map((d, idx) => (
                    <span key={idx} className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                      {d}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="cursor-pointer hover:bg-slate-100 w-[140px]" onClick={() => handleSort('recap_date')}>
                    <div className="flex items-center gap-1">Tgl Terapi {renderSortIcon('recap_date')}</div>
                  </TableHead>
                  <TableHead className="cursor-pointer hover:bg-slate-100" onClick={() => handleSort('patient_name')}>
                    <div className="flex items-center gap-1">Nama Pasien {renderSortIcon('patient_name')}</div>
                  </TableHead>
                  <TableHead className="cursor-pointer hover:bg-slate-100 w-[160px]" onClick={() => handleSort('patient_type')}>
                    <div className="flex items-center gap-1">Tipe Pasien {renderSortIcon('patient_type')}</div>
                  </TableHead>
                  <TableHead>Diagnosa</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-12"><Loader2 className="animate-spin w-6 h-6 mx-auto text-indigo-600" /></TableCell></TableRow>
                ) : sortedList.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-12 text-slate-500">
                      {records.length === 0 ? 'Belum ada riwayat terapi pada periode ini.' : 'Tidak ada data yang cocok dengan filter.'}
                    </TableCell>
                  </TableRow>
                ) : paginatedList.map((r) => {
                  const diagnosisList = getDiagnosisList(r);
                  return (
                    <TableRow key={r.id} className="hover:bg-slate-50/50">
                      <TableCell>
                        <span className="text-sm font-medium text-slate-700">
                          {r.recap_date ? format(new Date(`${r.recap_date}T00:00:00`), 'dd MMM yyyy', { locale: idLocale }) : '-'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-900">{getPatientName(r)}</span>
                          <span className="text-xs text-slate-500">{getPatientRM(r)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {r.patient_type ? (
                          <span className={cn('text-xs font-semibold px-2.5 py-1 rounded-full border', colorForLabel(r.patient_type))}>
                            {r.patient_type}
                          </span>
                        ) : <span className="text-slate-400 text-xs">-</span>}
                      </TableCell>
                      <TableCell>
                        {diagnosisList.length === 0 ? (
                          <span className="text-xs text-slate-400 italic">Belum ada diagnosa</span>
                        ) : (
                          <div className="flex flex-wrap gap-1.5 max-w-md">
                            {diagnosisList.map((d, idx) => (
                              <span key={idx} className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                                <Stethoscope className="w-3 h-3 text-slate-400" />{d}
                              </span>
                            ))}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setCurrentPage((p) => p - 1)}>
            <ChevronLeft className="w-4 h-4 mr-1" /> Sebelumnya
          </Button>
          <div className="text-sm text-slate-600 px-2 flex items-center gap-1">
            <Users className="w-3.5 h-3.5 text-slate-400" /> Halaman {currentPage} / {totalPages}
          </div>
          <Button variant="outline" size="sm" disabled={currentPage === totalPages} onClick={() => setCurrentPage((p) => p + 1)}>
            Berikutnya <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
};

export default TherapistPatientHistory;
