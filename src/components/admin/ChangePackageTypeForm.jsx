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
import { Label } from "@/components/ui/label";
import { Loader2 } from 'lucide-react';
import { updatePackageTracking } from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';

const ChangePackageTypeForm = ({ isOpen, onClose, packageData, onSuccess }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!packageData?.id) return;

    setLoading(true);
    try {
        // "updates package_type to 'Regular' in package_tracking and resets related fields"
        // Interpreting "resets related fields" as clearing session info since Regular isn't a package usually
        // or setting it to a state where it doesn't block future checks.
        
        const updates = {
            package_name: 'Regular', // As requested
            // We might want to set status to something that isn't 'expired' to stop the warning loop, 
            // but also implies it's no longer a tracked package in the traditional sense.
            // Or maybe just 'completed' so it doesn't show up as active/expired?
            // The prompt says "resets related fields".
            total_sessions: 0,
            sessions_remaining: 0,
            sessions_used: 0,
            status: 'completed', // Using 'completed' to effectively archive it
            updated_at: new Date().toISOString()
        };

        const { error } = await updatePackageTracking(packageData.id, updates);
        
        if (error) throw error;
        
        toast({ title: "Berhasil", description: "Paket diubah menjadi Regular." });
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
          <DialogTitle>Ganti ke Regular</DialogTitle>
          <DialogDescription>
            Ubah jenis paket ini menjadi "Regular". Ini akan menghentikan tracking paket.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
             <div className="bg-slate-50 p-3 rounded border text-sm space-y-1">
                <p><span className="font-medium">Paket Saat Ini:</span> {packageData?.package_name}</p>
                <p><span className="font-medium">Status:</span> {packageData?.status}</p>
            </div>
            
            <div className="p-3 bg-blue-50 text-blue-800 text-sm rounded">
                Konfirmasi perubahan ke tipe <strong>Regular</strong>?
            </div>

            <DialogFooter>
                <Button type="button" variant="outline" onClick={onClose}>Batal</Button>
                <Button type="submit" disabled={loading} className="bg-slate-700 hover:bg-slate-800 text-white">
                    {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Konfirmasi Ubah
                </Button>
            </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ChangePackageTypeForm;