import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Save } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { updateAdminIncome, getAccountingSubcategories, getBankAccounts } from '@/lib/api';

const AdminIncomeEditModal = ({ isOpen, onClose, income, onSuccess }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const incomeSources = ['Layanan Medis', 'Penjualan Produk', 'Investasi', 'Lain-lain'];
  
  const [subCategories, setSubCategories] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);

  const [formData, setFormData] = useState({
    date: '',
    input_time: '',
    category: '',
    sub_category: '',
    bank_account_id: '',
    amount: '',
    description: ''
  });

  // Fetch options
  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [subCatsRes, banksRes] = await Promise.all([
          getAccountingSubcategories(),
          getBankAccounts()
        ]);
        if (subCatsRes.data) setSubCategories(subCatsRes.data);
        if (banksRes.data) setBankAccounts(banksRes.data);
      } catch (error) {
        console.error("Failed to load options", error);
      }
    };
    if (isOpen) fetchOptions();
  }, [isOpen]);

  // Init Data
  useEffect(() => {
    if (income && isOpen) {
      setFormData({
        date: income.date || '',
        input_time: income.input_time ? income.input_time.substring(0, 5) : '',
        category: income.category || '',
        sub_category: income.sub_category || '',
        bank_account_id: income.bank_account_id || '',
        amount: income.amount || '',
        description: income.description || ''
      });
    }
  }, [income, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await updateAdminIncome(income.id, {
        ...formData,
        bank_account_id: formData.bank_account_id === 'cash' || formData.bank_account_id === '' ? null : formData.bank_account_id,
        updated_at: new Date().toISOString()
      });

      if (error) throw error;

      toast({
        title: "Berhasil",
        description: "Data pemasukan berhasil diperbarui.",
        variant: "default",
        className: "bg-green-50 border-green-200 text-green-900"
      });
      
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error(error);
      toast({
        title: "Gagal",
        description: "Terjadi kesalahan saat menyimpan perubahan.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(val) => !loading && onClose(val)}>
      <DialogContent className="sm:max-w-[500px] bg-white rounded-xl shadow-lg border-0">
        <DialogHeader className="border-b pb-4">
          <DialogTitle className="text-xl font-bold text-slate-800">Edit Pemasukan</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-slate-500 uppercase">Tanggal</Label>
              <Input
                type="date"
                required
                value={formData.date}
                onChange={(e) => setFormData({...formData, date: e.target.value})}
                className="bg-slate-50 border-slate-200 focus:bg-white transition-colors"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-slate-500 uppercase">Waktu</Label>
              <Input
                type="time"
                value={formData.input_time}
                onChange={(e) => setFormData({...formData, input_time: e.target.value})}
                className="bg-slate-50 border-slate-200 focus:bg-white transition-colors"
              />
            </div>
          </div>

          <div className="space-y-2">
             <Label className="text-xs font-semibold text-slate-500 uppercase">Jumlah (Rp)</Label>
              <Input
                type="number"
                required
                min="0"
                value={formData.amount}
                onChange={(e) => setFormData({...formData, amount: e.target.value})}
                className="bg-slate-50 border-slate-200 focus:bg-white transition-colors font-mono font-medium"
              />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold text-slate-500 uppercase">Sumber Pemasukan</Label>
            <Select
              value={formData.category}
              onValueChange={(val) => setFormData({...formData, category: val})}
            >
              <SelectTrigger className="bg-slate-50 border-slate-200">
                <SelectValue placeholder="Pilih Sumber" />
              </SelectTrigger>
              <SelectContent>
                {incomeSources.map(src => (
                  <SelectItem key={src} value={src}>{src}</SelectItem>
                ))}
                 {/* Fallback if category not in list */}
                 {formData.category && !incomeSources.includes(formData.category) && (
                   <SelectItem value={formData.category}>{formData.category}</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold text-slate-500 uppercase">Sub Kategori</Label>
             <Select 
              value={formData.sub_category} 
              onValueChange={(val) => setFormData({...formData, sub_category: val})}
            >
              <SelectTrigger className="bg-slate-50 border-slate-200">
                <SelectValue placeholder="Pilih Sub Kategori (Opsional)" />
              </SelectTrigger>
              <SelectContent>
                {subCategories.map(sub => (
                  <SelectItem key={sub.id} value={sub.subcategory_name}>{sub.subcategory_name}</SelectItem>
                ))}
                 {formData.sub_category && !subCategories.find(s => s.subcategory_name === formData.sub_category) && (
                   <SelectItem value={formData.sub_category}>{formData.sub_category}</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold text-slate-500 uppercase">Masuk ke Akun</Label>
            <Select 
              value={formData.bank_account_id || "cash"} 
              onValueChange={(val) => setFormData({...formData, bank_account_id: val === "cash" ? "" : val})}
            >
              <SelectTrigger className="bg-slate-50 border-slate-200">
                <SelectValue placeholder="Pilih Akun Bank" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Tunai / Lainnya</SelectItem>
                {bankAccounts.map(acc => (
                  <SelectItem key={acc.id} value={acc.id}>{acc.bank_name} - {acc.account_number}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold text-slate-500 uppercase">Deskripsi</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              className="bg-slate-50 border-slate-200 focus:bg-white min-h-[80px]"
              placeholder="Keterangan..."
            />
          </div>

          <DialogFooter className="pt-4 border-t gap-2">
            <Button type="button" variant="outline" onClick={() => onClose()} disabled={loading}>
              Batal
            </Button>
            <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white min-w-[100px]" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              Simpan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AdminIncomeEditModal;