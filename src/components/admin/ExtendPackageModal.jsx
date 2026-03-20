import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar as CalendarIcon, Loader2 } from 'lucide-react';
import { formatDateDisplay, parseDateFromDisplay } from '@/lib/dailyRecapHelpers';
import DatePicker from '@/components/DatePicker';

const ExtendPackageModal = ({ isOpen, onClose, onExtend, packageInfo }) => {
    const [expiredDate, setExpiredDate] = useState('');
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async () => {
        if (!expiredDate) return;
        setLoading(true);
        // Simulate delay or logic if needed, otherwise just call parent
        await onExtend(parseDateFromDisplay(expiredDate));
        setLoading(false);
        onClose();
    };

    const handleDateSelect = (isoDate) => {
        setExpiredDate(formatDateDisplay(isoDate));
        setShowDatePicker(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Perpanjang Masa Aktif Paket</DialogTitle>
                    <DialogDescription>
                        Perbarui tanggal kadaluarsa untuk paket ini.
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4 space-y-4">
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-sm space-y-2">
                        <div className="flex justify-between">
                            <span className="text-slate-500">Nama Paket:</span>
                            <span className="font-medium">{packageInfo?.package_type || '-'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-500">Sesi Terpakai:</span>
                            <span className="font-medium">{packageInfo?.sessions_used || 0} / {packageInfo?.total_sessions || 0}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-500">Berakhir Pada:</span>
                            <span className="font-medium text-red-600">{formatDateDisplay(packageInfo?.end_date)}</span>
                        </div>
                    </div>

                    <div className="space-y-2 relative">
                        <Label>Tanggal Berakhir Baru</Label>
                        <div className="flex gap-2">
                            <Input 
                                value={expiredDate}
                                onChange={(e) => setExpiredDate(e.target.value)}
                                placeholder="dd/mm/yyyy"
                            />
                            <Button 
                                variant="outline"
                                onClick={() => setShowDatePicker(!showDatePicker)}
                            >
                                <CalendarIcon className="w-4 h-4" />
                            </Button>
                        </div>
                        {showDatePicker && (
                            <div className="absolute top-full left-0 z-50 mt-1">
                                <DatePicker 
                                    value={parseDateFromDisplay(expiredDate)} 
                                    onChange={handleDateSelect}
                                    onClose={() => setShowDatePicker(false)}
                                />
                            </div>
                        )}
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={loading}>Batal</Button>
                    <Button onClick={handleSubmit} disabled={!expiredDate || loading} className="bg-blue-600 text-white hover:bg-blue-700">
                        {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Simpan Perubahan
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default ExtendPackageModal;