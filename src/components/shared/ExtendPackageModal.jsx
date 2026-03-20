import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import DatePicker from '@/components/DatePicker';
import { parseDateFromDisplay, formatDateDisplay } from '@/lib/dailyRecapHelpers';

const ExtendPackageModal = ({ open, onOpenChange, onExtend, isLoading }) => {
    const { toast } = useToast();
    const [newEndDate, setNewEndDate] = useState('');
    const [notes, setNotes] = useState('');
    const [showDatePicker, setShowDatePicker] = useState(false);

    const handleSubmit = () => {
        if (!newEndDate) {
            toast({ variant: "destructive", title: "Error", description: "Tanggal berakhir baru wajib diisi" });
            return;
        }

        const isoDate = parseDateFromDisplay(newEndDate);
        const today = new Date().toISOString().split('T')[0];

        if (isoDate <= today) {
             toast({ variant: "destructive", title: "Error", description: "Tanggal berakhir harus lebih besar dari hari ini" });
             return;
        }

        onExtend(isoDate, notes);
        // We don't clear form here, parent handles success/close
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md rounded-lg shadow-lg p-6">
                <DialogHeader>
                    <DialogTitle className="text-lg font-bold">Perpanjang Paket</DialogTitle>
                </DialogHeader>
                
                <div className="space-y-4 py-2">
                    <div className="space-y-2 relative">
                        <Label>Tanggal Berakhir Baru</Label>
                        <Input 
                            value={newEndDate}
                            onChange={(e) => setNewEndDate(e.target.value)}
                            onClick={() => setShowDatePicker(true)}
                            placeholder="dd/mm/yyyy"
                            className="w-full border-gray-300"
                        />
                        {showDatePicker && (
                            <div className="absolute top-full left-0 z-50 mt-1">
                                <DatePicker 
                                    value={parseDateFromDisplay(newEndDate)} 
                                    onChange={(iso) => {
                                        setNewEndDate(formatDateDisplay(iso));
                                        setShowDatePicker(false);
                                    }}
                                    onClose={() => setShowDatePicker(false)}
                                />
                            </div>
                        )}
                    </div>
                    
                    <div className="space-y-2">
                         <Label>Catatan (Opsional)</Label>
                         <Textarea 
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Alasan perpanjangan..."
                            className="w-full border-gray-300 min-h-[80px]"
                         />
                    </div>
                </div>

                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>Batal</Button>
                    <Button onClick={handleSubmit} disabled={isLoading} className="bg-blue-600 hover:bg-blue-700 text-white">
                        {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Simpan
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default ExtendPackageModal;