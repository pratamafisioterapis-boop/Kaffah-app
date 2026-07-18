import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2, Plus, Pencil, Trash2, Building, CreditCard, Percent, Info } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import {
  getBankAccountsWithBalance,
  createBankAccount,
  updateBankAccount,
  deleteBankAccount,
  getBankAccountFees,
  createBankAccountFee,
  updateBankAccountFee,
  deleteBankAccountFee,
  getOperationalOptions
} from '@/lib/api';
import { motion } from 'framer-motion';
import SearchableSelect from '@/components/ui/searchable-select';

const formatIDR = (amount) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount || 0);

const BankAccountForm = ({ initialData, onSuccess, onCancel }) => {
  const [formData, setFormData] = useState({
    bank_name: initialData?.bank_name || '',
    account_number: initialData?.account_number || '',
    holder_name: initialData?.holder_name || '',
    balance: initialData?.balance ?? initialData?.opening_balance ?? 0,
    account_type: initialData?.account_type || 'Checking'
  });
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      let result;
      if (initialData?.id) {
         result = await updateBankAccount(initialData.id, formData);
      } else {
         result = await createBankAccount(formData);
      }
      if (result.error) throw result.error;
      toast({ title: "Success", description: "Bank account saved successfully." });
      onSuccess();
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
         <div className="space-y-2">
            <Label>Bank Name</Label>
            <Input
              required
              value={formData.bank_name}
              onChange={e => setFormData({...formData, bank_name: e.target.value})}
              placeholder="e.g. BCA, Mandiri, CASH, QRIS Merchant"
              className="rounded-xl border-slate-200 focus:border-cyan-500 focus:ring-cyan-200"
            />
         </div>
         <div className="space-y-2">
            <Label>Account Number</Label>
            <Input
              value={formData.account_number}
              onChange={e => setFormData({...formData, account_number: e.target.value})}
              placeholder="1234567890"
              className="rounded-xl border-slate-200 focus:border-cyan-500 focus:ring-cyan-200 font-mono"
            />
         </div>
       </div>
       <div className="space-y-2">
          <Label>Account Holder Name</Label>
          <Input
            value={formData.holder_name}
            onChange={e => setFormData({...formData, holder_name: e.target.value})}
            placeholder="Name on card"
            className="rounded-xl border-slate-200 focus:border-cyan-500 focus:ring-cyan-200"
          />
       </div>
       <div className="space-y-2">
          <Label>Saldo Awal (Opening Balance)</Label>
          <Input
            type="number"
            value={formData.balance}
            onChange={e => setFormData({...formData, balance: e.target.value})}
            className="rounded-xl border-slate-200 focus:border-cyan-500 focus:ring-cyan-200 font-medium"
          />
          <p className="text-xs text-slate-400">Saldo sebelum sistem mulai mencatat transaksi. Saldo saat ini dihitung otomatis dari transaksi yang terhubung ke akun ini.</p>
       </div>
       <div className="flex justify-end gap-3 mt-6 pt-2 border-t border-slate-100">
          <Button type="button" variant="outline" onClick={onCancel} className="rounded-xl hover:bg-slate-50">Cancel</Button>
          <Button type="submit" disabled={loading} className="rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white">
            {loading ? <Loader2 className="w-4 h-4 animate-spin"/> : 'Save Account'}
          </Button>
       </div>
    </form>
  );
};

const FeeForm = ({ bankAccountId, initialData, paymentMethodOptions, onSuccess, onCancel }) => {
  const [form, setForm] = useState({
    payment_method: initialData?.payment_method || '',
    fee_type: initialData?.fee_type || 'percentage',
    fee_value: initialData?.fee_value ?? ''
  });
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.payment_method.trim()) {
      toast({ variant: "destructive", title: "Error", description: "Metode pembayaran wajib diisi." });
      return;
    }
    if (form.fee_value === '' || Number(form.fee_value) < 0) {
      toast({ variant: "destructive", title: "Error", description: "Nilai potongan tidak valid." });
      return;
    }
    setLoading(true);
    try {
      const payload = {
        bank_account_id: bankAccountId,
        payment_method: form.payment_method.trim(),
        fee_type: form.fee_type,
        fee_value: Number(form.fee_value)
      };
      const result = initialData?.id
        ? await updateBankAccountFee(initialData.id, payload)
        : await createBankAccountFee(payload);
      if (result.error) throw result.error;
      toast({ title: "Berhasil", description: "Aturan potongan disimpan." });
      onSuccess();
    } catch (error) {
      toast({ variant: "destructive", title: "Gagal", description: error.message || "Metode pembayaran ini mungkin sudah punya aturan potongan." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Metode Pembayaran</Label>
        <SearchableSelect
          options={paymentMethodOptions}
          value={form.payment_method}
          onChange={(val) => {
            const opt = paymentMethodOptions.find(o => o.value === val);
            setForm(prev => ({ ...prev, payment_method: opt?.label || val }));
          }}
          placeholder="Contoh: Qris"
          allowCreate={true}
        />
        <p className="text-xs text-slate-400">Misal: pasien bayar dengan QRIS, bank memotong biaya transaksi.</p>
      </div>

      <div className="space-y-2">
        <Label>Jenis Potongan</Label>
        <RadioGroup value={form.fee_type} onValueChange={(val) => setForm(prev => ({ ...prev, fee_type: val }))} className="flex gap-4">
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="percentage" id="fee-percentage" />
            <Label htmlFor="fee-percentage" className="font-normal cursor-pointer">Persentase (%)</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="fixed" id="fee-fixed" />
            <Label htmlFor="fee-fixed" className="font-normal cursor-pointer">Nominal (Rp)</Label>
          </div>
        </RadioGroup>
      </div>

      <div className="space-y-2">
        <Label>{form.fee_type === 'percentage' ? 'Persentase Potongan (%)' : 'Potongan (Rp)'}</Label>
        <Input
          type="number"
          min="0"
          step={form.fee_type === 'percentage' ? '0.01' : '1'}
          value={form.fee_value}
          onChange={e => setForm(prev => ({ ...prev, fee_value: e.target.value }))}
          placeholder={form.fee_type === 'percentage' ? 'Contoh: 0.7' : 'Contoh: 1500'}
        />
      </div>

      <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
        <Button type="button" variant="outline" onClick={onCancel} className="rounded-xl">Batal</Button>
        <Button type="submit" disabled={loading} className="rounded-xl bg-amber-600 hover:bg-amber-700 text-white">
          {loading ? <Loader2 className="w-4 h-4 animate-spin"/> : 'Simpan'}
        </Button>
      </div>
    </form>
  );
};

const FeeManagerDialog = ({ account, open, onOpenChange, paymentMethodOptions }) => {
  const [fees, setFees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingFee, setEditingFee] = useState(null);
  const { toast } = useToast();

  const fetchFees = async () => {
    if (!account?.bank_account_id) return;
    setLoading(true);
    const { data } = await getBankAccountFees(account.bank_account_id);
    setFees(data || []);
    setLoading(false);
  };

  useEffect(() => {
    if (open) fetchFees();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, account?.bank_account_id]);

  const handleDelete = async (id) => {
    if (!window.confirm("Hapus aturan potongan ini?")) return;
    const { error } = await deleteBankAccountFee(id);
    if (error) {
      toast({ variant: "destructive", title: "Gagal", description: "Gagal menghapus aturan." });
      return;
    }
    toast({ title: "Terhapus", description: "Aturan potongan dihapus." });
    fetchFees();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Percent className="w-5 h-5 text-amber-600" />
            Potongan Bank &bull; {account?.bank_name}
          </DialogTitle>
        </DialogHeader>

        {isFormOpen ? (
          <FeeForm
            bankAccountId={account?.bank_account_id}
            initialData={editingFee}
            paymentMethodOptions={paymentMethodOptions}
            onSuccess={() => { setIsFormOpen(false); setEditingFee(null); fetchFees(); }}
            onCancel={() => { setIsFormOpen(false); setEditingFee(null); }}
          />
        ) : (
          <div className="space-y-4">
            <div className="flex items-start gap-2 p-3 rounded-xl bg-blue-50 border border-blue-100 text-xs text-blue-700">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <p>Atur berapa persen atau berapa rupiah potongan bank untuk tiap metode pembayaran (mis. QRIS). Potongan ini otomatis dihitung saat mencatat pemasukan (daily recap pasien maupun pemasukan lainnya) yang memilih akun &amp; metode pembayaran ini.</p>
            </div>

            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-amber-500" /></div>
            ) : fees.length === 0 ? (
              <div className="text-center py-8 text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-sm">
                Belum ada aturan potongan untuk akun ini.
              </div>
            ) : (
              <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                {fees.map(fee => (
                  <div key={fee.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white">
                    <div>
                      <p className="text-sm font-semibold text-slate-700">{fee.payment_method}</p>
                      <p className="text-xs text-slate-500">
                        Potongan {fee.fee_type === 'percentage' ? `${fee.fee_value}%` : formatIDR(fee.fee_value)}
                        {!fee.is_active && <span className="ml-2 text-rose-500">(nonaktif)</span>}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-amber-600" onClick={() => { setEditingFee(fee); setIsFormOpen(true); }}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-red-600" onClick={() => handleDelete(fee.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <Button onClick={() => { setEditingFee(null); setIsFormOpen(true); }} className="w-full rounded-xl bg-amber-600 hover:bg-amber-700 text-white">
              <Plus className="w-4 h-4 mr-2" /> Tambah Aturan Potongan
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

const OwnerBankAccountManager = () => {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [feeAccount, setFeeAccount] = useState(null);
  const [isFeeDialogOpen, setIsFeeDialogOpen] = useState(false);
  const [paymentMethodOptions, setPaymentMethodOptions] = useState([]);
  const { toast } = useToast();

  const fetchAccounts = async () => {
    setLoading(true);
    const { data } = await getBankAccountsWithBalance();
    if (data) setAccounts(data);
    setLoading(false);
  };

  const fetchPaymentMethods = async () => {
    const { data } = await getOperationalOptions('payment_method');
    setPaymentMethodOptions((data || []).map(opt => ({ label: opt.label, value: opt.label })));
  };

  useEffect(() => {
    fetchAccounts();
    fetchPaymentMethods();
  }, []);

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this bank account?")) return;
    try {
      const { error } = await deleteBankAccount(id);
      if (error) throw error;
      toast({ title: "Success", description: "Account deleted." });
      fetchAccounts();
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to delete account." });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
         <div>
           <h3 className="text-xl font-bold text-teal-900">Bank Accounts</h3>
           <p className="text-teal-700/70">Kelola rekening bank/kas owner &amp; potongan biaya per metode pembayaran.</p>
         </div>
         <Button
            onClick={() => { setEditingAccount(null); setIsDialogOpen(true); }}
            className="bg-teal-600 hover:bg-teal-700 text-white rounded-xl shadow-lg shadow-teal-200 transition-all hover:-translate-y-0.5"
         >
           <Plus className="w-4 h-4 mr-2" /> Add Account
         </Button>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <Building className="w-5 h-5 text-teal-600" />
              {editingAccount ? 'Edit Account' : 'Add New Account'}
            </DialogTitle>
          </DialogHeader>
          <BankAccountForm
             initialData={editingAccount}
             onSuccess={() => { setIsDialogOpen(false); fetchAccounts(); }}
             onCancel={() => setIsDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <FeeManagerDialog
        account={feeAccount}
        open={isFeeDialogOpen}
        onOpenChange={setIsFeeDialogOpen}
        paymentMethodOptions={paymentMethodOptions}
      />

      {loading ? (
        <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-teal-500" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {accounts.length === 0 && (
             <div className="col-span-full py-12 text-center bg-white/50 border border-dashed border-teal-200 rounded-2xl">
                <CreditCard className="w-12 h-12 text-teal-200 mx-auto mb-3" />
                <p className="text-teal-600 font-medium">No bank accounts added yet.</p>
             </div>
          )}

          {accounts.map((acc, index) => (
             <motion.div
               key={acc.bank_account_id}
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               transition={{ delay: index * 0.1 }}
             >
               <Card className="card-premium relative overflow-hidden group border-0 ring-1 ring-slate-100">
                  <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-cyan-400 to-teal-500"></div>
                  <div className="absolute -right-6 -top-6 w-24 h-24 bg-teal-50 rounded-full opacity-50 group-hover:scale-150 transition-transform duration-500"></div>

                  <CardContent className="p-6 relative">
                     <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-teal-50 rounded-xl text-teal-600 shadow-sm">
                           <Building className="w-6 h-6" />
                        </div>
                        <div className="flex gap-1">
                           <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-amber-50 text-slate-400 hover:text-amber-600 rounded-lg" title="Potongan Bank" onClick={() => { setFeeAccount(acc); setIsFeeDialogOpen(true); }}>
                              <Percent className="w-4 h-4" />
                           </Button>
                           <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-teal-50 text-slate-400 hover:text-teal-600 rounded-lg" onClick={() => { setEditingAccount({ ...acc, id: acc.bank_account_id, balance: acc.opening_balance }); setIsDialogOpen(true); }}>
                              <Pencil className="w-4 h-4" />
                           </Button>
                           <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg" onClick={() => handleDelete(acc.bank_account_id)}>
                              <Trash2 className="w-4 h-4" />
                           </Button>
                        </div>
                     </div>

                     <h4 className="font-bold text-lg text-slate-800 mb-1">{acc.bank_name}</h4>
                     <p className="text-slate-500 text-sm font-mono bg-slate-50 inline-block px-2 py-0.5 rounded border border-slate-100 mb-5">
                       {acc.account_number || '-'}
                     </p>

                     <div className="flex justify-between items-end pt-4 border-t border-slate-50">
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Holder</p>
                          <p className="font-medium text-sm text-slate-700 truncate max-w-[120px]" title={acc.holder_name}>{acc.holder_name || '-'}</p>
                        </div>
                        <div className="text-right">
                           <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Saldo Saat Ini</p>
                           <p className={`font-bold text-lg tracking-tight ${acc.current_balance < 0 ? 'text-rose-600' : 'text-teal-600'}`}>
                             {formatIDR(acc.current_balance)}
                           </p>
                        </div>
                     </div>
                  </CardContent>
               </Card>
             </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default OwnerBankAccountManager;
