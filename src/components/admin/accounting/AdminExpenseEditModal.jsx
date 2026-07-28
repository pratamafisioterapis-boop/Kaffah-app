import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Save } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { updateAdminExpense, getAccountingCategories, getAccountingSubcategories, getBankAccounts } from '@/lib/api';

const AdminExpenseEditModal = ({ isOpen, onClose, expense, onSuccess }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState([]);
  const [subCategories, setSubCategories] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);

  const [formData, setFormData] = useState({
    transaction_date: '',
    input_time: '',
    category: '',
    sub_category: '',
    sub_category_id: '',
    bank_account_id: '',
    amount: '',
    description: ''
  });

  // Fetch options on mount
  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [catsRes, subCatsRes, banksRes] = await Promise.all([
          getAccountingCategories(),
          getAccountingSubcategories(),
          getBankAccounts()
        ]);
        
        if (catsRes.data) setCategories(catsRes.data);
        if (subCatsRes.data) setSubCategories(subCatsRes.data);
        if (banksRes.data) setBankAccounts(banksRes.data);
      } catch (error) {
        console.error("Failed to load options", error);
      }
    };
    if (isOpen) fetchOptions();
  }, [isOpen]);

  // Initialize form data when expense changes
  useEffect(() => {
    if (expense && isOpen) {
      setFormData({
        transaction_date: expense.transaction_date || '',
        input_time: expense.input_time ? expense.input_time.substring(0, 5) : '',
        category: expense.category || '',
        sub_category: expense.sub_category || '',
        sub_category_id: expense.sub_category_id || '',
        bank_account_id: expense.bank_account_id || '',
        amount: expense.amount || '',
        description: expense.description || ''
      });
    }
  }, [expense, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await updateAdminExpense(expense.id, {
        ...formData,
        bank_account_id: formData.bank_account_id === 'cash' || formData.bank_account_id === '' ? null : formData.bank_account_id,
        updated_at: new Date().toISOString()
      });

      if (error) throw error;

      toast({
        title: "Berhasil",
        description: "Data pengeluaran berhasil diperbarui.",
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

  const filteredSubCategories = subCategories.filter(
    sub => !formData.category || sub.parent_category?.category_name === formData.category
  );

  return (
    <Dialog open={isOpen} onOpenChange={(val) => !loading && onClose(val)}>
      <DialogContent className="sm:max-w-[500px] bg-white rounded-xl shadow-lg border-0">
        <DialogHeader className="border-b pb-4">
          <DialogTitle className="text-xl font-bold text-slate-800">Edit Pengeluaran</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-slate-500 uppercase">Tanggal</Label>
              <Input
                type="date"
                required
                value={formData.transaction_date}
                onChange={(e) => setFormData({...formData, transaction_date: e.target.value})}
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
            <Label className="text-xs font-semibold text-slate-500 uppercase">Kategori</Label>
            <Select 
              value={formData.category}
              onValueChange={(val) => setFormData({...formData, category: val, sub_category: '', sub_category_id: ''})}
            >
              <SelectTrigger className="bg-slate-50 border-slate-200">
                <SelectValue placeholder="Pilih Kategori" />
              </SelectTrigger>
              <SelectContent>
                {categories.map(cat => (
                  <SelectItem key={cat.id} value={cat.category_name}>{cat.category_name}</SelectItem>
                ))}
                {/* Fallback if category not in list */}
                {formData.category && !categories.find(c => c.category_name === formData.category) && (
                   <SelectItem value={formData.category}>{formData.category}</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold text-slate-500 uppercase">Sub Kategori</Label>
             <Select 
              value={formData.sub_category}
              onValueChange={(val) => {
                const match = filteredSubCategories.find(s => s.subcategory_name === val);
                setFormData({...formData, sub_category: val, sub_category_id: match?.id || null});
              }}
              disabled={!formData.category && filteredSubCategories.length === 0}
            >
              <SelectTrigger className="bg-slate-50 border-slate-200">
                <SelectValue placeholder="Pilih Sub Kategori" />
              </SelectTrigger>
              <SelectContent>
                {filteredSubCategories.map(sub => (
                  <SelectItem key={sub.id} value={sub.subcategory_name}>{sub.subcategory_name}</SelectItem>
                ))}
                 {formData.sub_category && !filteredSubCategories.find(s => s.subcategory_name === formData.sub_category) && (
                   <SelectItem value={formData.sub_category}>{formData.sub_category}</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold text-slate-500 uppercase">Akun Bank / Sumber Dana</Label>
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
              placeholder="Keterangan tambahan..."
            />
          </div>

          <DialogFooter className="pt-4 border-t gap-2">
            <Button type="button" variant="outline" onClick={() => onClose()} disabled={loading}>
              Batal
            </Button>
            <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white min-w-[100px]" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              Simpan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AdminExpenseEditModal;