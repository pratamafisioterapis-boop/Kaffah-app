import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Loader2, Clock, Calendar, User } from 'lucide-react';
import { format } from 'date-fns';
import { formatTimeIndonesia, constructAppointmentDateTime } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';

const SetDailyRecapTimeModal = ({ 
    isOpen, 
    onClose, 
    onConfirm, 
    recap 
}) => {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');

    useEffect(() => {
        if (isOpen && recap) {
            // Initialize times if available, otherwise empty
            setStartTime(recap.start_time ? formatTimeIndonesia(recap.start_time) : '');
            setEndTime(recap.end_time ? formatTimeIndonesia(recap.end_time) : '');
        } else {
            setStartTime('');
            setEndTime('');
        }
    }, [isOpen, recap]);

    const handleConfirm = async () => {
        if (!startTime || !endTime) {
            toast({
                variant: "destructive",
                title: "Waktu Wajib Diisi",
                description: "Mohon isi jam mulai dan jam selesai."
            });
            return;
        }

        if (startTime >= endTime) {
            toast({
                variant: "destructive",
                title: "Waktu Tidak Valid",
                description: "Jam selesai harus lebih besar dari jam mulai."
            });
            return;
        }

        setLoading(true);
        try {
            // Construct full ISO strings combining recap date + time
            const fullStartTime = constructAppointmentDateTime(recap.recap_date, startTime);
            const fullEndTime = constructAppointmentDateTime(recap.recap_date, endTime);
            
            await onConfirm(recap.id, fullStartTime, fullEndTime);
            onClose();
        } catch (error) {
            console.error("Error setting time:", error);
            toast({
                variant: "destructive",
                title: "Gagal Menyimpan",
                description: error.message || "Terjadi kesalahan saat menyimpan waktu."
            });
        } finally {
            setLoading(false);
        }
    };

    if (!recap) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Set Waktu Appointment</DialogTitle>
                    <DialogDescription>
                        Atur waktu mulai dan selesai untuk data rekap ini.
                    </DialogDescription>
                </DialogHeader>

                <div className="bg-slate-50 p-4 rounded-lg space-y-3 mb-4 border border-slate-100">
                    <div className="flex items-center gap-2 text-sm text-slate-700">
                        <Calendar className="w-4 h-4 text-slate-400" />
                        <span className="font-medium">{format(new Date(recap.recap_date), 'dd MMMM yyyy')}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-700">
                        <User className="w-4 h-4 text-slate-400" />
                        <span>{recap.patients?.full_name || recap.guest_name || 'Pasien'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-700">
                        <span className="text-slate-400 w-4 text-center font-bold text-xs">Th</span>
                        <span>{recap.therapist_name || '-'}</span>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="start-time">Jam Mulai</Label>
                        <div className="relative">
                            <Clock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                            <Input 
                                id="start-time" 
                                type="time" 
                                className="pl-9"
                                value={startTime}
                                onChange={(e) => setStartTime(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="end-time">Jam Selesai</Label>
                        <div className="relative">
                            <Clock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                            <Input 
                                id="end-time" 
                                type="time" 
                                className="pl-9"
                                value={endTime}
                                onChange={(e) => setEndTime(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                <DialogFooter className="mt-4">
                    <Button variant="outline" onClick={onClose} disabled={loading}>
                        Batal
                    </Button>
                    <Button onClick={handleConfirm} disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white">
                        {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Simpan Waktu
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default SetDailyRecapTimeModal;