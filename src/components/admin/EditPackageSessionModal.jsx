import React, { useState, useEffect } from 'react';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, AlertCircle, Save } from 'lucide-react';
import { updatePackageSessionsUsed } from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';

const EditPackageSessionModal = ({ isOpen, onClose, packageData, onSuccess }) => {
  const { toast } = useToast();
  const [sessionsUsed, setSessionsUsed] = useState(0);
  const [sessionsRemaining, setSessionsRemaining] = useState(0);
  const [totalSessions, setTotalSessions] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && packageData) {
      setSessionsUsed(packageData.sessions_used || 0);
      setSessionsRemaining(packageData.sessions_remaining || 0);
      setTotalSessions(packageData.total_sessions || 0);
      setError('');
    }
  }, [isOpen, packageData]);

  const handleUsedChange = (e) => {
    const val = e.target.value === '' ? '' : parseInt(e.target.value);
    setSessionsUsed(val);
    
    if (typeof val === 'number' && !isNaN(val)) {
        const newRemaining = totalSessions - val;
        setSessionsRemaining(newRemaining);
        validate(val, newRemaining);
    }
  };

  const handleRemainingChange = (e) => {
    const val = e.target.value === '' ? '' : parseInt(e.target.value);
    setSessionsRemaining(val);

    if (typeof val === 'number' && !isNaN(val)) {
        const newUsed = totalSessions - val;
        setSessionsUsed(newUsed);
        validate(newUsed, val);
    }
  };

  const validate = (used, remaining) => {
    if (used < 0 || remaining < 0) {
      setError('Jumlah sesi tidak boleh negatif.');
      return false;
    }
    if (used > totalSessions) {
        setError(`Terpakai (${used}) tidak boleh melebihi Total (${totalSessions}).`);
        return false;
    }
    if (used + remaining !== totalSessions) {
      setError(`Total sesi (${used + remaining}) harus sama dengan Total Paket (${totalSessions}).`);
      return false;
    }
    setError('');
    return true;
  };

  const handleSave = async () => {
    if (!validate(sessionsUsed, sessionsRemaining)) return;

    setLoading(true);
    try {
      const { error } = await updatePackageSessionsUsed(packageData.id, sessionsUsed, sessionsRemaining);
      if (error) throw error;
      
      toast({ title: "Berhasil", description: "Sesi paket berhasil diperbarui." });
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
       console.error(err);
       toast({ variant: "destructive", title: "Gagal", description: err.message || "Terjadi kesalahan saat menyimpan." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !loading && onClose(open)}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Sesi Paket</DialogTitle>
          <DialogDescription>
            Sesuaikan jumlah sesi terpakai dan sisa sesi secara manual.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          {error && (
             <Alert variant="destructive" className="py-2">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">{error}</AlertDescription>
             </Alert>
          )}

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="total" className="text-right text-slate-500">
              Total
            </Label>
            <Input
              id="total"
              value={totalSessions}
              disabled
              className="col-span-3 bg-slate-100 font-semibold"
            />
          </div>
          
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="used" className="text-right font-medium">
              Terpakai
            </Label>
            <Input
              id="used"
              type="number"
              value={sessionsUsed}
              onChange={handleUsedChange}
              className="col-span-3"
              disabled={loading}
              min="0"
            />
          </div>
          
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="remaining" className="text-right font-medium">
              Sisa
            </Label>
            <Input
              id="remaining"
              type="number"
              value={sessionsRemaining}
              onChange={handleRemainingChange}
              className="col-span-3"
              disabled={loading}
              min="0"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onClose()} disabled={loading}>
            Batal
          </Button>
          <Button onClick={handleSave} disabled={loading || !!error} className="bg-blue-600 hover:bg-blue-700">
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            Simpan Perubahan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditPackageSessionModal;