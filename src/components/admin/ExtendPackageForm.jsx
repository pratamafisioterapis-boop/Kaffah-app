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
import { updatePackageTrackingStatus } from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';

const ExtendPackageForm = ({ isOpen, onClose, packageData, onSuccess }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [extendedUntil, setExtendedUntil] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!packageData?.id || !extendedUntil) return;

    setLoading(true);
    try {
        const { error } = await updatePackageTrackingStatus(packageData.id, 'diperpanjang', extendedUntil);
        
        if (error) throw error;
        
        toast({ title: "Berhasil", description: "Paket berhasil diperpanjang." });
        onSuccess();
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
          <DialogTitle>Perpanjang Paket</DialogTitle>
          <DialogDescription>
            Tetapkan tanggal kadaluarsa baru untuk paket ini.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
            <div className="bg-slate-50 p-3 rounded border text-sm space-y-1">
                <p><span className="font-medium">Paket:</span> {packageData?.package_name}</p>
                <p><span className="font-medium">Expired Lama:</span> {packageData?.end_date || '-'}</p>
            </div>

            <div className="space-y-2">
                <Label>Perpanjang Hingga Tanggal</Label>
                <Input 
                    type="date" 
                    required 
                    value={extendedUntil} 
                    onChange={(e) => setExtendedUntil(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                />
            </div>

            <DialogFooter>
                <Button type="button" variant="outline" onClick={onClose}>Batal</Button>
                <Button type="submit" disabled={loading || !extendedUntil} className="bg-blue-600 hover:bg-blue-700">
                    {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Simpan Perubahan
                </Button>
            </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ExtendPackageForm;