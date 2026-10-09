import React, { useState, useEffect } from 'react';
import { 
    getAllTherapistTargets,
    getCurrentClinic, 
    getAllPhysiotherapists,
    createTherapistTarget,
    updateTherapistTarget,
    deleteTherapistTarget,
    getTherapistTargetProgress
} from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Plus, Pencil, Trash2, Calendar } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import PageHero from '@/components/shared/PageHero';

const TherapistTargetManagement = () => {
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [targets, setTargets] = useState([]);
    const [therapists, setTherapists] = useState([]);
    const [clinicId, setClinicId] = useState(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [selectedTarget, setSelectedTarget] = useState(null);
    const [formData, setFormData] = useState({
        therapistId: '',
        startDate: '',
        endDate: '',
        targetVisits: '',
        excludedTypes: '' // Changed to string for easier input handling
    });
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        loadInitialData();
    }, []);

    const loadInitialData = async () => {
        setLoading(true);
        try {
            // 1. Get Clinic
            const { data: clinic } = await getCurrentClinic();
            if (!clinic) throw new Error("Clinic not found");
            setClinicId(clinic.id);

            // 2. Get Therapists
            const { data: therapistList } = await getAllPhysiotherapists();
            setTherapists(therapistList || []);

            // 3. Get Targets
            await loadTargets();
            
        } catch (error) {
            console.error("Error loading data:", error);
            toast({ variant: "destructive", title: "Error", description: "Gagal memuat data." });
        } finally {
            setLoading(false);
        }
    };

    // API helpers resolve with { error } instead of throwing; turn that into a throw so the
    // surrounding try/catch shows an error instead of a false "success".
    const unwrap = (result) => {
        if (result?.error) throw result.error;
        return result;
    };

    const loadTargets = async () => {
        const { data, error } = await getAllTherapistTargets();
        if (error) throw error;
        
        // Enrich with progress
        if (data && data.length > 0) {
            const enriched = await Promise.all(data.map(async (t) => {
                // A failed progress lookup should not hide the target itself.
                const { data: progress } = await getTherapistTargetProgress(t.therapist_id, t.start_date, t.end_date);
                return { ...t, progress };
            }));
            setTargets(enriched);
        } else {
            setTargets([]);
        }
    };

    const handleOpenDialog = (target = null) => {
        if (target) {
            setSelectedTarget(target);
            // Convert array to comma-separated string for input
            const excludedString = Array.isArray(target.excluded_patient_types) 
                ? target.excluded_patient_types.join(', ') 
                : '';
                
            setFormData({
                therapistId: target.therapist_id,
                startDate: target.start_date,
                endDate: target.end_date,
                targetVisits: target.target_visits,
                excludedTypes: excludedString
            });
        } else {
            setSelectedTarget(null);
            // Default dates: 28 bulan lalu - 27 bulan ini
            const now = new Date();
            let start, end;
            if (now.getDate() >= 28) {
                start = new Date(now.getFullYear(), now.getMonth(), 28);
                end = new Date(now.getFullYear(), now.getMonth() + 1, 27);
            } else {
                start = new Date(now.getFullYear(), now.getMonth() - 1, 28);
                end = new Date(now.getFullYear(), now.getMonth(), 27);
            }

            setFormData({
                therapistId: '',
                startDate: format(start, 'yyyy-MM-dd'),
                endDate: format(end, 'yyyy-MM-dd'),
                targetVisits: '',
                excludedTypes: ''
            });
        }
        setIsDialogOpen(true);
    };

    const handleDeleteClick = (target) => {
        setSelectedTarget(target);
        setIsDeleteDialogOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!clinicId) return;

        const visits = parseInt(formData.targetVisits, 10);
        if (!selectedTarget && !formData.therapistId) {
            toast({ variant: "destructive", title: "Data belum lengkap", description: "Pilih fisioterapis terlebih dahulu." });
            return;
        }
        if (!Number.isFinite(visits) || visits < 1) {
            toast({ variant: "destructive", title: "Target tidak valid", description: "Target kunjungan minimal 1." });
            return;
        }
        if (formData.startDate > formData.endDate) {
            toast({ variant: "destructive", title: "Periode tidak valid", description: "Tanggal mulai tidak boleh setelah tanggal selesai." });
            return;
        }
        setSubmitting(true);
        
        // Process excluded types from string to array
        const excludedArray = formData.excludedTypes
            .split(',')
            .map(item => item.trim())
            .filter(item => item !== '');

        try {
            if (selectedTarget) {
                unwrap(await updateTherapistTarget(selectedTarget.id, {
                    target_visits: visits,
                    start_date: formData.startDate,
                    end_date: formData.endDate,
                    excluded_patient_types: excludedArray
                }));
                toast({ title: "Berhasil", description: "Target berhasil diperbarui." });
            } else {
                unwrap(await createTherapistTarget({
                    clinic_id: clinicId,
                    therapist_id: formData.therapistId,
                    start_date: formData.startDate,
                    end_date: formData.endDate,
                    target_visits: visits,
                    excluded_patient_types: excludedArray
                }));
                toast({ title: "Berhasil", description: "Target berhasil dibuat." });
            }
            await loadTargets();
            setIsDialogOpen(false);
        } catch (error) {
            console.error(error);
            toast({ variant: "destructive", title: "Gagal", description: error.message || "Gagal menyimpan target." });
        } finally {
            setSubmitting(false);
        }
    };

    const handleConfirmDelete = async () => {
        if (!selectedTarget) return;
        setSubmitting(true);
        try {
            unwrap(await deleteTherapistTarget(selectedTarget.id));
            toast({ title: "Berhasil", description: "Target berhasil dihapus." });
            await loadTargets();
            setIsDeleteDialogOpen(false);
        } catch (error) {
            console.error(error);
            toast({ variant: "destructive", title: "Gagal", description: error.message || "Gagal menghapus target." });
        } finally {
            setSubmitting(false);
        }
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case 'TERCAPAI': 
                return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-100">TERCAPAI</Badge>;
            case 'BELUM TERCAPAI': 
                return <Badge className="bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100">BELUM TERCAPAI</Badge>;
            case 'PERLU EVALUASI': 
                return <Badge className="bg-rose-100 text-rose-800 border-rose-200 hover:bg-rose-100">PERLU EVALUASI</Badge>;
            default: 
                return <Badge variant="outline" className="text-slate-500 border-slate-200">PENDING</Badge>;
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-200 ease-out">
            <PageHero
                image="/hero/clinara-physio-hero.webp"
                title="Target"
                highlight="Terapis"
                description="Atur target kunjungan untuk setiap terapis."
            />

            <div className="flex justify-end">
                <Button onClick={() => handleOpenDialog()} className="bg-app-accent hover:bg-app-accent-hover text-white">
                    <Plus className="w-4 h-4 mr-2" /> Target Baru
                </Button>
            </div>

            <Card className="border-slate-200 shadow-sm">
                <CardHeader>
                    <CardTitle>Daftar Target Aktif</CardTitle>
                    <CardDescription>Semua target kunjungan yang sedang berjalan atau dijadwalkan.</CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex justify-center py-8"><Loader2 className="animate-spin text-app-accent" /></div>
                    ) : targets.length === 0 ? (
                        <div className="text-center py-12 text-slate-500 border-2 border-dashed rounded-app-sm">Belum ada target yang dibuat.</div>
                    ) : (
                        <div className="overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-slate-50">
                                <TableRow>
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
                                {targets.map((item) => {
                                    const progress = item.progress || {};
                                    return (
                                        <TableRow key={item.id} className="hover:bg-slate-50/50">
                                            <TableCell className="font-medium text-slate-700">
                                                <div className="flex items-center gap-2">
                                                    <Calendar className="w-4 h-4 text-slate-500" />
                                                    <span className="whitespace-nowrap">{format(parseISO(item.start_date), 'dd MMM')} - {format(parseISO(item.end_date), 'dd MMM yyyy')}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>{item.therapist?.name || 'Unknown'}</TableCell>
                                            <TableCell className="text-center font-bold text-slate-800">{item.target_visits}</TableCell>
                                            <TableCell className="text-center">
                                                <div className="flex flex-col items-center">
                                                    <span className="font-bold text-slate-900">{progress.actual_visits || 0}</span>
                                                    <span className="text-xs text-slate-500 font-medium">({progress.achievement_percentage || 0}%)</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                {getStatusBadge(progress.status)}
                                            </TableCell>
                                            <TableCell className="text-xs text-slate-500 max-w-[150px] truncate" title={Array.isArray(item.excluded_patient_types) ? item.excluded_patient_types.join(', ') : ''}>
                                                {Array.isArray(item.excluded_patient_types) && item.excluded_patient_types.length > 0 
                                                    ? item.excluded_patient_types.join(', ') 
                                                    : <span className="italic text-slate-500">- None -</span>}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button variant="ghost" size="icon" aria-label={`Ubah target ${item.therapist?.name || 'terapis'}`} onClick={() => handleOpenDialog(item)} className="tap-target h-8 w-8 text-slate-500 hover:text-app-accent">
                                                        <Pencil className="w-4 h-4" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" aria-label={`Hapus target ${item.therapist?.name || 'terapis'}`} onClick={() => handleDeleteClick(item)} className="tap-target h-8 w-8 text-slate-500 hover:text-rose-600">
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Create/Edit Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>{selectedTarget ? 'Edit Target' : 'Buat Target Baru'}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="target-therapist">Fisioterapis</Label>
                            <Select 
                                value={formData.therapistId} 
                                onValueChange={(val) => setFormData({...formData, therapistId: val})}
                                disabled={!!selectedTarget} // Lock therapist on edit
                            >
                                <SelectTrigger id="target-therapist">
                                    <SelectValue placeholder="Pilih Terapis" />
                                </SelectTrigger>
                                <SelectContent>
                                    {therapists.map(t => (
                                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="target-start">Tanggal Mulai</Label>
                                <Input 
                                    id="target-start"
                                    type="date" 
                                    value={formData.startDate} 
                                    onChange={(e) => setFormData({...formData, startDate: e.target.value})}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="target-end">Tanggal Selesai</Label>
                                <Input 
                                    id="target-end"
                                    type="date" 
                                    value={formData.endDate} 
                                    onChange={(e) => setFormData({...formData, endDate: e.target.value})}
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="target-visits">Target Kunjungan (Visits)</Label>
                            <Input 
                                id="target-visits"
                                type="number" 
                                min="1"
                                value={formData.targetVisits} 
                                onChange={(e) => setFormData({...formData, targetVisits: e.target.value})}
                                placeholder="Contoh: 80"
                                required
                            />
                            <p className="text-xs text-slate-500">Jumlah kunjungan yang harus dicapai dalam periode ini.</p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="target-excluded">Exclude Patient Types (Opsional)</Label>
                            <Input 
                                id="target-excluded"
                                value={formData.excludedTypes} 
                                onChange={(e) => setFormData({...formData, excludedTypes: e.target.value})}
                                placeholder="Pisahkan dengan koma, contoh: Asuransi, Umum"
                            />
                            <p className="text-xs text-slate-500">Tipe pasien yang tidak dihitung dalam target.</p>
                        </div>
                        
                        <div className="pt-4 flex justify-end gap-2">
                            <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Batal</Button>
                            <Button type="submit" disabled={submitting} className="bg-app-accent text-white hover:bg-app-accent-hover">
                                {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                Simpan
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation */}
            <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle>Hapus Target</DialogTitle>
                    </DialogHeader>
                    <div className="py-4 text-slate-600">
                        Apakah Anda yakin ingin menghapus target ini? Tindakan ini tidak dapat dibatalkan.
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>Batal</Button>
                        <Button variant="destructive" onClick={handleConfirmDelete} disabled={submitting}>
                            {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Hapus
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default TherapistTargetManagement;