import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { Loader2, X, PackageOpen } from 'lucide-react';
import { formatDateIndonesian } from '@/lib/dateFormatHelpers';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const PackageHistoryModal = ({ isOpen, onClose, packageData }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [history, setHistory] = useState([]);

    useEffect(() => {
        if (isOpen && packageData?.id) {
            fetchHistory();
        }
    }, [isOpen, packageData]);

    const fetchHistory = async () => {
        setIsLoading(true);
        try {
            // Using explicit foreign key constraints to resolve ambiguity (PGRST201)
            const { data: recapData, error: recapError } = await supabase
                .from('daily_recaps')
                .select(`
                    id,
                    recap_date,
                    therapist_name,
                    amount,
                    patient_id,
                    patients:patients!daily_recap_patient_id_fkey(full_name),
                    actual_patient_id,
                    actual_patient:patients!daily_recaps_actual_patient_id_fkey(full_name),
                    package_tracking_id
                `)
                .eq('package_tracking_id', packageData.id)
                .order('recap_date', { ascending: false });

            if (recapError) throw recapError;
            // Nominal (amount) > 0 entries first, most recent first within each group.
            const sorted = [...(recapData || [])].sort((a, b) => {
                const aPaid = (a.amount || 0) > 0 ? 1 : 0;
                const bPaid = (b.amount || 0) > 0 ? 1 : 0;
                if (aPaid !== bPaid) return bPaid - aPaid;
                return new Date(b.recap_date) - new Date(a.recap_date);
            });
            setHistory(sorted);

        } catch (error) {
            console.error("Error fetching history:", error);
            toast({ variant: "destructive", title: "Error", description: "Gagal memuat riwayat paket. Silakan coba lagi." });
        } finally {
            setIsLoading(false);
        }
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount || 0);
    };

    // Helper to determine status style
    const getStatusStyle = (status) => {
        const s = (status || '').toLowerCase();
        if (s === 'aktif') return 'bg-green-100 text-green-800 border-green-200';
        if (s === 'expired') return 'bg-red-100 text-red-800 border-red-200';
        if (s === 'pending') return 'bg-blue-100 text-blue-800 border-blue-200';
        if (s === 'selesai' || s === 'habis') return 'bg-slate-100 text-slate-800 border-slate-200';
        return 'bg-gray-100 text-gray-800 border-gray-200';
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden rounded-xl shadow-2xl">
                <div className="px-6 py-5 border-b border-slate-100 bg-white">
                    <DialogHeader className="flex flex-row items-center justify-between">
                        <div>
                            <DialogTitle className="text-xl font-bold text-slate-900">Riwayat Penggunaan Paket</DialogTitle>
                            <p className="text-sm text-slate-500 mt-1">Detail penggunaan sesi paket perawatan.</p>
                        </div>
                        {/* Native Close is used by DialogContent but we can hide it via CSS if needed, usually it's absolute top-right */}
                    </DialogHeader>
                </div>
                
                <div className="flex-1 overflow-y-auto px-6 py-6 bg-slate-50/30">
                    {/* Header Info from packageData prop */}
                    <div className="mb-6 p-5 bg-white rounded-xl border border-slate-200 shadow-sm">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="space-y-1">
                                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Jenis Paket</span>
                                <p className="font-bold text-slate-900 text-lg">{packageData?.package_name || '-'}</p>
                            </div>
                            <div className="space-y-1">
                                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Pemilik Paket</span>
                                <p className="font-medium text-slate-900">{packageData?.patients?.full_name || packageData?.patient_name || '-'}</p>
                            </div>
                             <div className="space-y-1">
                                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</span>
                                <div>
                                    <Badge variant="outline" className={cn("px-2.5 py-0.5 rounded-full font-medium border", getStatusStyle(packageData?.status))}>
                                        {packageData?.status || '-'}
                                    </Badge>
                                </div>
                            </div>
                        </div>
                        
                        <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                                <span className="text-sm text-slate-500">Sisa Sesi:</span>
                                <div className="flex items-center gap-1">
                                    <span className="text-2xl font-bold text-blue-600">{packageData?.sessions_remaining ?? '-'}</span>
                                    <span className="text-slate-400 text-sm font-medium">/ {packageData?.total_sessions ?? '-'} Sesi</span>
                                </div>
                            </div>
                            {packageData?.end_date && (
                                <div className="text-right">
                                    <span className="text-xs text-slate-400 block">Berakhir pada</span>
                                    <span className="text-sm font-medium text-slate-700">{formatDateIndonesian(packageData.end_date)}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        {/* Mobile / PWA: kartu, tanpa geser horizontal */}
                        <div className="sm:hidden divide-y divide-slate-100">
                            {isLoading ? (
                                <div className="flex flex-col items-center justify-center gap-3 p-12 text-center text-slate-500">
                                    <Loader2 className="animate-spin h-8 w-8 text-blue-500" />
                                    <span className="text-sm font-medium text-slate-600">Memuat riwayat...</span>
                                </div>
                            ) : history.length === 0 ? (
                                <div className="flex flex-col items-center justify-center gap-4 p-16 text-center text-slate-500">
                                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center border border-slate-100">
                                        <PackageOpen className="w-8 h-8 text-slate-300" />
                                    </div>
                                    <div>
                                        <p className="font-semibold text-slate-900 text-base">Tidak ada riwayat penggunaan</p>
                                        <p className="text-sm text-slate-500 mt-1 max-w-xs mx-auto">Paket ini belum pernah digunakan untuk kunjungan perawatan.</p>
                                    </div>
                                </div>
                            ) : (
                                history.map((item, index) => {
                                    const ownerName = item.patients?.full_name;
                                    const actualName = item.actual_patient?.full_name;
                                    const isDifferent = item.actual_patient_id && item.patient_id && item.actual_patient_id !== item.patient_id;
                                    const displayPatientName = isDifferent ? actualName : (ownerName || '-');

                                    return (
                                        <div key={item.id} className="p-4 space-y-2">
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0">
                                                    <p className="font-semibold text-slate-900">{displayPatientName}</p>
                                                    {isDifferent && (
                                                        <div className="text-[10px] text-amber-600 mt-1 flex items-center gap-1.5 font-medium bg-amber-50 px-2 py-0.5 rounded-full w-fit border border-amber-100">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block"></span>
                                                            Pasien Kerabat
                                                        </div>
                                                    )}
                                                </div>
                                                <p className="text-slate-900 font-bold font-mono shrink-0">{formatCurrency(item.amount)}</p>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2 text-xs">
                                                <div>
                                                    <p className="text-slate-400 uppercase tracking-wide text-[10px] mb-0.5">Tanggal Kunjungan</p>
                                                    <p className="text-slate-700 font-medium">{formatDateIndonesian(item.recap_date)}</p>
                                                </div>
                                                <div>
                                                    <p className="text-slate-400 uppercase tracking-wide text-[10px] mb-0.5">Fisioterapis</p>
                                                    <p className="text-slate-600 font-medium">{item.therapist_name || '-'}</p>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {/* Desktop: tabel */}
                        <div className="hidden sm:block overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 text-slate-700 border-b border-slate-200">
                                    <tr>
                                        <th className="px-5 py-3.5 font-semibold whitespace-nowrap">Tanggal Kunjungan</th>
                                        <th className="px-5 py-3.5 font-semibold whitespace-nowrap">Nama Pasien</th>
                                        <th className="px-5 py-3.5 font-semibold whitespace-nowrap">Fisioterapis</th>
                                        <th className="px-5 py-3.5 font-semibold text-right whitespace-nowrap">Nominal</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {isLoading ? (
                                        <tr>
                                            <td colSpan={4} className="p-12 text-center text-slate-500">
                                                <div className="flex flex-col items-center justify-center gap-3">
                                                    <Loader2 className="animate-spin h-8 w-8 text-blue-500" />
                                                    <span className="text-sm font-medium text-slate-600">Memuat riwayat...</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : history.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} className="p-16 text-center text-slate-500">
                                                <div className="flex flex-col items-center justify-center gap-4">
                                                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center border border-slate-100">
                                                        <PackageOpen className="w-8 h-8 text-slate-300" />
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold text-slate-900 text-base">Tidak ada riwayat penggunaan</p>
                                                        <p className="text-sm text-slate-500 mt-1 max-w-xs mx-auto">Paket ini belum pernah digunakan untuk kunjungan perawatan.</p>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        history.map((item, index) => {
                                            // Logic: Show Actual Patient Name if available and different from Owner
                                            const ownerName = item.patients?.full_name;
                                            const actualName = item.actual_patient?.full_name;
                                            
                                            // Determine which name to display
                                            const isDifferent = item.actual_patient_id && item.patient_id && item.actual_patient_id !== item.patient_id;
                                            const displayPatientName = isDifferent ? actualName : (ownerName || '-');

                                            return (
                                                <tr key={item.id} className={`${index % 2 === 0 ? 'bg-white' : 'bg-slate-50'} hover:bg-blue-50/30 transition-colors`}>
                                                    <td className="px-5 py-4 text-slate-700 align-middle whitespace-nowrap font-medium">
                                                        {formatDateIndonesian(item.recap_date)}
                                                    </td>
                                                    <td className="px-5 py-4 align-middle">
                                                        <div className="font-semibold text-slate-900">{displayPatientName}</div>
                                                        {isDifferent && (
                                                            <div className="text-[10px] text-amber-600 mt-1 flex items-center gap-1.5 font-medium bg-amber-50 px-2 py-0.5 rounded-full w-fit border border-amber-100">
                                                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block"></span>
                                                                Pasien Kerabat
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="px-5 py-4 text-slate-600 align-middle font-medium">{item.therapist_name || '-'}</td>
                                                    <td className="px-5 py-4 text-right text-slate-900 font-bold font-mono align-middle">
                                                        {formatCurrency(item.amount)}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div className="px-6 py-4 border-t border-slate-100 bg-white flex justify-end">
                     <Button variant="secondary" onClick={onClose} className="px-6 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium">Tutup</Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default PackageHistoryModal;