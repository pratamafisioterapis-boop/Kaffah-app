import React, { useState, useEffect } from 'react';
import {
  Plus, Edit2, Trash2, Save, Target,
  Loader2, CheckCircle, CalendarDays, ArrowRightCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  getActivePhysiotherapists,
  getAllTherapistTargets,
  createTherapistTarget,
  updateTherapistTarget,
  deleteTherapistTarget,
  getOperationalOptions,
  getTherapistTargetProgress,
  getTherapistSchedules,
  getTherapistTimeOff
} from '@/lib/api';
import { format, addDays } from 'date-fns';
import { getTherapistPeriodRange, calculateMaxPatientCapacity, calculateNextPeriodTarget } from '@/lib/utils';
import SearchableSelect from '@/components/ui/searchable-select';

const TherapistTargetManager = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [targets, setTargets] = useState([]);
  const [therapists, setTherapists] = useState([]);
  const [patientTypes, setPatientTypes] = useState([]);
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTarget, setEditingTarget] = useState(null);
  const [saving, setSaving] = useState(false);
  const [generatingId, setGeneratingId] = useState(null);

  const [formData, setFormData] = useState({
    therapist_id: '',
    start_date: '',
    end_date: '',
    target_visits: '',
    excluded_patient_types: []
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [targetsRes, therapistsRes, typesRes] = await Promise.all([
        getAllTherapistTargets(),
        getActivePhysiotherapists(),
        getOperationalOptions('patient_type')
      ]);
      
      let enrichedTargets = [];
      if (targetsRes.data) {
        // Fetch progress for each target
        enrichedTargets = await Promise.all(targetsRes.data.map(async (target) => {
          try {
              const { data: progress } = await getTherapistTargetProgress(target.therapist_id, target.start_date, target.end_date);
              if (progress) {
                  return { ...target, ...progress };
              }
          } catch (err) {
              console.error("Failed to fetch progress for target", target.id, err);
          }
          return target;
        }));
      }

      setTargets(enrichedTargets);
      if (therapistsRes.data) setTherapists(therapistsRes.data);
      if (typesRes.data) setPatientTypes(typesRes.data);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({ variant: "destructive", title: "Error", description: "Gagal memuat data." });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (target = null) => {
    if (target) {
      setEditingTarget(target);
      setFormData({
        therapist_id: target.therapist_id,
        start_date: target.start_date || '',
        end_date: target.end_date || '',
        target_visits: target.target_visits || target.target_sessions || 0,
        excluded_patient_types: Array.isArray(target.excluded_patient_types) ? target.excluded_patient_types : []
      });
    } else {
      setEditingTarget(null);
      // Default periode klinik (belum ada terapis terpilih); dihitung ulang
      // otomatis begitu terapis dipilih di bawah, mengikuti Periode kartu terapisnya.
      const { startDate, endDate } = getTherapistPeriodRange(null);

      setFormData({
        therapist_id: '',
        start_date: format(startDate, 'yyyy-MM-dd'),
        end_date: format(endDate, 'yyyy-MM-dd'),
        target_visits: '',
        excluded_patient_types: ['FREE', 'KONSULTASI', 'HOMECARE', 'XTRATIME']
      });
    }
    setIsDialogOpen(true);
  };

  const handleSelectTherapist = (therapist) => {
    setFormData(prev => {
      const next = { ...prev, therapist_id: therapist.id };
      // Auto-isi periode dari kartu terapis saat membuat target baru (bukan saat edit),
      // supaya periode tidak perlu diketik manual lagi di sini.
      if (!editingTarget) {
        const { startDate, endDate } = getTherapistPeriodRange(therapist);
        next.start_date = format(startDate, 'yyyy-MM-dd');
        next.end_date = format(endDate, 'yyyy-MM-dd');
      }
      return next;
    });
  };

  const validateForm = () => {
    if (!formData.therapist_id) return "Pilih terapis terlebih dahulu.";
    if (!formData.start_date || !formData.end_date) return "Tentukan periode tanggal mulai dan selesai.";
    if (new Date(formData.start_date) > new Date(formData.end_date)) return "Tanggal mulai tidak boleh melebihi tanggal selesai.";
    
    const visits = parseInt(formData.target_visits);
    if (isNaN(visits) || visits <= 0) return "Target kunjungan harus angka positif.";
    
    return null;
  };

  const handleSave = async () => {
    // Add console log for debugging as requested
    console.log('Creating target with therapist_id:', formData.therapist_id);

    const errorMsg = validateForm();
    if (errorMsg) {
      toast({ variant: "destructive", title: "Validasi Gagal", description: errorMsg });
      return;
    }

    setSaving(true);
    
    const payload = {
      therapist_id: formData.therapist_id,
      start_date: formData.start_date,
      end_date: formData.end_date,
      target_visits: parseInt(formData.target_visits),
      excluded_patient_types: formData.excluded_patient_types
    };

    let result;
    if (editingTarget) {
  result = await updateTherapistTarget(editingTarget.id, payload);
} else {
  result = await createTherapistTarget({
    therapist_id: payload.therapist_id,
    start_date: payload.start_date,
    end_date: payload.end_date,
    target_visits: payload.target_visits,
    excluded_patient_types: payload.excluded_patient_types,
    clinic_id: null
  });
}

    if (result.error) {
      toast({ variant: "destructive", title: "Gagal Menyimpan", description: result.error.message });
    } else {
      toast({ title: "Berhasil", description: "Target terapis telah disimpan." });
      fetchData();
      setIsDialogOpen(false);
    }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Yakin ingin menghapus target ini?")) return;
    const { error } = await deleteTherapistTarget(id);
    if (!error) {
      toast({ title: "Terhapus", description: "Data target dihapus." });
      fetchData();
    } else {
      toast({ variant: "destructive", title: "Gagal", description: error.message });
    }
  };

  // Cari apakah target periode berikutnya (mulai tepat 1 hari setelah
  // item.end_date, untuk terapis yg sama) sudah pernah dibuat.
  const nextTargetExists = (item) => {
    const nextStartStr = format(addDays(new Date(item.end_date), 1), 'yyyy-MM-dd');
    return targets.some(t => t.therapist_id === item.therapist_id && t.start_date === nextStartStr);
  };

  // Target periode berikutnya = target sekarang + 2% dari kapasitas maksimal
  // pasien periode ini (jam kerja x 5 pasien/hari) kalau target periode ini
  // tercapai; kalau belum tercapai, target periode berikutnya disamakan
  // dengan target periode ini (tidak naik).
  const handleGenerateNextTarget = async (item) => {
    setGeneratingId(item.id);
    try {
      const therapist = therapists.find(t => t.id === item.therapist_id) || null;
      const [schedRes, timeOffRes] = await Promise.all([
        getTherapistSchedules(item.therapist_id),
        getTherapistTimeOff(item.therapist_id),
      ]);

      const maxCapacity = calculateMaxPatientCapacity(
        schedRes.data || [], timeOffRes.data || [], item.start_date, item.end_date
      );
      const achieved = (item.actual_visits || 0) >= (item.target_visits || 0) && (item.target_visits || 0) > 0;
      const nextTargetVisits = calculateNextPeriodTarget({
        previousTarget: item.target_visits || 0,
        achieved,
        maxCapacity,
      });

      const nextStart = addDays(new Date(item.end_date), 1);
      const { startDate, endDate } = getTherapistPeriodRange(therapist, nextStart);

      const { error } = await createTherapistTarget({
        therapist_id: item.therapist_id,
        start_date: format(startDate, 'yyyy-MM-dd'),
        end_date: format(endDate, 'yyyy-MM-dd'),
        target_visits: nextTargetVisits,
        excluded_patient_types: item.excluded_patient_types || [],
        clinic_id: null,
      });
      if (error) throw error;

      toast({
        title: 'Target Periode Berikutnya Dibuat',
        description: achieved
          ? `Target naik jadi ${nextTargetVisits} kunjungan (+2% x kapasitas maksimal ${maxCapacity} pasien, karena target periode ini tercapai).`
          : `Target disamakan jadi ${nextTargetVisits} kunjungan (target periode ini belum tercapai).`,
      });
      fetchData();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Gagal Membuat Target', description: err.message });
    } finally {
      setGeneratingId(null);
    }
  };

  const handlePatientTypeToggle = (typeLabel) => {
    setFormData(prev => {
      const current = prev.excluded_patient_types || [];
      if (current.includes(typeLabel)) {
        return { ...prev, excluded_patient_types: current.filter(t => t !== typeLabel) };
      } else {
        return { ...prev, excluded_patient_types: [...current, typeLabel] };
      }
    });
  };

  const getTherapistName = (therapistId) => {
  const t = therapists.find(p => p.id === therapistId);
  return t ? t.name : 'Unknown / Deleted Therapist';
};

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    try {
      return format(new Date(dateString), 'dd-MM-yyyy');
    } catch (e) {
      return '-';
    }
  };

  const getStatusBadge = (status) => {
    let colorClass = "bg-slate-100 text-slate-800 border-slate-200"; // Default Gray
    
    if (status === 'TERCAPAI') {
      colorClass = "bg-emerald-100 text-emerald-800 border-emerald-200";
    } else if (status === 'BELUM TERCAPAI') {
      colorClass = "bg-amber-100 text-amber-800 border-amber-200";
    } else if (status === 'PERLU EVALUASI') {
      colorClass = "bg-rose-100 text-rose-800 border-rose-200";
    }

    return (
      <Badge variant="outline" className={`${colorClass} whitespace-nowrap`}>
        {status || 'Belum dihitung'}
      </Badge>
    );
  };

  // Updated to use user_id as value
  const therapistOptions = therapists.map(t => ({
   value: t.id,
   label: t.name
}));

  const getInitials = (name) => {
    if (!name) return 'TH';
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
           <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
             <Target className="w-6 h-6 text-blue-600" /> Target Terapis
           </h2>
           <p className="text-slate-500">Atur target kunjungan terapis berdasarkan periode.</p>
        </div>
        <Button onClick={() => handleOpenDialog()} className="bg-blue-600 hover:bg-blue-700">
           <Plus className="w-4 h-4 mr-2" /> Tambah Target
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin text-slate-300" /></div>
      ) : targets.length === 0 ? (
        <div className="bg-white border rounded-xl shadow-sm text-center py-12">
          <div className="flex flex-col items-center justify-center text-slate-500">
            <p className="font-medium">Belum ada target terapis</p>
            <p className="text-sm mt-1">Klik 'Tambah Target' untuk membuat target baru</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {targets.map((item) => {
            const therapistName = item.user?.full_name || getTherapistName(item.therapist_id);
            const pct = item.achievement_percentage ?? (item.target_visits ? Math.round(((item.actual_visits || 0) / item.target_visits) * 100) : 0);
            const accent = item.status === 'TERCAPAI'
              ? 'from-emerald-400 to-teal-500'
              : item.status === 'BELUM TERCAPAI'
                ? 'from-amber-400 to-orange-500'
                : item.status === 'PERLU EVALUASI'
                  ? 'from-rose-400 to-red-500'
                  : 'from-slate-300 to-slate-400';

            return (
              <div key={item.id} className="card-premium relative overflow-hidden border-0 ring-1 ring-slate-100 group">
                <div className={`absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b ${accent}`} />
                <div className="p-5 pl-6">
                  <div className="flex items-start justify-between gap-2 mb-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-md">
                        {getInitials(therapistName)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 truncate" title={therapistName}>{therapistName}</p>
                        <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5 min-w-0">
                          <CalendarDays className="w-3 h-3 shrink-0" />
                          <span className="truncate">
                            {item.start_date && item.end_date ? `${formatDate(item.start_date)} s/d ${formatDate(item.end_date)}` : '-'}
                          </span>
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleOpenDialog(item)}>
                        <Edit2 className="w-3.5 h-3.5 text-slate-500 hover:text-blue-600" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDelete(item.id)}>
                        <Trash2 className="w-3.5 h-3.5 text-slate-500 hover:text-red-600" />
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-end justify-between mb-2 gap-2">
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Capaian</p>
                      <p className="text-2xl font-bold text-slate-900 truncate">
                        {item.actual_visits || 0}
                        <span className="text-sm font-medium text-slate-400"> / {item.target_visits || 0}</span>
                      </p>
                    </div>
                    <div className="shrink-0">{getStatusBadge(item.status)}</div>
                  </div>

                  <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden mb-3">
                    <div className={`h-full rounded-full bg-gradient-to-r ${accent}`} style={{ width: `${Math.min(Math.max(pct, 0), 100)}%` }} />
                  </div>

                  {item.excluded_patient_types && item.excluded_patient_types.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-3 border-t border-slate-100">
                      {item.excluded_patient_types.slice(0, 3).map((type, idx) => (
                        <Badge key={idx} variant="outline" className="text-[10px] bg-slate-50 font-normal">
                          {type}
                        </Badge>
                      ))}
                      {item.excluded_patient_types.length > 3 && (
                        <Badge variant="outline" className="text-[10px] bg-slate-50 font-normal">+{item.excluded_patient_types.length - 3}</Badge>
                      )}
                    </div>
                  )}

                  {item.end_date && new Date(item.end_date) < new Date() && (
                    nextTargetExists(item) ? (
                      <p className="text-[10px] text-slate-400 pt-3 mt-1 border-t border-slate-100 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3 text-emerald-500" /> Target periode berikutnya sudah dibuat
                      </p>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={generatingId === item.id}
                        onClick={() => handleGenerateNextTarget(item)}
                        className="w-full mt-3 h-8 text-xs border-blue-200 text-blue-700 hover:bg-blue-50"
                      >
                        {generatingId === item.id
                          ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                          : <ArrowRightCircle className="w-3.5 h-3.5 mr-1.5" />}
                        Buat Target Periode Berikutnya
                      </Button>
                    )
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle>{editingTarget ? 'Edit Target' : 'Buat Target Baru'}</DialogTitle>
            <DialogDescription>
              Tentukan target kunjungan untuk terapis dalam periode tertentu.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Terapis</label>
                <div className={`grid grid-cols-3 sm:grid-cols-4 gap-2 p-2 border rounded-md bg-slate-50 max-h-48 overflow-y-auto ${editingTarget ? 'opacity-60 pointer-events-none' : ''}`}>
                  {therapists.map((t) => {
                    const isActive = formData.therapist_id === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => handleSelectTherapist(t)}
                        className={`flex flex-col items-center gap-1.5 p-2.5 rounded-lg border transition-all text-center ${
                          isActive
                            ? 'border-blue-500 bg-blue-50 shadow-sm ring-1 ring-blue-200'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                      >
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs ${
                          isActive ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'
                        }`}>
                          {getInitials(t.name)}
                        </div>
                        <span className="text-xs font-medium text-slate-700 truncate w-full">{t.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-2">
                   <label className="text-sm font-medium">Tanggal Mulai</label>
                   <Input 
                      type="date" 
                      value={formData.start_date} 
                      onChange={(e) => setFormData({...formData, start_date: e.target.value})} 
                   />
                 </div>
                 <div className="space-y-2">
                   <label className="text-sm font-medium">Tanggal Selesai</label>
                   <Input 
                      type="date" 
                      value={formData.end_date} 
                      onChange={(e) => setFormData({...formData, end_date: e.target.value})} 
                   />
                 </div>
              </div>
            </div>

            <div className="space-y-2">
               <label className="text-sm font-medium text-slate-700">Exclude Tipe Pasien (Tidak Dihitung)</label>
               <div className="p-3 border rounded-md max-h-40 overflow-y-auto bg-slate-50">
                 {patientTypes.length === 0 ? (
                   <p className="text-xs text-slate-400 italic">Tidak ada tipe pasien tersedia.</p>
                 ) : (
                   <div className="grid grid-cols-2 gap-2">
                     {patientTypes.map((type) => (
                       <div key={type.id} className="flex items-center space-x-2">
                         <Checkbox 
                           id={`type-${type.id}`} 
                           checked={formData.excluded_patient_types.includes(type.label)}
                           onCheckedChange={() => handlePatientTypeToggle(type.label)}
                         />
                         <Label 
                           htmlFor={`type-${type.id}`} 
                           className="text-xs font-normal cursor-pointer text-slate-700"
                         >
                           {type.label}
                         </Label>
                       </div>
                     ))}
                   </div>
                 )}
               </div>
               <p className="text-[10px] text-slate-500">
                  Pilih tipe pasien yang <strong>tidak akan dihitung</strong> dalam pencapaian target.
               </p>
            </div>

            <div className="space-y-4 pt-2 border-t mt-2">
               <h4 className="text-sm font-semibold flex items-center gap-2">
                 <CheckCircle className="w-4 h-4 text-green-600" /> Target Pencapaian
               </h4>
               <div className="grid grid-cols-1 gap-4">
                 <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Target Kunjungan</label>
                    <Input 
                      type="number" min="0" 
                      value={formData.target_visits} 
                      onChange={(e) => setFormData({...formData, target_visits: e.target.value})}
                      className="font-semibold text-center text-lg h-12"
                      placeholder="0"
                    />
                    <p className="text-[10px] text-slate-500 text-center">Total sesi/visit</p>
                 </div>
               </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Batal</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-blue-600">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />} Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TherapistTargetManager;