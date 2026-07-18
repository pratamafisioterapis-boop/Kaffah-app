import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Loader2 } from 'lucide-react';
import { createAdminIncome, updateAdminIncome, getAccountingSubcategories, getBankAccounts, getBankAccountFees, getOperationalOptions } from '@/lib/api';
import { format } from 'date-fns';
import SearchableSelect from '@/components/ui/searchable-select';

const computeFeePreview = (fees, bankAccountId, paymentMethod, amount) => {
  if (!bankAccountId || !paymentMethod || !amount) return null;
  const rule = (fees || []).find(f =>
    f.bank_account_id === bankAccountId &&
    f.is_active &&
    (f.payment_method || '').toLowerCase() === paymentMethod.toLowerCase()
  );
  if (!rule) return null;
  const fee = rule.fee_type === 'percentage'
    ? Math.round((Number(amount) || 0) * rule.fee_value / 100)
    : Math.min(rule.fee_value, Number(amount) || 0);
  return { fee, net: (Number(amount) || 0) - fee, rule };
};

const AdminIncomeForm = ({ onSuccess, onCancel, initialData = null }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [subcategories, setSubcategories] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [bankFees, setBankFees] = useState([]);

  const isEditMode = !!initialData;

  const [form, setForm] = useState({
    amount: '',
    category: '',
    sub_category: '',
    description: '',
    transaction_date: format(new Date(), 'yyyy-MM-dd'),
    bank_account_id: '',
    payment_method: ''
  });

  useEffect(() => {
    fetchSubcategories();
    fetchBankAccounts();
    fetchPaymentMethods();
    fetchBankFees();
  }, []);

  // Populate form immediately when initialData changes
  useEffect(() => {
    if (initialData) {
      setForm({
        amount: initialData.amount || '',
        category: initialData.category || '',
        sub_category: initialData.sub_category || '',
        description: initialData.description || '',
        transaction_date: initialData.transaction_date || format(new Date(), 'yyyy-MM-dd'),
        bank_account_id: initialData.bank_account_id || '',
        payment_method: initialData.payment_method || ''
      });
    }
  }, [initialData]);

  const fetchSubcategories = async () => {
    try {
      const { data, error } = await getAccountingSubcategories();
      if (error) throw error;
      if (data) {
        const mappedSubcats = data
          .filter(sub => sub.subcategory_name) // Filter out empty names
          .map(sub => ({
            label: sub.subcategory_name,
            value: sub.subcategory_name,
            description: `Kategori: ${sub.parent_category?.category_name || 'N/A'}`,
            categoryName: sub.parent_category?.category_name
          }));
        console.log("[AdminIncomeForm] Loaded Subcategories:", mappedSubcats.length);
        setSubcategories(mappedSubcats);
      }
    } catch (err) {
      console.error("Failed to fetch subcategories:", err);
      toast({ variant: "destructive", title: "Error", description: "Failed to load categories." });
    }
  };

  const fetchBankAccounts = async () => {
    try {
      const { data, error } = await getBankAccounts();
      if (error) throw error;
      if (data) {
        setBankAccounts(data.map(bank => ({
          label: `${bank.bank_name} - ${bank.account_number} (${bank.holder_name})`,
          value: bank.id
        })));
      }
    } catch (err) {
      console.error("Failed to fetch bank accounts:", err);
      toast({ variant: "destructive", title: "Error", description: "Failed to load bank accounts." });
    }
  };

  const fetchPaymentMethods = async () => {
    const { data } = await getOperationalOptions('payment_method');
    setPaymentMethods((data || []).map(opt => ({ label: opt.label, value: opt.label })));
  };

  const fetchBankFees = async () => {
    const { data } = await getBankAccountFees();
    setBankFees(data || []);
  };

  const feePreview = computeFeePreview(bankFees, form.bank_account_id, form.payment_method, form.amount);

  const handleSubCategoryChange = (val) => {
    const selected = subcategories.find(opt => opt.value === val);
    
    setForm(prev => ({
      ...prev,
      sub_category: val,
      source: selected ? selected.categoryName : prev.source 
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.amount || !form.source || !form.sub_category || !form.transaction_date || !form.bank_account_id) {
      toast({ variant: "destructive", title: "Missing Fields", description: "Please fill in all required fields including Bank Account." });
      return;
    }

    setLoading(true);

    try {
      if (isEditMode) {
        const { error } = await updateAdminIncome(initialData.id, form);
        if (error) throw error;
        toast({ title: "Income Updated", description: "Income record updated successfully." });
      } else {
        const currentTime = format(new Date(), 'HH:mm:ss');
        const payload = {
  ...form,
  category: form.source, // 🔥 INI FIX NYA
  input_time: currentTime
};
        const { error } = await createAdminIncome(payload);
        if (error) throw error;
        toast({ title: "Income Recorded", description: "Successfully added new income record." });
      }

      if (!isEditMode) {
        setForm({
          amount: '',
          category: '',
          sub_category: '',
          description: '',
          transaction_date: format(new Date(), 'yyyy-MM-dd'),
          bank_account_id: ''
        });
      }

      if (onSuccess) onSuccess();

    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: error.message || "Failed to save income." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={`space-y-4 ${!isEditMode ? 'bg-white p-6 rounded-xl border border-slate-200' : ''}`}>
      {!isEditMode && <h3 className="text-lg font-semibold text-slate-900 mb-4">Record Income</h3>}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="income-date">Date</Label>
          <Input 
            id="income-date" 
            type="date" 
            value={form.transaction_date}
            onChange={(e) => setForm({...form, transaction_date: e.target.value})}
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="income-amount">Amount (IDR)</Label>
          <Input 
            id="income-amount" 
            type="number" 
            placeholder="0"
            value={form.amount}
            onChange={(e) => setForm({...form, amount: e.target.value})}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="sub_category">Sub Category</Label>
        <SearchableSelect
          options={subcategories}
          value={form.sub_category}
          onChange={handleSubCategoryChange}
          placeholder="Select sub category..."
          allowCreate={false}
          notFoundText="No sub category found."
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="source">Main Category (Auto-filled)</Label>
        <Input 
          id="source" 
          value={form.category}
          readOnly
          className="bg-slate-50 text-slate-500 cursor-not-allowed"
          placeholder="Main category will appear here..."
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="bank_account">Bank Account</Label>
        <SearchableSelect
          options={bankAccounts}
          value={form.bank_account_id}
          onChange={(val) => setForm({...form, bank_account_id: val})}
          placeholder="Select bank account..."
          allowCreate={false}
          notFoundText="No bank account found."
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="payment_method">Metode Pembayaran <span className="text-slate-400 font-normal">(opsional)</span></Label>
        <SearchableSelect
          options={paymentMethods}
          value={form.payment_method}
          onChange={(val) => {
            const opt = paymentMethods.find(o => o.value === val);
            setForm({...form, payment_method: opt?.label || val});
          }}
          placeholder="Pilih metode pembayaran..."
          allowCreate={true}
        />
        {feePreview && (
          <p className="text-xs text-amber-600">
            Potongan bank ({feePreview.rule.fee_type === 'percentage' ? `${feePreview.rule.fee_value}%` : `Rp${feePreview.rule.fee_value}`}): {new Intl.NumberFormat('id-ID').format(feePreview.fee)} &bull; Bersih diterima: Rp{new Intl.NumberFormat('id-ID').format(feePreview.net)}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="income-desc">Description</Label>
        <Input 
          id="income-desc" 
          placeholder="Enter description..."
          value={form.description}
          onChange={(e) => setForm({...form, description: e.target.value})}
        />
      </div>

      <div className="flex gap-3 pt-2">
        {isEditMode && (
          <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={loading} className={`flex-1 ${isEditMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700'}`}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          {isEditMode ? 'Save Changes' : 'Record Income'}
        </Button>
      </div>
    </form>
  );
};

export default AdminIncomeForm;