import React, { useState, useEffect, useMemo } from 'react';
import { 
  User, Trash2, CalendarClock, Copy, ClipboardPaste, 
  Check, Loader2, AlertTriangle, ArrowRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, 
  DialogDescription, DialogFooter 
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { 
  getPhysiotherapists, 
  getTherapistSchedules, 
  createTherapistSchedule,
  deleteTherapistSchedule 
} from '@/lib/api';
import { calculateDurationMinutes, cn } from '@/lib/utils';
import SearchableSelect from '@/components/ui/searchable-select';
import TherapistScheduleForm from './TherapistScheduleForm';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

const DAYS = [
  { value: 1, label: 'Senin', color: 'from-blue-500 to-blue-600', badgeColor: 'bg-blue-100 text-blue-800' },
  { value: 2, label: 'Selasa', color: 'from-indigo-500 to-indigo-600', badgeColor: 'bg-indigo-100 text-indigo-800' },
  { value: 3, label: 'Rabu', color: 'from-purple-500 to-purple-600', badgeColor: 'bg-purple-100 text-purple-800' },
  { value: 4, label: 'Kamis', color: 'from-pink-500 to-pink-600', badgeColor: 'bg-pink-100 text-pink-800' },
  { value: 5, label: 'Jumat', color: 'from-rose-500 to-rose-600', badgeColor: 'bg-rose-100 text-rose-800' },
  { value: 6, label: 'Sabtu', color: 'from-orange-500 to-orange-600', badgeColor: 'bg-orange-100 text-orange-800' },
  { value: 0, label: 'Minggu', color: 'from-red-500 to-red-600', badgeColor: 'bg-red-100 text-red-800' },
];

const TherapistScheduleManager = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [pasteLoading, setPasteLoading] = useState(false);
  const [therapists, setTherapists] = useState([]);
  const [selectedTherapist, setSelectedTherapist] = useState(null);
  const [schedules, setSchedules] = useState([]);
  
  // Copy-Paste State
  const [copiedSchedule, setCopiedSchedule] = useState(null); // { dayValue, slots: [] }
  const [copiedDayName, setCopiedDayName] = useState("");
  const [copiedSlotCount, setCopiedSlotCount] = useState(0);

  // Dialog States
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [scheduleToDelete, setScheduleToDelete] = useState(null);
  
  const [pasteConfirmOpen, setPasteConfirmOpen] = useState(false);
  const [pasteConfig, setPasteConfig] = useState(null); // { targetDays: [], label: '' }

  useEffect(() => {
    loadTherapists();
  }, []);

  useEffect(() => {
    if (selectedTherapist) {
      loadSchedules(selectedTherapist.id);
      // Reset copy state when changing therapist
      setCopiedSchedule(null);
      setCopiedDayName("");
      setCopiedSlotCount(0);
    } else {
      setSchedules([]);
    }
  }, [selectedTherapist]);

  const loadTherapists = async () => {
    const { data } = await getPhysiotherapists();
    if (data) setTherapists(data);
  };

  const loadSchedules = async (therapistId) => {
    setLoading(true);
    const { data } = await getTherapistSchedules(therapistId);
    if (data) {
        console.log("[TherapistScheduleManager] Loaded schedules:", data);
        setSchedules(data);
    }
    setLoading(false);
  };

  // Group schedules by day for easier rendering
  const schedulesByDay = useMemo(() => {
    const grouped = {};
    DAYS.forEach(d => grouped[d.value] = []);
    schedules.forEach(s => {
      // Ensure day_of_week is treated as integer
      const dayVal = parseInt(s.day_of_week, 10);
      
      if (grouped[dayVal]) {
        grouped[dayVal].push(s);
      } else {
        // Handle edge case if day_of_week isn't in DAYS map or initialize if not present
        if (!grouped[dayVal]) grouped[dayVal] = [];
        grouped[dayVal].push(s);
      }
    });
    // Sort slots by start time
    Object.keys(grouped).forEach(key => {
        grouped[key].sort((a, b) => a.start_time.localeCompare(b.start_time));
    });
    return grouped;
  }, [schedules]);

  // --- COPY LOGIC ---
  const handleCopySchedule = (dayValue) => {
    const slots = schedulesByDay[dayValue] || [];
    if (slots.length === 0) {
        toast({ title: "Tidak ada jadwal", description: "Hari ini kosong, tidak ada yang bisa disalin.", variant: "destructive" });
        return;
    }

    const dayName = DAYS.find(d => d.value === dayValue)?.label;
    
    // Store simple slot objects
    setCopiedSchedule({
        dayValue,
        slots: slots.map(s => ({ start_time: s.start_time, end_time: s.end_time }))
    });
    setCopiedDayName(dayName);
    setCopiedSlotCount(slots.length);

    toast({ 
        title: "Jadwal Disalin", 
        description: `Jadwal ${dayName} berhasil disalin (${slots.length} slot).`,
        className: "bg-blue-50 border-blue-200"
    });
  };

  // --- PASTE LOGIC SETUP ---
  const initiatePaste = (targetDays, label) => {
    if (!copiedSchedule || !selectedTherapist) return;

    // Check for existing slots in target days
    const conflictingDays = targetDays.filter(dayVal => {
        const existing = schedulesByDay[dayVal];
        return existing && existing.length > 0;
    });

    const config = { targetDays, label, conflictingDays };
    setPasteConfig(config);

    if (conflictingDays.length > 0) {
        setPasteConfirmOpen(true);
    } else {
        // No conflict, proceed directly
        executePaste(config);
    }
  };

  const handlePasteToDay = (dayValue) => {
    const dayName = DAYS.find(d => d.value === dayValue)?.label;
    initiatePaste([dayValue], `Hari ${dayName}`);
  };

  const handlePasteToWorkDays = () => {
    // Senin (1) to Jumat (5)
    initiatePaste([1, 2, 3, 4, 5], "Hari Kerja (Senin-Jumat)");
  };

  const handlePasteToAllDays = () => {
    // Senin (1) to Minggu (0)
    initiatePaste([1, 2, 3, 4, 5, 6, 0], "Semua Hari (Senin-Minggu)");
  };

  // --- PASTE EXECUTION ---
  const executePaste = async (config) => {
    setPasteConfirmOpen(false);
    setPasteLoading(true);

    try {
        const { targetDays } = config;

        // 1. Delete existing schedules for target days
        const deletePromises = [];
        targetDays.forEach(dayVal => {
            const existing = schedulesByDay[dayVal] || [];
            existing.forEach(s => {
                deletePromises.push(deleteTherapistSchedule(s.id));
            });
        });

        if (deletePromises.length > 0) {
            await Promise.all(deletePromises);
        }

        // 2. Create new schedules
        const createPromises = [];
        targetDays.forEach(dayVal => {
            copiedSchedule.slots.forEach(slot => {
                const payload = {
                    therapist_id: selectedTherapist.id,
                    clinic_id: selectedTherapist.clinic_id,
                    day_of_week: dayVal,
                    start_time: slot.start_time,
                    end_time: slot.end_time,
                    is_active: true
                };
                console.log("[TherapistScheduleManager] Pasting schedule:", payload);
                createPromises.push(createTherapistSchedule(payload));
            });
        });

        await Promise.all(createPromises);

        toast({
            title: "Paste Berhasil",
            description: `Jadwal berhasil diterapkan ke ${config.label}.`,
            className: "bg-green-50 border-green-200"
        });

        // Reset copy state
        setCopiedSchedule(null);
        setCopiedDayName("");
        setCopiedSlotCount(0);
        
        // Refresh data
        loadSchedules(selectedTherapist.id);

    } catch (error) {
        console.error(error);
        toast({
            title: "Gagal Paste",
            description: "Terjadi kesalahan saat menyimpan jadwal.",
            variant: "destructive"
        });
    } finally {
        setPasteLoading(false);
    }
  };


  // --- DELETE INDIVIDUAL SLOT ---
  const confirmDelete = (id) => {
    setScheduleToDelete(id);
    setDeleteDialogOpen(true);
  };

  const executeDelete = async () => {
    if (!scheduleToDelete) return;
    
    const { error } = await deleteTherapistSchedule(scheduleToDelete);
    if (!error) {
      toast({ title: "Jadwal Dihapus" });
      loadSchedules(selectedTherapist.id);
    }
    setDeleteDialogOpen(false);
    setScheduleToDelete(null);
  };

  const therapistOptions = therapists.map(t => ({
    value: t.id,
    label: t.name
  }));

  const handleFormSuccess = (newData) => {
    console.log("[TherapistScheduleManager] Form success, new data:", newData);
    setIsFormOpen(false);
    loadSchedules(selectedTherapist.id);
  };

  const getInitials = (name) => {
    if (!name) return "TH";
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm sticky top-0 z-10">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <CalendarClock className="w-5 h-5 text-blue-600" />
            Manajemen Jadwal
          </h2>
          <p className="text-sm text-slate-500">Pilih terapis untuk melihat dan mengatur jadwal</p>
        </div>
        <div className="w-full sm:w-[300px]">
          <SearchableSelect 
             options={therapistOptions}
             value={selectedTherapist?.id}
             onChange={(val) => setSelectedTherapist(therapists.find(t => t.id === val))}
             placeholder="Cari Terapis..."
          />
        </div>
      </div>

      {!selectedTherapist ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400 bg-slate-50/50 border-2 border-dashed border-slate-200 rounded-xl">
          <User className="w-16 h-16 mb-4 opacity-30" />
          <p className="font-medium">Silakan pilih terapis terlebih dahulu</p>
        </div>
      ) : (
        <div className="grid lg:grid-cols-12 gap-8">
          {/* Create Form Section - Left Side */}
          <div className="lg:col-span-4 space-y-4">
             <TherapistScheduleForm 
                therapist={selectedTherapist}
                existingSchedules={schedules}
                onSuccess={handleFormSuccess}
                onCancel={() => setIsFormOpen(false)}
             />

             {/* Global Paste Actions */}
             <Card className="border-slate-200 shadow-sm bg-slate-50/50">
                <CardHeader className="pb-3">
                    <CardTitle className="text-base font-medium flex items-center gap-2">
                        <ClipboardPaste className="w-4 h-4" /> 
                        Aksi Bulk Paste
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="text-sm text-slate-500 mb-2">
                        {copiedSchedule ? (
                            <div className="p-3 bg-blue-100 border border-blue-200 rounded-lg text-blue-800 flex items-start gap-2">
                                <Copy className="w-4 h-4 mt-0.5 shrink-0" />
                                <div>
                                    <p className="font-semibold">Menyalin: {copiedDayName}</p>
                                    <p className="text-xs opacity-90">{copiedSlotCount} Slot tersimpan</p>
                                </div>
                            </div>
                        ) : (
                            <div className="p-3 bg-slate-100 border border-slate-200 rounded-lg text-slate-500 text-xs italic">
                                Belum ada jadwal yang disalin. Klik tombol "Copy" pada salah satu hari.
                            </div>
                        )}
                    </div>
                    
                    <div className="grid grid-cols-1 gap-2">
                        <Button 
                            variant="outline" 
                            className="justify-start border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                            disabled={!copiedSchedule || pasteLoading}
                            onClick={handlePasteToWorkDays}
                        >
                            {pasteLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ClipboardPaste className="w-4 h-4 mr-2" />}
                            Paste ke Hari Kerja (Senin-Jumat)
                        </Button>
                        <Button 
                            variant="outline" 
                            className="justify-start border-orange-200 hover:bg-orange-50 hover:text-orange-700"
                            disabled={!copiedSchedule || pasteLoading}
                            onClick={handlePasteToAllDays}
                        >
                            {pasteLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ClipboardPaste className="w-4 h-4 mr-2" />}
                            Paste ke Semua Hari (Senin-Minggu)
                        </Button>
                    </div>
                </CardContent>
             </Card>
          </div>

          {/* Schedule Grid Section - Right Side */}
          <div className="lg:col-span-8">
             <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10 border-2 border-white shadow-md ring-2 ring-blue-100">
                    <AvatarFallback className="bg-gradient-to-br from-blue-500 to-blue-700 text-white font-bold">
                      {getInitials(selectedTherapist.name)}
                    </AvatarFallback>
                  </Avatar>
                  <h3 className="text-lg font-bold text-slate-900">{selectedTherapist.name}</h3>
                </div>
                <Badge variant="secondary" className="bg-blue-50 text-blue-700 font-semibold px-3 py-1">
                  Total {schedules.length} Slot
                </Badge>
             </div>

             {loading ? (
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {[1,2,3,4,5,6].map(i => <div key={i} className="h-48 bg-slate-100 rounded-xl animate-pulse" />)}
                </div>
             ) : (
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {DAYS.map((day) => {
                        const daySlots = schedulesByDay[day.value] || [];
                        const isCopiedSource = copiedSchedule?.dayValue === day.value;
                        const hasSlots = daySlots.length > 0;

                        return (
                            <Card 
                                key={day.value} 
                                className={cn(
                                    "relative transition-all duration-300 overflow-hidden bg-white hover:shadow-2xl hover:-translate-y-1 group",
                                    isCopiedSource ? "border-2 border-blue-500 ring-4 ring-blue-100/50" : "border-slate-200"
                                )}
                            >
                                <div className={cn(
                                    "absolute top-0 left-0 w-full h-1.5 transition-all duration-300",
                                    hasSlots ? `bg-gradient-to-r ${day.color}` : 'bg-slate-200'
                                )} />
                                
                                <CardHeader className="p-6 pb-4 flex flex-row items-center justify-between space-y-0">
                                    <div className="flex items-center gap-2">
                                        <Badge className={cn("px-3 py-1 text-sm shadow-sm", day.badgeColor, !hasSlots && "opacity-60 grayscale")}>
                                            {day.label}
                                        </Badge>
                                        {hasSlots && <span className="text-xs text-slate-400 font-medium">{daySlots.length} slot</span>}
                                    </div>
                                    
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            className="h-8 w-8 text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors rounded-full"
                                            onClick={() => handleCopySchedule(day.value)}
                                            disabled={!hasSlots}
                                            title="Copy Jadwal"
                                        >
                                            <Copy className="w-4 h-4" />
                                        </Button>
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            className="h-8 w-8 text-slate-400 hover:text-green-600 hover:bg-green-50 transition-colors rounded-full"
                                            onClick={() => handlePasteToDay(day.value)}
                                            disabled={!copiedSchedule || pasteLoading}
                                            title="Paste Jadwal"
                                        >
                                            <ClipboardPaste className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </CardHeader>
                                
                                <CardContent className="p-6 pt-0">
                                    {isCopiedSource && (
                                        <div className="mb-4 inline-flex items-center text-[10px] font-bold uppercase tracking-wider text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
                                            Jadwal Disalin
                                        </div>
                                    )}

                                    {hasSlots ? (
                                        <div className="flex flex-wrap gap-2">
                                            {daySlots.map((slot) => (
                                                <div 
                                                    key={slot.id} 
                                                    className="group/slot flex items-center justify-between bg-slate-50 border border-slate-200 rounded-full px-4 py-2 shadow-sm text-sm hover:scale-105 hover:bg-white hover:border-slate-300 transition-all duration-300 cursor-default"
                                                >
                                                    <span className="font-semibold text-slate-700 tracking-tight">
                                                        {slot.start_time.slice(0,5)} - {slot.end_time.slice(0,5)}
                                                    </span>
                                                    <Button 
                                                        variant="ghost" 
                                                        size="icon" 
                                                        className="h-5 w-5 ml-2 text-slate-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover/slot:opacity-100 transition-opacity rounded-full"
                                                        onClick={() => confirmDelete(slot.id)}
                                                    >
                                                        <Trash2 className="w-3 h-3" />
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="py-8 flex flex-col items-center justify-center text-center text-slate-400 border-2 border-dashed border-slate-100 rounded-xl bg-slate-50/50">
                                            <CalendarClock className="w-8 h-8 mb-2 opacity-20" />
                                            <span className="text-xs font-medium">Kosong</span>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
             )}
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus Jadwal?</DialogTitle>
            <DialogDescription>
              Tindakan ini akan menghapus jadwal secara permanen.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Batal</Button>
            <Button variant="destructive" onClick={executeDelete}>Hapus Permanen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PASTE CONFIRMATION */}
      <Dialog open={pasteConfirmOpen} onOpenChange={setPasteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
                <AlertTriangle className="w-5 h-5" />
                Konfirmasi Timpa Jadwal
            </DialogTitle>
            <DialogDescription className="space-y-3 pt-2">
                <p>
                    Anda akan menerapkan jadwal dari <strong>{copiedDayName}</strong> ke <strong>{pasteConfig?.label}</strong>.
                </p>
                {pasteConfig?.conflictingDays?.length > 0 && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded text-amber-800 text-sm">
                        <p className="font-semibold mb-1">Perhatian:</p>
                        <p>Beberapa hari target sudah memiliki jadwal:</p>
                        <ul className="list-disc list-inside mt-1 ml-1 text-xs opacity-90">
                            {pasteConfig.conflictingDays.map(dVal => {
                                const dName = DAYS.find(d => d.value === dVal)?.label;
                                const count = schedulesByDay[dVal]?.length || 0;
                                return <li key={dVal}>{dName} ({count} slot akan dihapus)</li>;
                            })}
                        </ul>
                    </div>
                )}
                <p className="font-medium text-slate-700">
                    Jadwal lama pada hari-hari tersebut akan dihapus dan digantikan dengan jadwal baru. Lanjutkan?
                </p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setPasteConfirmOpen(false)}>Batal</Button>
            <Button 
                onClick={() => executePaste(pasteConfig)} 
                className="bg-amber-600 hover:bg-amber-700 text-white"
            >
                {pasteLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ArrowRight className="w-4 h-4 mr-2" />}
                Ya, Timpa Jadwal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TherapistScheduleManager;