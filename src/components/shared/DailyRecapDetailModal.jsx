import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, User, UserCircle, Activity, CreditCard, Clock, AlertCircle, Edit, Trash2, AlertTriangle, Loader2, FileText, ChevronDown } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { formatDateIndonesian, formatTime } from '@/lib/dateFormatHelpers';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { fetchRecapVitals, fetchPendingVitalsEdit, formatVitalsLine } from '@/lib/recapVitals';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import RecapVitalsDialog from './RecapVitalsDialog';
import RecapSoapPreviewDialog from './RecapSoapPreviewDialog';
import SoapOverrideDialog from './SoapOverrideDialog';
import { useSoapFirstSettings, useRecapQuote } from '@/hooks/useSoapFirst';
import { isSoapFirstActiveOn, ttvRequiredFor } from '@/lib/soapFirst';
import { KAFFAH_CLINIC_ID } from '@/lib/clinicIds';
import { 
    getAllRecapOptions,
    getDiscountTypeOptions,
    getPackageOptions
} from '@/lib/api';

const DetailItem = ({ icon: Icon, label, value, className = "", valueClassName = "" }) => (
    <div className={cn("flex flex-col space-y-1", className)}>
    <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
            {Icon && <Icon className="w-3.5 h-3.5" />} {label}
        </span>
    <span className={cn("text-[15px] font-semibold text-slate-900 break-words tracking-tight", valueClassName)}>
            {value || '-'}
        </span>
    </div>
);

// Ukuran seragam semua tombol footer: 44px di mobile (target sentuh), 40px di desktop.
const footerBtn = 'h-11 w-full rounded-xl px-4 text-sm font-medium sm:h-10 sm:w-auto';

const isUuid = (v) => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

const getDiagnosisIds = (diagnosis) => {
    let list = [];
    try {
        if (typeof diagnosis === 'string') {
            try { list = JSON.parse(diagnosis); } catch { list = [diagnosis]; }
        } else if (Array.isArray(diagnosis)) list = diagnosis;
    } catch (e) { list = []; }
    if (!Array.isArray(list)) list = [list];
    return list.flat().filter(Boolean);
};

const DailyRecapDetailModal = ({ isOpen, onClose, recap, onEdit, onDelete }) => {
    const { toast } = useToast();
    const [isDeleting, setIsDeleting] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    
    // Cache for options (diagnosa, service_type, etc.)
    const [optionsMap, setOptionsMap] = useState({});
    const [isLoadingOptions, setIsLoadingOptions] = useState(false);
    const { userDetails } = useAuth();
    const canInputVitals = ['owner', 'super_admin', 'admin'].includes(userDetails?.role);
    const [vitalsRow, setVitalsRow] = useState(null);
    const [pendingVitalsEdit, setPendingVitalsEdit] = useState(null);
    const [vitalsDialogOpen, setVitalsDialogOpen] = useState(false);
    const [soapPreviewOpen, setSoapPreviewOpen] = useState(false);
    const showSoapButton = userDetails?.clinic_id === KAFFAH_CLINIC_ID && !recap?.is_virtual;

    // Pengajuan perubahan ke owner (nominal, diskon, dst) untuk klinik SOAP-first.
    const { settings: sfSettings } = useSoapFirstSettings();
    const sfActive = isSoapFirstActiveOn(sfSettings, recap?.date);
    const canRequestChange = isOpen && !recap?.is_virtual && sfActive && ['admin', 'owner', 'super_admin'].includes(userDetails?.role);
    const { quote, refresh: refreshQuote } = useRecapQuote(recap?.id, null, canRequestChange);
    const [overrideDialog, setOverrideDialog] = useState(null);
    const [discountOptions, setDiscountOptions] = useState([]);
    const [packageOptions, setPackageOptions] = useState([]);
    const openOverride = async (cfg) => {
        if (cfg.withDiscount && discountOptions.length === 0) {
            try {
                const res = await getDiscountTypeOptions('');
                const list = res?.data || res;
                setDiscountOptions(Array.isArray(list) ? list.filter(o => !o.is_referral_reward) : []);
            } catch (e) { console.error('Gagal memuat jenis diskon', e); }
        }
        if (cfg.withPackage && packageOptions.length === 0) {
            try {
                const res = await getPackageOptions('');
                const list = res?.data || res;
                setPackageOptions(Array.isArray(list) ? list.filter(o => Number(o.session_count) > 1) : []);
            } catch (e) { console.error('Gagal memuat paket', e); }
        }
        setOverrideDialog({ recapId: recap.id, ...cfg });
    };
    const invoiceLocked = !!quote?.invoice_locked;
    // Ubah paket (REGULER -> paket) setelah invoice terbit; hanya sesi yang belum tertaut paket.
    const showPackageChange = invoiceLocked && !recap?.package_tracking_id && recap?.special_type !== 'free';
    const showDiscountRequest = invoiceLocked || !!quote?.homecare;
    // Lepas dari paket: sesi tertaut kuota paket (Rp 0) tapi pasien memutuskan bayar reguler.
    const showPackageRelease = !!recap?.package_tracking_id && !recap?.is_package_purchase && Number(recap?.amount_original ?? recap?.amount ?? 0) === 0 && recap?.special_type !== 'free';

    const loadVitals = React.useCallback(async () => {
        if (!recap?.id) return;
        const [row, pending] = await Promise.all([fetchRecapVitals(recap.id), fetchPendingVitalsEdit(recap.id)]);
        setVitalsRow(row);
        setPendingVitalsEdit(pending);
    }, [recap?.id]);

    useEffect(() => {
        setVitalsRow(null);
        setPendingVitalsEdit(null);
        if (isOpen) loadVitals();
    }, [isOpen, loadVitals]);

    useEffect(() => {
        if (isOpen) {
            // Reset delete confirm state on open
            setShowDeleteConfirm(false);
            // Fetch options to map UUIDs to Labels
            fetchOptions();
        }
    }, [isOpen, recap?.id]);

    const fetchOptions = async () => {
        setIsLoadingOptions(true);
        try {
            const { data, error } = await getAllRecapOptions();
            const mapping = {};
            if (data && !error) {
                data.forEach(opt => {
                    mapping[opt.id] = opt.label;
                });
            }

            // Diagnosa yang sudah tersimpan bisa merujuk opsi nonaktif / di luar
            // daftar aktif, jadi ambil langsung berdasarkan ID-nya.
            const missingIds = getDiagnosisIds(recap?.diagnosis)
                .filter(id => isUuid(id) && !mapping[id]);
            if (missingIds.length > 0) {
                const { data: extra } = await supabase
                    .from('operational_options')
                    .select('id, label')
                    .in('id', missingIds);
                (extra || []).forEach(opt => { mapping[opt.id] = opt.label; });
            }
            setOptionsMap(mapping);
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

    const ownerName = recap.patients?.full_name || recap.patient_name || recap.guest_name;
    const samePatient = !recap.actual_patient_id
        || recap.actual_patient_id === recap.patient_id
        || (!!ownerName && ownerName === recap.actual_patients?.full_name);

    // Resolve labels from IDs using optionsMap
    const serviceLabel = optionsMap[recap.service_type] || recap.service_type || '-';
    const patientTypeLabel = optionsMap[recap.patient_type] || recap.patient_type || '-';
    const packageLabel = recap.package_type || '-';

    const renderDiagnoses = (diagnosis) => {
    const flat = getDiagnosisIds(diagnosis);

    if (flat.length === 0) {
        return <span className="text-sm text-slate-500">-</span>;
    }

    return flat.map((d, i) => {
        // Diagnosa ketikan bebas disimpan sebagai teks, bukan UUID
        const label = optionsMap[d] || (isUuid(d) ? null : d);

        return (
            <Badge key={i} className="bg-slate-100 text-slate-700">
                {label || '...'}
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
            if (String(err?.message || '').includes('sudah memiliki invoice')) {
                // Kaffah: recap ber-invoice hanya bisa dihapus lewat pengecualian owner.
                setShowDeleteConfirm(false);
                setOverrideDialog({ recapId: recap.id, kind: 'recap_delete', isDelete: true, description: 'Recap ini sudah memiliki invoice sehingga tidak bisa dihapus langsung. Ajukan ke owner; bila disetujui, recap dan appointment terkait akan dihapus.' });
            } else {
                toast({ variant: "destructive", title: "Gagal", description: "Gagal menghapus data." });
            }
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="w-[calc(100vw-1rem)] max-w-3xl max-h-[90vh] grid-cols-[minmax(0,1fr)] overflow-y-auto overflow-x-hidden rounded-app-lg p-0 shadow-xl border border-slate-200/60">
          <DialogHeader className="px-4 py-4 sm:px-6 sm:py-5 border-b border-slate-200/60 bg-white rounded-t-app-lg">
                    <div className="flex justify-between items-start">
                        <div>
                <DialogTitle className="text-xl sm:text-2xl font-semibold text-slate-900 tracking-tight">Detail Recap Harian</DialogTitle>
                <DialogDescription className="sr-only">Rincian data recap harian pasien.</DialogDescription>
                        </div>
                        {isVirtual && (
                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                Scheduled Appointment
                            </Badge>
                        )}
                    </div>
                </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-6 px-3 py-3 sm:px-6 sm:py-6">
                    {/* Section 1: Pasien */}
                    <div className="min-w-0 space-y-3 sm:space-y-4 p-3.5 sm:p-5 rounded-app-lg border border-slate-200/60 bg-white shadow-sm [@media(hover:hover)_and_(pointer:fine)]:hover:shadow-md transition-[color,background-color,border-color,box-shadow,transform,opacity] duration-200">
                        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-200/60">
                            <UserCircle className="w-4 h-4 text-app-accent" />
                <h4 className="text-sm font-semibold text-slate-700 tracking-tight">Identitas Pasien</h4>
                        </div>
                        
                        <DetailItem 
                            label={samePatient ? "Pasien" : "Pemilik Akun/Paket"} 
                            value={ownerName} 
                            valueClassName="text-base font-bold text-slate-900"
                        />
                        
                        {!samePatient && (
                            <DetailItem 
                                label="Pasien Aktual" 
                                value={displayActualPatient} 
                                valueClassName={cn("font-medium", displayActualPatient !== '-' ? "text-app-accent-hover" : "text-slate-500")}
                            />
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            <DetailItem label="Tipe Pasien" value={patientTypeLabel} />
                            <DetailItem label="No. Telepon" value={recap.patients?.phone || recap.guest_phone || '-'} />
                        </div>
                    </div>

                    {/* Section 2: Waktu */}
                    <div className="min-w-0 space-y-3 sm:space-y-4 p-3.5 sm:p-5 rounded-app-lg border border-slate-200/60 bg-white shadow-sm [@media(hover:hover)_and_(pointer:fine)]:hover:shadow-md transition-[color,background-color,border-color,box-shadow,transform,opacity] duration-200">
                        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-200/60">
                            <Clock className="w-4 h-4 text-app-accent" />
                            <h4 className="text-sm font-bold text-slate-800">Waktu & Status</h4>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <DetailItem 
                                label="Tanggal" 
                                icon={Calendar}
                                value={recap.date ? formatDateIndonesian(recap.date) : '-'} 
                            />
                            <div className="flex flex-col space-y-1">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                                    <Activity className="w-3.5 h-3.5" /> Status
                                </span>
                                <div>
                                    {recap.end_time ? (
                                        <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none">Selesai</Badge>
                                    ) : recap.start_time ? (
                                        <Badge className="bg-app-accent/15 text-app-accent-hover hover:bg-app-accent/15 border-none">Berlangsung</Badge>
                                    ) : (
                                        <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100 border-none">Belum Mulai</Badge>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 pt-2">
                            <DetailItem label="Mulai" value={recap.start_time ? formatTime(new Date(recap.start_time)) : '-'} valueClassName="font-mono text-sm text-app-accent-hover" />
                            <DetailItem label="Selesai" value={recap.end_time ? formatTime(new Date(recap.end_time)) : '-'} valueClassName="font-mono text-sm text-green-700" />
                        </div>
                    </div>

                    {/* Section 3: Detail Klinis */}
            <div className="min-w-0 space-y-3 sm:space-y-4 md:col-span-2 p-3.5 sm:p-5 rounded-app-lg border border-slate-200/60 bg-white shadow-sm [@media(hover:hover)_and_(pointer:fine)]:hover:shadow-md transition-[color,background-color,border-color,box-shadow,transform,opacity] duration-200">
                        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-100">
                            <Activity className="w-4 h-4 text-app-accent" />
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

                    {/* Tanda Vital (input admin, terkunci setelah diisi, tertaut ke SOAP) */}
                    <div className="min-w-0 space-y-2 md:col-span-2 p-3.5 sm:p-5 rounded-app-lg border border-cyan-200/60 bg-cyan-50/40 shadow-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-2 pb-2 border-b border-cyan-200/60">
                            <div className="flex items-center gap-2">
                                <Activity className="w-4 h-4 text-cyan-700" />
                                <h4 className="text-sm font-bold text-slate-800">Tanda-Tanda Vital</h4>
                            </div>
                            {canInputVitals && !recap.is_virtual && (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 border-cyan-300 text-cyan-800 hover:bg-cyan-50"
                                    disabled={!!pendingVitalsEdit}
                                    onClick={() => setVitalsDialogOpen(true)}
                                >
                                    {vitalsRow ? 'Ajukan Perubahan' : 'Input TTV'}
                                </Button>
                            )}
                        </div>
                        {vitalsRow ? (
                            <>
                                <p className="text-sm sm:text-[15px] font-semibold text-slate-900 break-words">{formatVitalsLine(vitalsRow)}</p>
                                {vitalsRow.notes && <p className="text-xs text-slate-500">{vitalsRow.notes}</p>}
                                <p className="text-xs text-slate-500">Terkunci. Perubahan perlu persetujuan owner beserta alasan.</p>
                            </>
                        ) : (
                            <p className="text-sm text-slate-500">Belum diisi.</p>
                        )}
                        {!vitalsRow && sfActive && ttvRequiredFor(sfSettings, recap) && (
                            <p className="text-xs font-medium text-amber-700">TTV bagian dari SOAP: SOAP belum dianggap selesai dan pembayaran tetap terkunci sampai TTV diisi.</p>
                        )}
                        {pendingVitalsEdit && (
                            <p className="text-xs font-medium text-amber-700">Pengajuan perubahan menunggu persetujuan owner{pendingVitalsEdit.requested_by_name ? ` (diajukan ${pendingVitalsEdit.requested_by_name})` : ''}.</p>
                        )}
                    </div>

                    {/* Section 4: Keuangan */}
            <div className="min-w-0 space-y-3 sm:space-y-4 md:col-span-2 p-3.5 sm:p-5 rounded-app-lg border border-blue-200/40 bg-gradient-to-br from-app-soft via-white to-app-soft shadow-sm [@media(hover:hover)_and_(pointer:fine)]:hover:shadow-md transition-[color,background-color,border-color,box-shadow,transform,opacity] duration-200">
                        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-blue-200/50">
                            <CreditCard className="w-4 h-4 text-app-accent" />
                            <h4 className="text-sm font-bold text-app-ink">Informasi Pembayaran</h4>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <DetailItem 
                                label="Nominal" 
                                value={formatCurrency(recap.amount)} 
                                valueClassName="font-bold text-lg text-slate-900" 
                            />
                            <DetailItem
                                label="Metode Pembayaran"
                                value={
                                    Array.isArray(recap.payment_splits) && recap.payment_splits.length > 1
                                        ? recap.payment_splits.map(s => `${s.payment_method} (${formatCurrency(s.amount)})`).join(' + ')
                                        : recap.payment_method
                                }
                            />

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

          {/* Aksi: mobile = 3 baris (Pengajuan; SOAP + Edit; Hapus + Tutup), desktop = satu baris */}
          <div className="grid grid-cols-2 gap-2 border-t border-slate-200/60 bg-white p-3 sm:flex sm:items-center sm:justify-end sm:px-6 sm:py-4">
                    {showDeleteConfirm ? (
                        <div className="order-4 col-span-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2 animate-in fade-in sm:order-1 sm:col-span-1 sm:mr-auto sm:justify-start">
                            <span className="flex items-center gap-1.5 text-xs font-medium text-red-700">
                                <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" /> Yakin hapus permanen?
                            </span>
                            <span className="flex gap-1.5">
                                <Button size="sm" variant="destructive" onClick={handleDelete} disabled={isDeleting} className="h-8 rounded-lg text-xs">
                                    {isDeleting ? <Loader2 className="h-3 w-3 animate-spin" /> : "Ya, Hapus"}
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => setShowDeleteConfirm(false)} className="h-8 rounded-lg text-xs text-slate-600">Batal</Button>
                            </span>
                        </div>
                    ) : onDelete && (
                        <Button variant="ghost" onClick={() => setShowDeleteConfirm(true)} className={cn(footerBtn, 'order-4 text-red-600 hover:bg-red-50 hover:text-red-700 sm:order-1 sm:mr-auto')}>
                            <Trash2 className="mr-2 h-4 w-4" /> Hapus
                        </Button>
                    )}

                    <Button variant="outline" onClick={onClose} className={cn(footerBtn, 'order-5 bg-white sm:order-2')}>Tutup</Button>
                    {showSoapButton && (
                        <Button variant="outline" onClick={() => setSoapPreviewOpen(true)} className={cn(footerBtn, 'order-2 border-emerald-300 bg-white text-emerald-700 hover:bg-emerald-50 sm:order-3')}>
                            <FileText className="mr-2 h-4 w-4" /> SOAP
                        </Button>
                    )}
                    {canRequestChange && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" className={cn(footerBtn, 'order-1 col-span-2 bg-white sm:order-4 sm:col-span-1')}>
                                    Pengajuan Perubahan <ChevronDown className="ml-1.5 h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent side="top" align="start" className="w-[var(--radix-dropdown-menu-trigger-width)] sm:w-auto">
                                    <DropdownMenuItem onSelect={() => openOverride({ kind: 'amount_adjust', withAmount: true, description: 'Ubah nominal tagihan di luar daftar harga. Berlaku setelah disetujui owner.' })}>
                                        Pengajuan perubahan nominal
                                    </DropdownMenuItem>
                                    {showDiscountRequest && (
                                        <DropdownMenuItem onSelect={() => openOverride(invoiceLocked
                                            ? { kind: 'discount_adjust', withDiscount: true, description: 'Invoice sudah terbit sehingga diskon terkunci. Pilih diskon yang seharusnya berlaku; nominal dihitung ulang setelah disetujui owner.' }
                                            : { kind: 'homecare_discount', description: 'Izinkan diskon untuk sesi homecare ini. Berlaku setelah disetujui owner.' })}>
                                            Pengajuan perubahan diskon
                                        </DropdownMenuItem>
                                    )}
                                    {showPackageChange && (
                                        <DropdownMenuItem onSelect={() => openOverride({ kind: 'package_change', withPackage: true, description: 'Invoice sudah terbit. Pilih paket yang diambil pasien. Setelah disetujui owner, diskon/reward dilepas (paket tidak boleh diskon), nominal dihitung ulang dari harga paket, dan paket pasien dibuat. Invoice perlu diterbitkan ulang.' })}>
                                            Pengajuan ubah paket
                                        </DropdownMenuItem>
                                    )}
                                    {showPackageRelease && (
                                        <DropdownMenuItem onSelect={() => openOverride({ kind: 'package_release', description: 'Sesi ini memakai kuota paket (Rp 0) sehingga nominal & metode pembayaran terkunci. Pakai ini bila pasien batal memakai paket (termasuk paket milik orang lain) dan akan bayar reguler. Setelah disetujui owner, sesi dilepas dari paket dan kuota paket kembali; lalu isi nominal & metode pembayaran lewat Edit Data.' })}>
                                            Pengajuan lepas dari paket
                                        </DropdownMenuItem>
                                    )}
                                    {!quote?.soap_done && quote?.needs_soap && !invoiceLocked && (
                                        <DropdownMenuItem onSelect={() => openOverride({ kind: 'payment_unlock', description: 'Buka kunci pembayaran tanpa menunggu SOAP (mis. terapis berhalangan). Berlaku setelah disetujui owner.' })}>
                                            Pengajuan buka kunci pembayaran
                                        </DropdownMenuItem>
                                    )}
                                    {quote && !quote.homecare && !quote.xtratime && !invoiceLocked && (
                                        <DropdownMenuItem onSelect={() => openOverride({ kind: 'xtratime', description: 'Tandai sesi ini sebagai Xtratime (pasien di luar jam kerja, bukan homecare). Berlaku setelah disetujui owner.' })}>
                                            Pengajuan Xtratime
                                        </DropdownMenuItem>
                                    )}
                                </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                    {onEdit && (
                        <Button onClick={() => { onEdit(recap); onClose(); }} className={cn(footerBtn, 'order-3 bg-app-accent text-white hover:bg-app-accent-hover sm:order-5')}>
                            <Edit className="mr-2 h-4 w-4" /> Edit Data
                        </Button>
                    )}
                </div>
            </DialogContent>
            <SoapOverrideDialog
                open={!!overrideDialog}
                onOpenChange={(v) => { if (!v) setOverrideDialog(null); }}
                kind={overrideDialog?.kind}
                recapId={overrideDialog?.recapId ?? null}
                description={overrideDialog?.description}
                withAmount={!!overrideDialog?.withAmount}
                withDiscount={!!overrideDialog?.withDiscount}
                discountOptions={discountOptions}
                withPackage={!!overrideDialog?.withPackage}
                packageOptions={packageOptions}
                onDone={() => { if (overrideDialog?.isDelete) { if (onDelete) onDelete(); onClose(); } else { refreshQuote(); } }}
            />
            <RecapSoapPreviewDialog
                open={soapPreviewOpen}
                onOpenChange={setSoapPreviewOpen}
                recapId={recap?.id}
                patientName={recap?.actual_patients?.full_name || recap?.patients?.full_name || recap?.guest_name}
            />
            <RecapVitalsDialog
                open={vitalsDialogOpen}
                onOpenChange={setVitalsDialogOpen}
                recap={recap}
                existing={vitalsRow}
                onDone={loadVitals}
            />
        </Dialog>
    );
};

export default DailyRecapDetailModal;