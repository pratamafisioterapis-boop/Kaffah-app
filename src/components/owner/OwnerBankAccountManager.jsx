import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, Plus, Pencil, Trash2, Building, CreditCard } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { getBankAccounts, createBankAccount, updateBankAccount, deleteBankAccount } from '@/lib/api';
import { motion } from 'framer-motion';

const BankAccountForm = ({ initialData, onSuccess, onCancel }) => {
  const [formData, setFormData] = useState({
    bank_name: initialData?.bank_name || '',
    account_number: initialData?.account_number || '',
    holder_name: initialData?.holder_name || '',
    balance: initialData?.balance || 0,
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
              placeholder="e.g. BCA, Mandiri"
              className="rounded-xl border-slate-200 focus:border-cyan-500 focus:ring-cyan-200"
            />
         </div>
         <div className="space-y-2">
            <Label>Account Number</Label>
            <Input 
              required 
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
            required 
            value={formData.holder_name} 
            onChange={e => setFormData({...formData, holder_name: e.target.value})} 
            placeholder="Name on card"
            className="rounded-xl border-slate-200 focus:border-cyan-500 focus:ring-cyan-200"
          />
       </div>
       <div className="space-y-2">
          <Label>Initial Balance</Label>
          <Input 
            type="number"
            value={formData.balance} 
            onChange={e => setFormData({...formData, balance: e.target.value})} 
            className="rounded-xl border-slate-200 focus:border-cyan-500 focus:ring-cyan-200 font-medium"
          />
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

const OwnerBankAccountManager = () => {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const { toast } = useToast();

  const fetchAccounts = async () => {
    setLoading(true);
    const { data } = await getBankAccounts();
    if (data) setAccounts(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchAccounts();
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
           <p className="text-teal-700/70">Manage your connected bank accounts.</p>
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
               key={acc.id}
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
                           <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-teal-50 text-slate-400 hover:text-teal-600 rounded-lg" onClick={() => { setEditingAccount(acc); setIsDialogOpen(true); }}>
                              <Pencil className="w-4 h-4" />
                           </Button>
                           <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg" onClick={() => handleDelete(acc.id)}>
                              <Trash2 className="w-4 h-4" />
                           </Button>
                        </div>
                     </div>
                     
                     <h4 className="font-bold text-lg text-slate-800 mb-1">{acc.bank_name}</h4>
                     <p className="text-slate-500 text-sm font-mono bg-slate-50 inline-block px-2 py-0.5 rounded border border-slate-100 mb-5">
                       {acc.account_number}
                     </p>
                     
                     <div className="flex justify-between items-end pt-4 border-t border-slate-50">
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Holder</p>
                          <p className="font-medium text-sm text-slate-700 truncate max-w-[120px]" title={acc.holder_name}>{acc.holder_name}</p>
                        </div>
                        <div className="text-right">
                           <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Balance</p>
                           <p className="font-bold text-lg text-teal-600 tracking-tight">
                             {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(acc.balance || 0)}
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