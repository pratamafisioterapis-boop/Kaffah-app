import React, { useState, useEffect } from 'react';
import { 
  Plus, Edit2, Trash2, Save, Target, 
  Loader2, CheckCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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
  getTherapistTargetProgress
} from '@/lib/api';
import { format } from 'date-fns';
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
      const now = new Date();
      let startPeriod, endPeriod;
      if (now.getDate() >= 28) {
        startPeriod = new Date(now.getFullYear(), now.getMonth(), 28);
        endPeriod = new Date(now.getFullYear(), now.getMonth() + 1, 27);
      } else {
        startPeriod = new Date(now.getFullYear(), now.getMonth() - 1, 28);
        endPeriod = new Date(now.getFullYear(), now.getMonth(), 27);
      }

      setFormData({
        therapist_id: '',
        start_date: format(startPeriod, 'yyyy-MM-dd'),
        end_date: format(endPeriod, 'yyyy-MM-dd'),
        target_visits: '',
        excluded_patient_types: ['FREE', 'KONSULTASI', 'HOMECARE', 'XTRATIME']
      });
    }
    setIsDialogOpen(true);
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

      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50 hover:bg-slate-50">
              <TableHead>Periode</TableHead>
              <TableHead>Terapis</TableHead>
              <TableHead className="text-center">Target Kunjungan</TableHead>
              <TableHead className="text-center">Capaian</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead>Excluded Types</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8"><Loader2 className="animate-spin mx-auto" /></TableCell></TableRow>
            ) : targets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12">
                  <div className="flex flex-col items-center justify-center text-slate-500">
                    <p className="font-medium">Belum ada target terapis</p>
                    <p className="text-sm mt-1">Klik 'Tambah Target' untuk membuat target baru</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              targets.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium text-sm">
                     {item.start_date && item.end_date 
                       ? `${formatDate(item.start_date)} s/d ${formatDate(item.end_date)}` 
                       : '-'}
                  </TableCell>
                  <TableCell>
                    {/* Updated to try user.full_name first (from new API join) or fallback to helper */}
                    {item.user?.full_name || getTherapistName(item.therapist_id)}
                  </TableCell>
                  <TableCell className="text-center font-semibold text-blue-600">
                    {item.target_visits || 0}
                  </TableCell>
                  <TableCell className="text-center font-medium">
                    {item.actual_visits !== undefined && item.achievement_percentage !== undefined 
                      ? `${item.actual_visits} (${item.achievement_percentage}%)` 
                      : (item.actual_visits || 0)}
                  </TableCell>
                  <TableCell className="text-center">
                    {getStatusBadge(item.status)}
                  </TableCell>
                  <TableCell>
                     {item.excluded_patient_types && item.excluded_patient_types.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {item.excluded_patient_types.slice(0, 2).map((type, idx) => (
                            <Badge key={idx} variant="outline" className="text-[10px] bg-slate-50">
                              {type}
                            </Badge>
                          ))}
                          {item.excluded_patient_types.length > 2 && (
                            <Badge variant="outline" className="text-[10px] bg-slate-50">+{item.excluded_patient_types.length - 2}</Badge>
                          )}
                        </div>
                     ) : (
                       <span className="text-slate-400 text-xs">-</span>
                     )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" onClick={() => handleOpenDialog(item)}>
                        <Edit2 className="w-4 h-4 text-slate-500 hover:text-blue-600" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => handleDelete(item.id)}>
                        <Trash2 className="w-4 h-4 text-slate-500 hover:text-red-600" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

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
                <SearchableSelect 
                   options={therapistOptions}
                   value={formData.therapist_id}
                   onChange={(val) => setFormData({...formData, therapist_id: val})}
                   disabled={!!editingTarget}
                   placeholder="Pilih Terapis (Ketik untuk mencari)..."
                />
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