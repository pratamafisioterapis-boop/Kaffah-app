import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Helmet } from 'react-helmet';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { Upload, Settings, Clock, AlertTriangle, CheckCircle2, Trash2, Loader2, RefreshCw, ChevronLeft } from 'lucide-react';
import { format, startOfMonth, endOfMonth, parseISO, differenceInCalendarDays, subDays } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import AttendanceUploadModal from '@/components/admin/AttendanceUploadModal';
import { getTherapistPeriodRange } from '@/lib/utils';
import {
  getAttendanceRecords,
  getAttendanceShiftSettings,
  upsertAttendanceShiftSetting,
  deleteAttendanceShiftSetting,
  getAttendanceScheduleLookup,
  getAttendanceEmployeeAliases,
  recalculateAllAttendanceRecords,
  getPhysiotherapists,
} from '@/lib/api';

// Falls back to the calendar month while therapist period settings are
// still loading; replaced by the clinic's most common therapist period
// (e.g. tgl 28 - 27) once loadDefaultPeriod resolves below.
const defaultCalendarMonth = () => ({
  startDate: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
  endDate: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
});

// Most clinics book every therapist on the same non-calendar cycle (e.g.
// 28th to 27th), so default the filter to whichever period_start_day/
// period_end_day combination the most therapists share, rather than the
// plain calendar month.
const findMostCommonPeriod = (therapistRows) => {
  if (!therapistRows || therapistRows.length === 0) return null;
  const counts = new Map();
  therapistRows.forEach((t) => {
    const key = `${t.period_start_day ?? 28}-${t.period_end_day ?? 27}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  let bestKey = null;
  let bestCount = 0;
  counts.forEach((count, key) => {
    if (count > bestCount) { bestCount = count; bestKey = key; }
  });
  if (!bestKey) return null;
  const [period_start_day, period_end_day] = bestKey.split('-').map(Number);
  return { period_start_day, period_end_day };
};

// Departments named "admin" (any case) are office/admin staff; everything
// else (fisio pagi, fisio sore, middle, etc.) is a therapist-facing shift.
const isAdminDepartment = (department) => (department || '').trim().toLowerCase() === 'admin';

const formatTanggalDenganHari = (dateStr) => {
  if (!dateStr) return '-';
  try {
    return format(parseISO(dateStr), 'EEEE, dd MMM yyyy', { locale: idLocale });
  } catch {
    return dateStr;
  }
};

const STATUS_LABEL = {
  on_time: { label: 'Tepat Waktu', className: 'bg-green-600' },
  late: { label: 'Terlambat', className: 'bg-red-600' },
  incomplete: { label: 'Tidak Lengkap', className: 'bg-amber-500' },
};

const AttendanceManagement = () => {
  const { toast } = useToast();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState([]);
  const [shiftSettings, setShiftSettings] = useState([]);
  const [therapists, setTherapists] = useState([]);
  const [aliases, setAliases] = useState([]);
  const [recalculating, setRecalculating] = useState(false);

  const [startDate, setStartDate] = useState(defaultCalendarMonth().startDate);
  const [endDate, setEndDate] = useState(defaultCalendarMonth().endDate);
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [employeeFilter, setEmployeeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dailyRoleFilter, setDailyRoleFilter] = useState('all');
  const userEditedDateRangeRef = useRef(false);

  const handleStartDateChange = (value) => { userEditedDateRangeRef.current = true; setStartDate(value); };
  const handleEndDateChange = (value) => { userEditedDateRangeRef.current = true; setEndDate(value); };

  const handlePreviousPeriod = () => {
    userEditedDateRangeRef.current = true;
    const periodLengthDays = differenceInCalendarDays(parseISO(endDate), parseISO(startDate)) + 1;
    setEndDate(format(subDays(parseISO(startDate), 1), 'yyyy-MM-dd'));
    setStartDate(format(subDays(parseISO(startDate), periodLengthDays), 'yyyy-MM-dd'));
  };

  const shiftSettingsByDept = useMemo(() => {
    const map = {};
    shiftSettings.forEach((s) => { map[s.department] = { expected_check_in: s.expected_check_in?.slice(0, 5), grace_minutes: s.grace_minutes }; });
    return map;
  }, [shiftSettings]);

  const loadRecords = useCallback(async () => {
    setLoading(true);
    const { data, error } = await getAttendanceRecords({
      startDate,
      endDate,
      department: departmentFilter === 'all' ? undefined : departmentFilter,
      employeeName: employeeFilter === 'all' ? undefined : employeeFilter,
      status: statusFilter === 'all' ? undefined : statusFilter,
    });
    if (error) {
      toast({ variant: 'destructive', title: 'Gagal memuat data absensi', description: error.message });
    } else {
      setRecords(data || []);
    }
    setLoading(false);
  }, [startDate, endDate, departmentFilter, employeeFilter, statusFilter, toast]);

  const handleRecalculate = async () => {
    setRecalculating(true);
    const { data, error } = await recalculateAllAttendanceRecords({ startDate, endDate });
    setRecalculating(false);
    if (error) {
      toast({ variant: 'destructive', title: 'Gagal menghitung ulang', description: error.message });
      return;
    }
    toast({ title: 'Selesai', description: `${data?.updated || 0} data absensi dihitung ulang sesuai jadwal terbaru.` });
    loadRecords();
  };

  const loadShiftSettings = useCallback(async () => {
    const { data } = await getAttendanceShiftSettings();
    setShiftSettings(data || []);
  }, []);

  const loadTherapists = useCallback(async () => {
    const { data } = await getAttendanceScheduleLookup();
    setTherapists(data || []);
  }, []);

  const loadAliases = useCallback(async () => {
    const { data } = await getAttendanceEmployeeAliases();
    setAliases(data || []);
  }, []);

  useEffect(() => { loadShiftSettings(); }, [loadShiftSettings]);
  useEffect(() => { loadTherapists(); }, [loadTherapists]);
  useEffect(() => { loadAliases(); }, [loadAliases]);
  useEffect(() => { loadRecords(); }, [loadRecords]);

  useEffect(() => {
    (async () => {
      const { data } = await getPhysiotherapists();
      if (userEditedDateRangeRef.current) return; // user already changed the filter, don't override it
      const activeTherapists = (data || []).filter((t) => t.is_active !== false);
      const mostCommon = findMostCommonPeriod(activeTherapists);
      if (!mostCommon) return;
      const range = getTherapistPeriodRange(mostCommon);
      setStartDate(format(range.startDate, 'yyyy-MM-dd'));
      setEndDate(format(range.endDate, 'yyyy-MM-dd'));
    })();
  }, []);

  const departments = useMemo(() => {
    const set = new Set(records.map((r) => r.department).filter(Boolean));
    return Array.from(set).sort();
  }, [records]);

  const employees = useMemo(() => {
    const set = new Set(records.map((r) => r.employee_name).filter(Boolean));
    return Array.from(set).sort();
  }, [records]);

  const summary = useMemo(() => {
    const byEmployee = {};
    for (const r of records) {
      if (!byEmployee[r.employee_name]) {
        byEmployee[r.employee_name] = { employee_name: r.employee_name, department: r.department, total: 0, late: 0, onTime: 0, incomplete: 0, totalLateMinutes: 0 };
      }
      const e = byEmployee[r.employee_name];
      e.total += 1;
      if (r.status === 'late') { e.late += 1; e.totalLateMinutes += r.late_minutes || 0; }
      else if (r.status === 'on_time') e.onTime += 1;
      else if (r.status === 'incomplete') e.incomplete += 1;
    }
    return Object.values(byEmployee).sort((a, b) => b.late - a.late);
  }, [records]);

  const dailyRecords = useMemo(() => {
    if (dailyRoleFilter === 'all') return records;
    if (dailyRoleFilter === 'admin') return records.filter((r) => isAdminDepartment(r.department));
    return records.filter((r) => !isAdminDepartment(r.department));
  }, [records, dailyRoleFilter]);

  return (
    <div className="space-y-6">
      <Helmet><title>Absensi Karyawan - Admin</title></Helmet>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Absensi Karyawan</h1>
          <p className="text-slate-500 text-sm">Pantau kedisiplinan jam masuk &amp; pulang karyawan dari data mesin absensi.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setSettingsOpen((v) => !v)} className="gap-2">
            <Settings className="w-4 h-4" /> Jam Kerja
          </Button>
          <Button variant="outline" onClick={handleRecalculate} disabled={recalculating} className="gap-2" title="Hitung ulang status/keterlambatan data yang sudah tersimpan sesuai jadwal terbaru">
            {recalculating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Hitung Ulang
          </Button>
          <Button onClick={() => setUploadOpen(true)} className="gap-2">
            <Upload className="w-4 h-4" /> Upload Absensi
          </Button>
        </div>
      </div>

      {settingsOpen && (
        <ShiftSettingsPanel
          shiftSettings={shiftSettings}
          departments={departments}
          onChanged={loadShiftSettings}
        />
      )}

      <Card>
        <CardContent className="pt-6 grid grid-cols-2 sm:grid-cols-6 gap-3">
          <div className="flex items-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handlePreviousPeriod}
              className="gap-1 w-full"
              title="Geser ke periode sebelumnya"
            >
              <ChevronLeft className="w-4 h-4" /> Periode Sebelumnya
            </Button>
          </div>
          <div>
            <Label className="text-xs">Dari Tanggal</Label>
            <Input type="date" value={startDate} onChange={(e) => handleStartDateChange(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Sampai Tanggal</Label>
            <Input type="date" value={endDate} onChange={(e) => handleEndDateChange(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Departemen</Label>
            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Departemen</SelectItem>
                {departments.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Karyawan</Label>
            <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Karyawan</SelectItem>
                {employees.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Status</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Status</SelectItem>
                <SelectItem value="on_time">Tepat Waktu</SelectItem>
                <SelectItem value="late">Terlambat</SelectItem>
                <SelectItem value="incomplete">Tidak Lengkap</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Rekap Kedisiplinan per Karyawan</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
          ) : summary.length === 0 ? (
            <p className="text-center text-slate-400 py-10 text-sm">Belum ada data absensi pada periode ini.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama</TableHead>
                    <TableHead>Departemen</TableHead>
                    <TableHead className="text-center">Hari Terekam</TableHead>
                    <TableHead className="text-center">Tepat Waktu</TableHead>
                    <TableHead className="text-center">Terlambat</TableHead>
                    <TableHead className="text-center">Total Menit Telat</TableHead>
                    <TableHead className="text-center">Tidak Lengkap</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.map((e) => (
                    <TableRow key={e.employee_name}>
                      <TableCell className="font-medium">{e.employee_name}</TableCell>
                      <TableCell>{e.department || '-'}</TableCell>
                      <TableCell className="text-center">{e.total}</TableCell>
                      <TableCell className="text-center text-green-600 font-medium">{e.onTime}</TableCell>
                      <TableCell className="text-center text-red-600 font-medium">{e.late}</TableCell>
                      <TableCell className="text-center">{e.totalLateMinutes}m</TableCell>
                      <TableCell className="text-center text-amber-600 font-medium">{e.incomplete}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <CardTitle className="text-base">Detail Harian</CardTitle>
          <div className="w-full sm:w-48">
            <Select value={dailyRoleFilter} onValueChange={setDailyRoleFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Terapis + Admin</SelectItem>
                <SelectItem value="terapis">Terapis</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
          ) : dailyRecords.length === 0 ? (
            <p className="text-center text-slate-400 py-10 text-sm">Tidak ada data untuk filter yang dipilih.</p>
          ) : (
            <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
              <Table>
                <TableHeader className="bg-slate-50 sticky top-0">
                  <TableRow>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Nama</TableHead>
                    <TableHead>Departemen</TableHead>
                    <TableHead>Masuk</TableHead>
                    <TableHead>Pulang</TableHead>
                    <TableHead>Jadwal Masuk</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dailyRecords.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap">{formatTanggalDenganHari(r.attendance_date)}</TableCell>
                      <TableCell className="font-medium">{r.employee_name}</TableCell>
                      <TableCell>{r.department || '-'}</TableCell>
                      <TableCell>{r.check_in?.slice(0, 5) || '-'}</TableCell>
                      <TableCell>{r.check_out?.slice(0, 5) || '-'}</TableCell>
                      <TableCell className="text-xs text-slate-500">{r.expected_check_in?.slice(0, 5) || '-'}</TableCell>
                      <TableCell>
                        <Badge className={STATUS_LABEL[r.status]?.className}>
                          {STATUS_LABEL[r.status]?.label}
                          {r.status === 'late' && r.late_minutes ? ` (${r.late_minutes}m)` : ''}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <AttendanceUploadModal
        isOpen={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onSuccess={loadRecords}
        shiftSettingsByDept={shiftSettingsByDept}
        therapists={therapists}
        aliases={aliases}
        onAliasesChanged={loadAliases}
      />
    </div>
  );
};

const ShiftSettingsPanel = ({ shiftSettings, departments, onChanged }) => {
  const { toast } = useToast();
  const [department, setDepartment] = useState('');
  const [expectedCheckIn, setExpectedCheckIn] = useState('08:00');
  const [graceMinutes, setGraceMinutes] = useState(15);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!department.trim()) {
      toast({ variant: 'destructive', title: 'Departemen wajib diisi' });
      return;
    }
    setSaving(true);
    const { error } = await upsertAttendanceShiftSetting({
      department: department.trim(),
      expected_check_in: expectedCheckIn,
      grace_minutes: Number(graceMinutes) || 0,
    });
    setSaving(false);
    if (error) {
      toast({ variant: 'destructive', title: 'Gagal menyimpan', description: error.message });
      return;
    }
    setDepartment('');
    onChanged();
  };

  const handleDelete = async (id) => {
    const { error } = await deleteAttendanceShiftSetting(id);
    if (error) {
      toast({ variant: 'destructive', title: 'Gagal menghapus', description: error.message });
      return;
    }
    onChanged();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><Clock className="w-4 h-4" /> Jam Masuk per Departemen</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-slate-500 flex items-start gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-500" />
          Untuk fisioterapis, jam masuk yang diharapkan otomatis mengikuti jadwal praktik pada hari itu di kalender booking (atur di menu Physiotherapist Management).
          Pengaturan di bawah ini hanya dipakai sebagai cadangan — untuk karyawan non-fisioterapis, atau saat fisioterapis tidak punya jadwal pada hari tersebut.
          Departemen tanpa pengaturan memakai default 08:00 (toleransi 15 menit).
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label className="text-xs">Departemen</Label>
            <Input value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="mis. fisio pagi" className="w-40" />
          </div>
          <div>
            <Label className="text-xs">Jam Masuk</Label>
            <Input type="time" value={expectedCheckIn} onChange={(e) => setExpectedCheckIn(e.target.value)} className="w-32" />
          </div>
          <div>
            <Label className="text-xs">Toleransi (menit)</Label>
            <Input type="number" min="0" value={graceMinutes} onChange={(e) => setGraceMinutes(e.target.value)} className="w-24" />
          </div>
          <Button onClick={handleSave} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Simpan'}</Button>
        </div>

        {shiftSettings.length > 0 && (
          <div className="border rounded-md divide-y">
            {shiftSettings.map((s) => (
              <div key={s.id} className="flex items-center justify-between px-3 py-2 text-sm">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-slate-400" />
                  <span className="font-medium">{s.department}</span>
                  <span className="text-slate-500">jam {s.expected_check_in?.slice(0, 5)}, toleransi {s.grace_minutes} menit</span>
                </div>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(s.id)}>
                  <Trash2 className="w-4 h-4 text-red-500" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AttendanceManagement;
