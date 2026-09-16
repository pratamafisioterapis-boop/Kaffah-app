import { supabase } from '@/lib/customSupabaseClient';
import React, { useState } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { createTherapistSchedule } from '@/lib/api';
import * as ScheduleValidation from '@/lib/therapistScheduleValidation';
import * as Utils from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Plus, Trash2, CheckCircle, Clock, AlertTriangle, Copy, RotateCcw, Bug, Info, Wand2, ListPlus } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/SupabaseAuthContext';

const DAYS = [
  { value: 1, label: 'Senin' },
  { value: 2, label: 'Selasa' },
  { value: 3, label: 'Rabu' },
  { value: 4, label: 'Kamis' },
  { value: 5, label: 'Jumat' },
  { value: 6, label: 'Sabtu' },
  { value: 0, label: 'Minggu' },
];

const DURATION_OPTIONS = [30, 45, 60, 90, 120];
const GAP_OPTIONS = [0, 5, 10, 15, 30];
const CAPACITY_OPTIONS = [1, 2, 3, 4, 5, 6, 8, 10];

const timeToMinutes = (time) => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

const minutesToTime = (mins) => {
  const h = Math.floor(mins / 60).toString().padStart(2, '0');
  const m = (mins % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
};

// One shift = one bookable slot for one patient. To fit several patients in
// a practice window, we slice [openTime, closeTime) into duration-minute
// chunks (separated by an optional gap) instead of asking the owner to add
// each chunk by hand.
const generateSlotsFromWindow = (openTime, closeTime, durationMinutes, gapMinutes) => {
  const open = timeToMinutes(openTime);
  const close = timeToMinutes(closeTime);
  const slots = [];
  let cursor = open;
  while (cursor + durationMinutes <= close) {
    slots.push({ start_time: minutesToTime(cursor), end_time: minutesToTime(cursor + durationMinutes) });
    cursor += durationMinutes + gapMinutes;
  }
  return slots;
};

const getErrorDisplay = (result) => {
  if (!result) {
    return {
      message: 'Unknown error occurred (No result returned)',
      code: 'UNKNOWN',
      fullObject: 'No result object provided'
    };
  }
  
  const isErrorObject = result instanceof Error || (result.message && !result.error && !result.data);
  const errorSource = isErrorObject ? result : (result.error || result);

  let errorMessage = 'Unknown error';
  if (typeof errorSource === 'string') {
    errorMessage = errorSource;
  } else if (errorSource?.message) {
    errorMessage = errorSource.message;
  } else if (errorSource?.error?.message) {
    errorMessage = errorSource.error.message;
  }

  let errorCode = 'N/A';
  if (errorSource?.code) errorCode = errorSource.code;
  else if (errorSource?.error?.code) errorCode = errorSource.error.code;

  return {
    fullObject: JSON.stringify(result, null, 2),
    message: errorMessage,
    code: errorCode,
    originalResult: result
  };
};

const TherapistScheduleForm = ({ therapist, onSuccess, onCancel, existingSchedules = [] }) => {
  const { toast } = useToast();
  const { user, session } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  
  const [dayOfWeek, setDayOfWeek] = useState("1");
  const [shifts, setShifts] = useState([
    { start_time: "09:00", end_time: "10:00" }
  ]);

  // How many patients this therapist can see at once during each slot
  // created below (e.g. group therapy, multiple beds/rooms). 1 = the
  // original one-patient-per-slot behavior.
  const [capacity, setCapacity] = useState(1);

  // "auto" lets the owner describe practice hours + duration per patient and
  // has the form slice that into individual bookable slots. "manual" is the
  // original one-shift-at-a-time editor for irregular hours.
  const [mode, setMode] = useState("auto");
  const [autoConfig, setAutoConfig] = useState({
    openTime: "09:00",
    closeTime: "17:00",
    duration: 60,
    gap: 0,
  });

  const previewSlots = mode === 'auto'
    ? generateSlotsFromWindow(autoConfig.openTime, autoConfig.closeTime, autoConfig.duration, autoConfig.gap)
    : shifts;

  const handleApplyAutoSlots = () => {
    const generated = generateSlotsFromWindow(autoConfig.openTime, autoConfig.closeTime, autoConfig.duration, autoConfig.gap);
    if (generated.length === 0) {
      toast({
        title: "Tidak ada slot yang bisa dibuat",
        description: "Pastikan jam tutup lebih besar dari jam buka + durasi per pasien.",
        variant: "destructive"
      });
      return;
    }
    setShifts(generated);
    setMode('manual');
    toast({
      title: `${generated.length} slot dibuat`,
      description: "Periksa daftar slot di bawah, lalu klik Simpan Jadwal.",
      className: "bg-blue-50 border-blue-200"
    });
  };

  const [errorState, setErrorState] = useState({
    isOpen: false,
    title: '',
    message: '',
    code: '',
    fullObject: '',
    originalResult: null
  });

  // Debug state to store last submission details
  const [debugInfo, setDebugInfo] = useState({
      lastPayload: null,
      lastError: null,
      validationResults: null
  });

  const handleAddShift = () => {
    setShifts([...shifts, { start_time: "13:00", end_time: "17:00" }]);
  };

  const handleRemoveShift = (index) => {
    const newShifts = [...shifts];
    newShifts.splice(index, 1);
    setShifts(newShifts);
  };

  const updateShift = (index, field, value) => {
    const newShifts = [...shifts];
    newShifts[index][field] = value;
    setShifts(newShifts);
  };

  const handleSubmit = async () => {
    if (!therapist) return;
    setLoading(true);
    setErrorState(prev => ({ ...prev, isOpen: false }));

    // Debug: Log Auth State
    console.log("Submit initiated by User:", user?.id);
    console.log("Session valid:", !!session);

    try {
      if (!user) {
          throw new Error("Anda harus login terlebih dahulu.");
      }

      // 1. Shift Logic Validation
      if (shifts.length === 0) {
        throw new Error("Minimal satu shift harus diisi.");
      }

      for (let i = 0; i < shifts.length; i++) {
        const shift = shifts[i];
        
        // Use new validation helper for time format
        const startValid = ScheduleValidation.validateTimeFormat(shift.start_time);
        if (!startValid.valid) throw new Error(`Shift #${i+1}: ${startValid.error}`);

        const endValid = ScheduleValidation.validateTimeFormat(shift.end_time);
        if (!endValid.valid) throw new Error(`Shift #${i+1}: ${endValid.error}`);
        
        const timeRangeVal = ScheduleValidation.validateTimeRange(shift.start_time, shift.end_time);
        if (!timeRangeVal.valid) {
          throw new Error(`Shift #${i+1}: ${timeRangeVal.error}`);
        }

        // OVERLAP VALIDATION DISABLED (allow overlapping shifts)
// const otherNewShifts = shifts.filter((_, idx) => idx !== i);
// const internalOverlap = Utils.validateNoOverlappingShifts(shift, otherNewShifts);
// if (!internalOverlap.valid) {
//      throw new Error(`Shift #${i+1}: Bertabrakan dengan shift lain yang sedang dibuat.`);
// }
        
        
      }
// DELETE DISABLED (support multi shift)
// const { error: deleteError } = await supabase
//   .from('therapist_schedules')
//   .delete()
//   .eq('therapist_id', therapist.id)
//   .eq('day_of_week', parseInt(dayOfWeek));



      // 2. Submit Loop
      const results = [];
      for (let i = 0; i < shifts.length; i++) {
        const shift = shifts[i];
        const payload = {
          therapist_id: therapist.id,
          day_of_week: parseInt(dayOfWeek),
          start_time: `${shift.start_time}:00`,
          end_time: `${shift.end_time}:00`,
          display_start_time: `${shift.start_time}:00`,
          display_end_time: `${shift.end_time}:00`,
          is_active: true,
          is_display_active: true,
          clinic_id: therapist.clinic_id,
          capacity: capacity
        };

        // Detailed Validation Logging
        const validation = ScheduleValidation.validateSchedulePayload(payload);
        
        setDebugInfo(prev => ({
            ...prev,
            lastPayload: payload,
            validationResults: validation
        }));

        console.log(`Payload for Shift #${i+1}:`, payload);
        console.log(`Validation Result #${i+1}:`, validation);

        if (!validation.valid) {
           throw new Error(`Validasi Gagal (Shift #${i+1}): ${validation.errorString}`);
        }
// CEK DUPLICATE DULU
const { data: existing } = await supabase
  .from('therapist_schedules')
  .select('*')
  .eq('therapist_id', payload.therapist_id)
  .eq('day_of_week', payload.day_of_week)
  .eq('start_time', payload.start_time)
  .eq('end_time', payload.end_time)
  .maybeSingle();

if (existing) {
  console.log('⏭️ Skip duplicate shift:', payload);
  continue;
}

// BARU INSERT
        const result = await createTherapistSchedule(payload);
        console.log(`API Result for Shift #${i+1}:`, result);

        results.push({ ...result, index: i });
      }
if (results.length === 0) {
  throw new Error("Semua shift sudah ada, tidak ada data baru yang disimpan.");
}
      // 3. Process Results & Error Handling
      const failed = results.filter(r => r.success === false || r.error);
      
      if (failed.length > 0) {
        const firstFailure = failed[0];
        const errIndex = firstFailure.index + 1;
        const rawError = firstFailure.error || firstFailure;

        setDebugInfo(prev => ({ ...prev, lastError: rawError }));
        console.error("❌ Schedule Save Error Object:", JSON.stringify(rawError, null, 2));

        const { message, code, fullObject, originalResult } = getErrorDisplay(firstFailure);
        
        // Friendly Title Map
        let errorTitle = "Gagal Menyimpan Jadwal";
        if (code === 'RLS_ERROR') errorTitle = "Izin Ditolak";
        else if (code === 'FK_ERROR') errorTitle = "Data Referensi Tidak Ditemukan";
        else if (code === 'UNIQUE_CONSTRAINT_ERROR') errorTitle = "Jadwal Duplikat";
        else if (code === 'VALIDATION_ERROR') errorTitle = "Validasi Gagal";

        setErrorState({
            isOpen: true,
            title: `${errorTitle} (Shift #${errIndex})`,
            message: message,
            code: code,
            fullObject: fullObject,
            originalResult: originalResult
        });
        
        return;
      }

      toast({
        title: "Berhasil",
        description: `${results.length} shift berhasil ditambahkan.`,
        className: "bg-green-50 border-green-200 text-green-800"
      });
      
      onSuccess();
      setShifts([{ start_time: "09:00", end_time: "10:00" }]);
      setMode('auto');
      setCapacity(1);

    } catch (error) {
      console.error("❌ Form Unexpected Error:", error);
      const { message, code, fullObject, originalResult } = getErrorDisplay(error);

      setDebugInfo(prev => ({ ...prev, lastError: error }));

      setErrorState({
        isOpen: true,
        title: 'Gagal Memproses Permintaan',
        message: message,
        code: code,
        fullObject: fullObject,
        originalResult: originalResult
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCopyError = () => {
    if (errorState.fullObject) {
        navigator.clipboard.writeText(errorState.fullObject);
        toast({ title: "Copied", description: "Error details copied to clipboard." });
    }
  };

  // Check if development mode using import.meta.env
  const isDevelopment = import.meta.env.DEV;

  return (
    <>
        <Card className="border-slate-200 shadow-sm relative">
            <CardHeader className="bg-slate-50 border-b pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                    <Clock className="w-5 h-5 text-slate-500" />
                    Atur Jadwal Baru
                </CardTitle>
                <CardDescription>Tambahkan jam praktek untuk {therapist?.name}</CardDescription>

                {/* Dev Only: Debug Toggle */}
                {isDevelopment && (
                    <Button
                        variant="ghost"
                        size="sm"
                        className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
                        onClick={() => setShowDebug(!showDebug)}
                    >
                        <Bug className="h-4 w-4" />
                    </Button>
                )}
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
                <div className="flex gap-2.5 p-3 bg-blue-50 border border-blue-100 rounded-lg text-blue-800 text-xs leading-relaxed">
                    <Info className="w-4 h-4 shrink-0 mt-0.5" />
                    <p>
                        <strong>1 slot = 1 pasien</strong> secara default. Jam praktek harus dibagi menjadi beberapa slot
                        agar bisa diisi lebih dari satu pasien dalam sehari. Gunakan mode <strong>Otomatis</strong> di
                        bawah untuk membagi jam buka-tutup menjadi slot per pasien secara langsung, atau
                        pakai mode <strong>Manual</strong> jika jam prakteknya tidak beraturan. Jika klinik bisa menangani
                        beberapa pasien sekaligus di jam yang sama (mis. terapi kelompok, beberapa bed), naikkan
                        <strong> Kapasitas per Slot</strong> di bawah.
                    </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                        <Label>Hari Kerja</Label>
                        <Select value={dayOfWeek} onValueChange={setDayOfWeek}>
                            <SelectTrigger className="w-full">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {DAYS.map(d => (
                                    <SelectItem key={d.value} value={d.value.toString()}>{d.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label>Kapasitas per Slot</Label>
                        <Select value={capacity.toString()} onValueChange={(v) => setCapacity(parseInt(v, 10))}>
                            <SelectTrigger className="w-full">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {CAPACITY_OPTIONS.map(c => (
                                    <SelectItem key={c} value={c.toString()}>
                                        {c} pasien{c > 1 ? ' bersamaan' : ''}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-lg">
                    <button
                        type="button"
                        onClick={() => setMode('auto')}
                        className={`flex items-center justify-center gap-1.5 text-sm font-medium py-2 rounded-md transition-colors ${mode === 'auto' ? 'bg-white shadow-sm text-blue-700' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <Wand2 className="w-4 h-4" /> Otomatis
                    </button>
                    <button
                        type="button"
                        onClick={() => setMode('manual')}
                        className={`flex items-center justify-center gap-1.5 text-sm font-medium py-2 rounded-md transition-colors ${mode === 'manual' ? 'bg-white shadow-sm text-blue-700' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <ListPlus className="w-4 h-4" /> Manual
                    </button>
                </div>

                {mode === 'auto' ? (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <span className="text-xs font-medium text-slate-500">Jam Buka Praktek</span>
                                <Input
                                    type="time"
                                    value={autoConfig.openTime}
                                    onChange={(e) => setAutoConfig(prev => ({ ...prev, openTime: e.target.value }))}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <span className="text-xs font-medium text-slate-500">Jam Tutup Praktek</span>
                                <Input
                                    type="time"
                                    value={autoConfig.closeTime}
                                    onChange={(e) => setAutoConfig(prev => ({ ...prev, closeTime: e.target.value }))}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <span className="text-xs font-medium text-slate-500">Durasi per Pasien</span>
                                <Select
                                    value={autoConfig.duration.toString()}
                                    onValueChange={(v) => setAutoConfig(prev => ({ ...prev, duration: parseInt(v, 10) }))}
                                >
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {DURATION_OPTIONS.map(d => (
                                            <SelectItem key={d} value={d.toString()}>{d} menit</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <span className="text-xs font-medium text-slate-500">Jeda Antar Pasien</span>
                                <Select
                                    value={autoConfig.gap.toString()}
                                    onValueChange={(v) => setAutoConfig(prev => ({ ...prev, gap: parseInt(v, 10) }))}
                                >
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {GAP_OPTIONS.map(g => (
                                            <SelectItem key={g} value={g.toString()}>{g === 0 ? 'Tanpa jeda' : `${g} menit`}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                            <p className="text-xs font-medium text-slate-500 mb-2">
                                Pratinjau: {previewSlots.length} slot akan dibuat{capacity > 1 ? `, masing-masing ${capacity} pasien` : ''}
                            </p>
                            {previewSlots.length > 0 ? (
                                <div className="flex flex-wrap gap-1.5">
                                    {previewSlots.map((s, i) => (
                                        <span key={i} className="text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-full px-2.5 py-1">
                                            {s.start_time} - {s.end_time}{capacity > 1 ? ` ×${capacity}` : ''}
                                        </span>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-xs text-slate-400 italic">
                                    Atur jam buka, jam tutup, dan durasi yang valid untuk melihat pratinjau slot.
                                </p>
                            )}
                        </div>

                        <Button
                            type="button"
                            variant="outline"
                            className="w-full border-blue-200 text-blue-700 hover:bg-blue-50"
                            onClick={handleApplyAutoSlots}
                            disabled={previewSlots.length === 0}
                        >
                            <Wand2 className="w-4 h-4 mr-2" /> Gunakan {previewSlots.length} Slot Ini
                        </Button>
                    </div>
                ) : (
                <>
                <div className="space-y-4">
                    <Label>Slot Pasien (setiap baris = 1 slot, kapasitas {capacity} pasien)</Label>
                    {shifts.map((shift, idx) => (
                        <div key={idx} className="flex flex-col sm:flex-row gap-3 items-end p-3 bg-slate-50 rounded-lg border border-slate-200 relative group animate-in slide-in-from-left-2 duration-300">
                            <div className="w-full sm:w-1/2 space-y-1.5">
                                <span className="text-xs font-medium text-slate-500">Mulai</span>
                                <Input 
                                    type="time" 
                                    value={shift.start_time} 
                                    onChange={(e) => updateShift(idx, 'start_time', e.target.value)}
                                    className="bg-white"
                                />
                            </div>
                            <div className="w-full sm:w-1/2 space-y-1.5">
                                <span className="text-xs font-medium text-slate-500">Selesai</span>
                                <Input 
                                    type="time" 
                                    value={shift.end_time} 
                                    onChange={(e) => updateShift(idx, 'end_time', e.target.value)}
                                    className="bg-white"
                                />
                            </div>
                            
                            {shifts.length > 1 && (
                                <Button 
                                    type="button" 
                                    variant="ghost" 
                                    size="icon"
                                    className="text-slate-400 hover:text-red-500 hover:bg-red-50 sm:mb-0.5"
                                    onClick={() => handleRemoveShift(idx)}
                                >
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            )}
                        </div>
                    ))}
                </div>

                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddShift}
                    className="w-full border-dashed text-slate-500 hover:text-blue-600 hover:bg-blue-50"
                >
                    <Plus className="w-4 h-4 mr-2" /> Tambah Slot
                </Button>
                </>
                )}
            </CardContent>
            
            {/* Debug Panel (Dev Only) */}
            {isDevelopment && showDebug && (
                <div className="p-4 m-4 bg-slate-900 rounded-md border border-slate-700 text-xs font-mono text-slate-300 overflow-hidden">
                    <div className="font-bold text-yellow-400 mb-2 border-b border-slate-700 pb-1">DEV DEBUG PANEL</div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <span className="text-slate-500 block">Current User ID:</span>
                            <span className="text-green-400 break-all">{user?.id || 'Not logged in'}</span>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-700">
                <span className="text-slate-500 block mb-1">existingSchedules:</span>
                <pre className="overflow-x-auto p-2 bg-black rounded max-h-40 text-xs">
                  {JSON.stringify(existingSchedules, null, 2)}
                </pre>
              </div>

                         <div>
                            <span className="text-slate-500 block">Session Active:</span>
                            <span className={session ? "text-green-400" : "text-red-400"}>{session ? "YES" : "NO"}</span>
                        </div>
                        <div>
                            <span className="text-slate-500 block">Therapist ID:</span>
                            <span className="text-blue-400 break-all">{therapist?.id || 'Missing'}</span>
                        </div>
                         <div>
                            <span className="text-slate-500 block">Clinic ID:</span>
                            <span className="text-blue-400 break-all">{therapist?.clinic_id || 'Missing'}</span>
                        </div>
                    </div>
                    {debugInfo.lastPayload && (
                        <div className="mt-3 pt-3 border-t border-slate-700">
                             <span className="text-slate-500 block mb-1">Last Payload:</span>
                             <pre className="overflow-x-auto p-2 bg-black rounded max-h-32 text-xs">
                                {JSON.stringify(debugInfo.lastPayload, null, 2)}
                             </pre>
                        </div>
                    )}
                     {debugInfo.lastError && (
                        <div className="mt-3 pt-3 border-t border-slate-700">
                             <span className="text-slate-500 block mb-1 text-red-400">Last Error:</span>
                             <pre className="overflow-x-auto p-2 bg-black rounded max-h-32 text-xs text-red-300">
                                {JSON.stringify(debugInfo.lastError, null, 2)}
                             </pre>
                        </div>
                    )}
                </div>
            )}

            <CardFooter className="bg-slate-50 border-t p-4 flex justify-end gap-3">
                <Button variant="ghost" onClick={onCancel} disabled={loading}>Batal</Button>
                <Button onClick={handleSubmit} disabled={loading} className="bg-blue-600 hover:bg-blue-700">
                    {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                    Simpan Jadwal
                </Button>
            </CardFooter>
        </Card>

        {/* Enhanced Error Modal */}
        <Dialog open={errorState.isOpen} onOpenChange={(open) => setErrorState(prev => ({ ...prev, isOpen: open }))}>
            <DialogContent className="max-w-md md:max-w-lg lg:max-w-xl p-0 overflow-hidden rounded-lg">
                <DialogHeader className="px-4 py-4 md:px-6 md:py-6 bg-red-50 border-b border-red-100">
                    <DialogTitle className="flex items-center gap-2 text-red-700">
                        <AlertTriangle className="h-5 w-5 md:h-6 md:w-6" />
                        {errorState.title}
                    </DialogTitle>
                    <DialogDescription className="text-red-600 font-medium pt-1">
                        Terjadi kesalahan saat menyimpan data.
                    </DialogDescription>
                </DialogHeader>
                
                <div className="px-4 py-4 md:px-6 md:py-6 space-y-4">
                    <div className="space-y-1">
                        <div className="flex flex-col sm:flex-row sm:gap-4 text-sm">
                           <span className="font-semibold text-slate-700 w-24 flex-shrink-0">Error Code:</span>
                           <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-800">{errorState.code}</span>
                        </div>
                        <div className="flex flex-col sm:flex-row sm:gap-4 text-sm">
                           <span className="font-semibold text-slate-700 w-24 flex-shrink-0">Message:</span>
                           <span className="text-slate-800 break-words">{errorState.message}</span>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Full Response Object</Label>
                        <div className="bg-slate-900 rounded-md p-3 md:p-4 overflow-hidden shadow-inner border border-slate-700">
                            <pre className="text-xs md:text-sm font-mono text-green-400 whitespace-pre-wrap break-all overflow-y-auto max-h-[300px] md:max-h-[400px]">
                                {errorState.fullObject}
                            </pre>
                        </div>
                    </div>
                </div>

                <DialogFooter className="px-4 py-4 md:px-6 md:py-6 bg-slate-50 border-t flex flex-col sm:flex-row gap-3 sm:justify-between items-center">
                    <Button variant="outline" className="w-full sm:w-auto order-2 sm:order-1" onClick={handleCopyError}>
                        <Copy className="h-4 w-4 mr-2" />
                        Copy Error Details
                    </Button>
                    <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto order-1 sm:order-2">
                        <Button 
                            variant="ghost" 
                            className="w-full sm:w-auto"
                            onClick={() => setErrorState(prev => ({ ...prev, isOpen: false }))}
                        >
                            Tutup
                        </Button>
                        <Button 
                            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700"
                            onClick={() => {
                                setErrorState(prev => ({ ...prev, isOpen: false }));
                                handleSubmit(); // Retry logic
                            }}
                        >
                            <RotateCcw className="h-4 w-4 mr-2" />
                            Retry Submission
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </>
  );
};

export default TherapistScheduleForm;