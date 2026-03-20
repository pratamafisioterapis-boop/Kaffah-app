import React, { useState } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from 'lucide-react';
import { updatePackageTracking } from '@/lib/api'; // We use updatePackageTracking directly
import { useToast } from '@/components/ui/use-toast';

const ChangePackageNominalForm = ({ isOpen, onClose, packageData, onSuccess }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [newAmount, setNewAmount] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!packageData?.id) return;

    setLoading(true);
    try {
        // Reset sessions and update status to active
        // NOTE: The prompt implies updating daily_recaps OR package_tracking with amount.
        // Package tracking typically stores usage, not price history per se (except maybe daily_recap does).
        // But the prompt says "resets sessions_remaining". 
        // We will reset the package tracking so it can be used again.
        
        const updates = {
            sessions_used: 0,
            sessions_remaining: packageData.total_sessions, // Reset to full
            status: 'aktif',
            // If the DB supports storing the price on package tracking, we'd update it here.
            // Since standard structure might not, we assume this action enables the package
            // and the user will enter the nominal in the DailyRecap form separately or we just reset here.
            updated_at: new Date().toISOString()
        };

        const { error } = await updatePackageTracking(packageData.id, updates);
        
        if (error) throw error;
        
        toast({ title: "Berhasil", description: "Paket di-reset dengan status Aktif." });
        
        // Pass the amount back if needed, but primarily we reset the package
        onSuccess(newAmount); 
        onClose();
    } catch (err) {
        toast({ variant: "destructive", title: "Gagal", description: err.message });
    } finally {
        setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ganti Nominal (Reset Paket)</DialogTitle>
          <DialogDescription>
            Tindakan ini akan me-reset jumlah sesi terpakai menjadi 0 dan mengaktifkan kembali paket.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
             <div className="bg-slate-50 p-3 rounded border text-sm space-y-1">
                <p><span className="font-medium">Paket:</span> {packageData?.package_name}</p>
                <p><span className="font-medium">Total Sesi:</span> {packageData?.total_sessions}</p>
            </div>

            <div className="space-y-2">
                <Label>Nominal Baru (Opsional - untuk catatan)</Label>
                <Input 
                    type="number" 
                    placeholder="Masukkan nominal jika ada pembayaran baru"
                    value={newAmount} 
                    onChange={(e) => setNewAmount(e.target.value)}
                />
            </div>

            <DialogFooter>
                <Button type="button" variant="outline" onClick={onClose}>Batal</Button>
                <Button type="submit" disabled={loading} className="bg-green-600 hover:bg-green-700">
                    {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Reset & Aktifkan
                </Button>
            </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ChangePackageNominalForm;