import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, User, UserCircle, Activity, CreditCard, Clock, AlertCircle, Edit, Trash2, AlertTriangle, Loader2 } from 'lucide-react';
import { formatDateIndonesian, formatTime } from '@/lib/dateFormatHelpers';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { 
    getAllRecapOptions
} from '@/lib/api';

const DetailItem = ({ icon: Icon, label, value, className = "", valueClassName = "" }) => (
    <div className={cn("flex flex-col space-y-1", className)}>
    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
            {Icon && <Icon className="w-3.5 h-3.5" />} {label}
        </span>
    <span className={cn("text-[15px] font-semibold text-slate-900 break-words tracking-tight", valueClassName)}>
            {value || '-'}
        </span>
    </div>
);

const DailyRecapDetailModal = ({ isOpen, onClose, recap, onEdit, onDelete }) => {
    const { toast } = useToast();
    const [isDeleting, setIsDeleting] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    
    // Cache for options (diagnosa, service_type, etc.)
    const [optionsMap, setOptionsMap] = useState({});
    const [isLoadingOptions, setIsLoadingOptions] = useState(false);

    useEffect(() => {
        if (isOpen) {
            // Reset delete confirm state on open
            setShowDeleteConfirm(false);
            // Fetch options to map UUIDs to Labels
            fetchOptions();
        }
    }, [isOpen]);

    const fetchOptions = async () => {
        setIsLoadingOptions(true);
        try {
            const { data, error } = await getAllRecapOptions();
            if (data && !error) {
                const mapping = {};
                data.forEach(opt => {
                    mapping[opt.id] = opt.label;
                });
                setOptionsMap(mapping);
            }
        } catch (error) {
            console.error("Error fetching options in detail modal:", error);
        } finally {
            setIsLoadingOptions(false);
        }
    };

    if (!recap) return null;

    const formatCurrency = (val) => 
        new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val);

    const isPackageDeleted = recap.package_deleted_flag;
    const isVirtual = recap.is_virtual;

    const displayActualPatient = recap.actual_patients?.full_name || (recap.actual_patient_id ? "Loading..." : "-");

    // Resolve labels from IDs using optionsMap
    const serviceLabel = optionsMap[recap.service_type] || recap.service_type || '-';
    const patientTypeLabel = optionsMap[recap.patient_type] || recap.patient_type || '-';
    const packageLabel = recap.package_type || '-';

    const renderDiagnoses = (diagnosis) => {
    let diagnosesList = [];

    try {
        if (typeof diagnosis === 'string') diagnosesList = JSON.parse(diagnosis);
        else if (Array.isArray(diagnosis)) diagnosesList = diagnosis;
    } catch (e) { diagnosesList = []; }

    const flat = diagnosesList.flat().filter(Boolean);

    if (flat.length === 0) {
        return <span className="text-sm text-slate-500">-</span>;
    }

    return flat.map((d, i) => {
        const label = optionsMap[d];

        return (
            <Badge key={i} className="bg-slate-100 text-slate-700">
                {label || '...'} {/* 🔥 fallback aman */}
            </Badge>
        );
    });
};

    const handleDelete = async () => {
        setIsDeleting(true);
        try {
            const { error } = await supabase.from('daily_recaps').delete().eq('id', recap.id);
            if (error) throw error;
            
            toast({ title: "Berhasil", description: "Data recap berhasil dihapus." });
            setShowDeleteConfirm(false);
            if (onDelete) onDelete(); 
            onClose();
        } catch (err) {
            console.error("Delete failed:", err);
            toast({ variant: "destructive", title: "Gagal", description: "Gagal menghapus data." });
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl p-0 shadow-xl border border-slate-200/60">
          <DialogHeader className="px-6 py-5 border-b border-slate-200/60 bg-white rounded-t-2xl">
                    <div className="flex justify-between items-start">
                        <div>
                <DialogTitle className="text-2xl font-semibold text-slate-900 tracking-tight">Detail Recap Harian</DialogTitle>
                <DialogDescription className="text-xs text-slate-400 mt-1 tracking-wide">
                                ID: {recap.id?.slice(0,8)}...
                            </DialogDescription>
                        </div>
                        {isVirtual && (
                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                Scheduled Appointment
                            </Badge>
                        )}
                    </div>
                </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 px-6 py-6">
                    {/* Section 1: Pasien */}
                    <div className="space-y-4 p-5 rounded-2xl border border-slate-200/60 bg-white shadow-sm hover:shadow-md transition-all duration-300">
                        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-200/60">
                            <UserCircle className="w-4 h-4 text-blue-600" />
                <h4 className="text-sm font-semibold text-slate-700 tracking-tight">Identitas Pasien</h4>
                        </div>
                        
                        <DetailItem 
                            label="Pemilik Akun/Paket" 
                            value={recap.patients?.full_name || recap.patient_name || recap.guest_name} 
                            valueClassName="text-base font-bold text-slate-900"
                        />
                        
                        <DetailItem 
                            label="Pasien Aktual" 
                            value={displayActualPatient} 
                            valueClassName={cn("font-medium", displayActualPatient !== '-' ? "text-blue-700" : "text-slate-400")}
                        />

                        <div className="grid grid-cols-2 gap-4">
                            <DetailItem label="Tipe Pasien" value={patientTypeLabel} />
                            <DetailItem label="No. Telepon" value={recap.patients?.phone || recap.guest_phone || '-'} />
                        </div>
                    </div>

                    {/* Section 2: Waktu */}
                    <div className="space-y-4 p-5 rounded-2xl border border-slate-200/60 bg-white shadow-sm hover:shadow-md transition-all duration-300">
                        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-200/60">
                            <Clock className="w-4 h-4 text-blue-600" />
                            <h4 className="text-sm font-bold text-slate-800">Waktu & Status</h4>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <DetailItem 
                                label="Tanggal" 
                                icon={Calendar}
                                value={recap.date ? formatDateIndonesian(recap.date) : '-'} 
                            />
                            <div className="flex flex-col space-y-1">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                    <Activity className="w-3.5 h-3.5" /> Status
                                </span>
                                <div>
                                    {recap.end_time ? (
                                        <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none">Selesai</Badge>
                                    ) : recap.start_time ? (
                                        <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-none">Berlangsung</Badge>
                                    ) : (
                                        <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100 border-none">Belum Mulai</Badge>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 pt-2">
                            <DetailItem label="Mulai" value={recap.start_time ? formatTime(new Date(recap.start_time)) : '-'} valueClassName="font-mono text-blue-700" />
                            <DetailItem label="Selesai" value={recap.end_time ? formatTime(new Date(recap.end_time)) : '-'} valueClassName="font-mono text-green-700" />
                        </div>
                    </div>

                    {/* Section 3: Detail Klinis */}
            <div className="space-y-4 md:col-span-2 p-5 rounded-2xl border border-slate-200/60 bg-white shadow-sm hover:shadow-md transition-all duration-300">
                        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-100">
                            <Activity className="w-4 h-4 text-blue-600" />
                            <h4 className="text-sm font-bold text-slate-800">Detail Layanan & Klinis</h4>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <DetailItem label="Fisioterapis" value={recap.therapist?.name || recap.therapist_name} icon={User} />
                                <DetailItem label="Layanan" value={serviceLabel} />
                                <DetailItem 
                                    label="Paket" 
                                    value={
                                        isPackageDeleted 
                                        ? <span className="text-red-600 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Paket Telah Dihapus</span> 
                                        : (packageLabel || '-')
                                    } 
                                />
                            </div>
                            
                            <div className="space-y-4">
                                <div className="flex flex-col space-y-1">
                                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Diagnosa</span>
                                    <div className="flex flex-wrap gap-1">
                                        {renderDiagnoses(recap.diagnosis)}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Section 4: Keuangan */}
            <div className="space-y-4 md:col-span-2 p-5 rounded-2xl border border-blue-200/40 bg-gradient-to-br from-blue-50 via-white to-blue-50 shadow-sm hover:shadow-md transition-all duration-300">
                        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-blue-200/50">
                            <CreditCard className="w-4 h-4 text-blue-600" />
                            <h4 className="text-sm font-bold text-blue-900">Informasi Pembayaran</h4>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <DetailItem 
                                label="Nominal" 
                                value={formatCurrency(recap.amount)} 
                                valueClassName="font-bold text-lg text-slate-900" 
                            />
                            <DetailItem label="Metode Pembayaran" value={recap.payment_method} />
                            
                            {recap.discount_value > 0 && (
                                <div className="flex flex-col space-y-1">
                                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Diskon</span>
                                    <div className="text-sm font-medium text-orange-600">
                                        {recap.discount_type === 'percentage' 
                                            ? `${recap.discount_value}%` 
                                            : formatCurrency(recap.discount_value)
                                        }
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

          <div className="px-6 py-4 border-t border-slate-200/60 bg-white flex justify-between items-center">
                    {!showDeleteConfirm ? (
                        <div className="flex gap-2">
                            {onDelete && (
                                <Button variant="ghost" onClick={() => setShowDeleteConfirm(true)} className="text-red-600 hover:text-red-700 hover:bg-red-50">
                                    <Trash2 className="w-4 h-4 mr-2" /> Hapus
                                </Button>
                            )}
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 bg-red-50 px-3 py-1.5 rounded-lg border border-red-100 animate-in fade-in">
                            <AlertTriangle className="w-4 h-4 text-red-600" />
                            <span className="text-xs font-medium text-red-700">Yakin hapus permanen?</span>
                            <Button size="sm" variant="destructive" onClick={handleDelete} disabled={isDeleting} className="h-7 text-xs">
                                {isDeleting ? <Loader2 className="w-3 h-3 animate-spin" /> : "Ya, Hapus"}
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setShowDeleteConfirm(false)} className="h-7 text-xs text-slate-600">Batal</Button>
                        </div>
                    )}

                    <div className="flex gap-2">
                        <Button variant="outline" onClick={onClose} className="bg-white">Tutup</Button>
                        {onEdit && (
                            <Button onClick={() => { onEdit(recap); onClose(); }} className="bg-blue-600 hover:bg-blue-700 text-white">
                                <Edit className="w-4 h-4 mr-2" /> Edit Data
                            </Button>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default DailyRecapDetailModal;