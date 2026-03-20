
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Trash2, Edit, Eye, X } from 'lucide-react';
import DailyRecapForm from './DailyRecapForm';
import { formatDateIndonesian } from '@/lib/dateFormatHelpers';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';

const DailyRecapDetailModal = ({ isOpen, recap, onClose, onSave, mode = 'view' }) => {
    const [currentMode, setCurrentMode] = useState(mode);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        if (isOpen) {
            setCurrentMode(mode);
            setShowDeleteConfirm(false);
        }
    }, [isOpen, mode]);

    const handleDelete = async () => {
        try {
            const { error } = await supabase.from('daily_recaps').delete().eq('id', recap.id);
            if (error) throw error;
            toast({ title: "Berhasil", description: "Data recap berhasil dihapus." });
            onSave(); // Refresh list
            onClose();
        } catch (err) {
            toast({ variant: "destructive", title: "Gagal", description: "Gagal menghapus data." });
        }
    };

    const ReadOnlyView = () => (
        <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-3 rounded-md">
                    <p className="text-xs text-slate-500 uppercase font-semibold mb-1">Tanggal</p>
                    <p className="text-slate-900">{recap?.date ? formatDateIndonesian(recap.date) : '-'}</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-md">
                    <p className="text-xs text-slate-500 uppercase font-semibold mb-1">Terapis</p>
                    <p className="text-slate-900">{recap?.therapist_name || '-'}</p>
                </div>
            </div>
            
            <div className="bg-slate-50 p-3 rounded-md">
                <p className="text-xs text-slate-500 uppercase font-semibold mb-1">Pasien</p>
                <p className="text-slate-900 font-medium">{recap?.searchable_patient_name || recap?.patient_display_name || '-'}</p>
                {recap?.actual_patient_id !== recap?.patient_id && (
                     <p className="text-xs text-slate-500 mt-1">
                        (Menggunakan paket milik: {recap?.package_owner_name || 'Sendiri'})
                     </p>
                )}
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-3 rounded-md">
                    <p className="text-xs text-slate-500 uppercase font-semibold mb-1">Layanan</p>
                    <p>{recap?.service_type || '-'}</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-md">
                    <p className="text-xs text-slate-500 uppercase font-semibold mb-1">Tipe Pasien</p>
                    <p>{recap?.patient_type || '-'}</p>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-3 rounded-md">
                    <p className="text-xs text-slate-500 uppercase font-semibold mb-1">Diagnosa</p>
                    <div className="flex flex-wrap gap-1">
                        {recap?.diagnosis ? (Array.isArray(recap.diagnosis) ? recap.diagnosis.join(', ') : JSON.stringify(recap.diagnosis)) : '-'}
                    </div>
                </div>
                <div className="bg-slate-50 p-3 rounded-md">
                    <p className="text-xs text-slate-500 uppercase font-semibold mb-1">Jenis Paket</p>
                    <p>{recap?.package_type || '-'}</p>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-3 rounded-md">
                     <p className="text-xs text-slate-500 uppercase font-semibold mb-1">Pembayaran</p>
            <p>{recap?.payment_method_name || recap?.payment_method || '-'}</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-md">
                     <p className="text-xs text-slate-500 uppercase font-semibold mb-1">Nominal</p>
                     <p>Rp {parseFloat(recap?.amount || 0).toLocaleString('id-ID')}</p>
                </div>
            </div>
            
            <div className="flex justify-end pt-4">
                <Button variant="outline" onClick={onClose}>Tutup</Button>
            </div>
        </div>
    );

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0">
                <DialogHeader className="px-6 py-4 border-b">
                    <div className="flex items-center justify-between">
                        <DialogTitle>Detail Daily Recap</DialogTitle>
                        {mode !== 'add' && (
                            <Tabs value={currentMode} onValueChange={setCurrentMode} className="w-[300px]">
                                <TabsList className="grid w-full grid-cols-3">
                                    <TabsTrigger value="view"><Eye className="w-3 h-3 mr-2"/> Lihat</TabsTrigger>
                                    <TabsTrigger value="edit"><Edit className="w-3 h-3 mr-2"/> Edit</TabsTrigger>
                                    <TabsTrigger value="delete" className="data-[state=active]:bg-red-50 data-[state=active]:text-red-600">
                                        <Trash2 className="w-3 h-3 mr-2"/> Hapus
                                    </TabsTrigger>
                                </TabsList>
                            </Tabs>
                        )}
                    </div>
                </DialogHeader>

                <ScrollArea className="flex-1 p-6">
                    {currentMode === 'view' && <ReadOnlyView />}
                    {(currentMode === 'edit' || currentMode === 'add') && (
                        <DailyRecapForm 
                            initialData={recap} 
                            mode={currentMode === 'add' ? 'add' : 'edit'}
                            onSuccess={() => { onSave(); onClose(); }}
                            onCancel={onClose}
                            onDelete={() => setShowDeleteConfirm(true)}
                        />
                    )}
                    {currentMode === 'delete' && (
                        <div className="text-center py-8">
                            <Trash2 className="w-12 h-12 text-red-100 bg-red-50 p-2 rounded-full mx-auto mb-4" />
                            <h3 className="text-lg font-medium text-slate-900 mb-2">Yakin hapus daily recap ini?</h3>
                            <p className="text-slate-500 text-sm mb-6 max-w-xs mx-auto">
                                Tindakan ini tidak dapat dibatalkan. Data yang dihapus akan hilang permanen.
                            </p>
                            <div className="flex justify-center gap-2">
                                <Button variant="outline" onClick={() => setCurrentMode('view')}>Batal</Button>
                                <Button variant="destructive" onClick={handleDelete}>Ya, Hapus Permanen</Button>
                            </div>
                        </div>
                    )}
                </ScrollArea>
                
                {/* Delete Confirmation Overlay for Edit Mode */}
                {showDeleteConfirm && (
                    <div className="absolute inset-0 bg-white/95 z-50 flex items-center justify-center backdrop-blur-sm animate-in fade-in">
                         <div className="text-center p-6 max-w-sm border rounded-lg shadow-lg bg-white">
                            <h3 className="font-semibold text-lg mb-2">Konfirmasi Hapus</h3>
                            <p className="text-slate-600 mb-4 text-sm">Anda yakin ingin menghapus data ini?</p>
                            <div className="flex gap-2 justify-center">
                                <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>Batal</Button>
                                <Button variant="destructive" onClick={handleDelete}>Hapus</Button>
                            </div>
                         </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
};

export default DailyRecapDetailModal;
