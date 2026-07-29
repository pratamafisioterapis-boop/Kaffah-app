import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { getBankAccounts, getBankAccountFees, getOperationalOptions, createOwnerExpenditure, createOwnerIncome, createOwnerReceivable, updateOwnerExpenditure, updateOwnerIncome, getAccountingSubcategories } from '@/lib/api';
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

const OwnerFinanceForm = ({ type, onSuccess, onCancel, dateRange, editRecord }) => {
  const isPWA =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true ||
    document.referrer.includes('android-app://');
  const { toast } = useToast();
  const isEditing = !!editRecord;
  const [loading, setLoading] = useState(false);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [bankFees, setBankFees] = useState([]);

  // Default date to today, or startDate if today is out of range (optional UX, usually just today)
  const defaultDate = new Date().toISOString().split('T')[0];

  const [formData, setFormData] = useState({
    date: editRecord?.date || defaultDate,
    category: editRecord?.category || '',
    sub_category: editRecord?.sub_category || '',
    bank_account_id: editRecord?.bank_account_id || '',
    payment_method: editRecord?.payment_method || '',
    description: editRecord?.description || '',
    amount: editRecord?.amount ?? '',
    // Receivables specific
    custom_name: editRecord?.custom_name || ''
  });

  useEffect(() => {
    const fetchData = async () => {
        const [banksRes, subsRes, paymentRes, feesRes] = await Promise.all([
            getBankAccounts(),
            getAccountingSubcategories(),
            getOperationalOptions('payment_method'),
            getBankAccountFees()
        ]);

        if (banksRes.data) {
          setBankAccounts(banksRes.data.map(acc => ({
            label: `${acc.bank_name} - ${acc.account_number}`,
            value: acc.id
          })));
        }

        if (subsRes.data) {
          setSubcategories(subsRes.data
            .filter(sub => sub.subcategory_name) // Filter out empty names
            .map(sub => ({
  label: sub.subcategory_name,
  value: sub.id, // ✅ gunakan UUID asli
  description: `Kategori: ${sub.parent_category?.category_name || 'N/A'}`,
  categoryName: sub.parent_category?.category_name,
  categoryType: sub.parent_category?.type
})));
        }

        if (paymentRes.data) {
          setPaymentMethods(paymentRes.data.map(opt => ({ label: opt.label, value: opt.label })));
        }

        if (feesRes.data) {
          setBankFees(feesRes.data);
        }
    };
    fetchData();
  }, []);

  const visibleSubcategories = useMemo(() => {
    const wantedType = type === 'income' ? 'income' : 'expense';
    return type === 'receivable'
      ? subcategories
      : subcategories.filter(sub => sub.categoryType === wantedType);
  }, [subcategories, type]);

  const feePreview = type === 'income'
    ? computeFeePreview(bankFees, formData.bank_account_id, formData.payment_method, formData.amount)
    : null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubCategoryChange = (val) => {
    // Find the selected subcategory object to get parent category
    const selected = subcategories.find(opt => opt.value === val);
    
    setFormData(prev => ({
      ...prev,
      sub_category: val,
      category: selected ? selected.categoryName : prev.category // Auto-fill category if found
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Capture current time for input_time
      const currentTime = format(new Date(), 'HH:mm:ss');
if (
  type !== 'receivable' &&
  (!formData.sub_category || formData.sub_category.trim() === '')
) {
  toast({
    variant: "destructive",
    title: "Error",
    description: "Sub Category wajib dipilih."
  });
  setLoading(false);
  return;
}
      const payload = {
  date: formData.date,
  description: formData.description,
  amount: Number(formData.amount),
  input_time: currentTime,
  sub_category: formData.sub_category
};

      // Add bank account if selected
      if (formData.bank_account_id) {
          payload.bank_account_id = formData.bank_account_id;
      }

      let result;

      if (type === 'expenditure') {
        payload.category = formData.category;
        result = isEditing
          ? await updateOwnerExpenditure(editRecord.id, payload)
          : await createOwnerExpenditure(payload);
      } else if (type === 'income') {
        payload.category = formData.category;
        if (formData.payment_method) {
          payload.payment_method = formData.payment_method;
        }
        result = isEditing
          ? await updateOwnerIncome(editRecord.id, payload)
          : await createOwnerIncome(payload);
      } else if (type === 'receivable') {
        payload.custom_name = formData.custom_name;
        result = await createOwnerReceivable(payload);
      }

      if (result.error) throw result.error;

      toast({
        title: "Success",
        description: isEditing
          ? `Successfully updated ${type} record.`
          : `Successfully created new ${type} record.`
      });
      
      onSuccess?.();
    } catch (error) {
      console.error("Submission error:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to save record."
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">

      {/* Tanggal + Jumlah */}
      <div className={isPWA ? "flex flex-col gap-3" : "grid grid-cols-2 gap-3"}>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-600">Tanggal</label>
          <Input type="date" name="date" value={formData.date} onChange={handleChange} required
            className="h-9 text-sm rounded-xl border-slate-200" />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-600">Jumlah (IDR)</label>
          <Input type="number" name="amount" value={formData.amount} onChange={handleChange} placeholder="0" required
            className="h-9 text-sm rounded-xl border-slate-200" />
        </div>
      </div>

      {type !== 'receivable' && (
        <>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600">
              Sub Kategori <span className="text-red-400">*</span>
            </label>
            <SearchableSelect
              options={visibleSubcategories}
              value={formData.sub_category}
              onChange={handleSubCategoryChange}
              placeholder="Pilih sub kategori..."
              allowCreate={false}
              notFoundText="Sub kategori tidak ditemukan."
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600">Kategori Utama</label>
            <div className="h-9 px-3 flex items-center rounded-xl text-sm text-slate-400"
              style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              {formData.category || 'Otomatis terisi setelah pilih sub kategori'}
            </div>
          </div>
        </>
      )}

      {type === 'receivable' && (
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-600">
            Nama Peminjam <span className="text-red-400">*</span>
          </label>
          <Input name="custom_name" value={formData.custom_name} onChange={handleChange}
            placeholder="Masukkan nama..." required
            className="h-9 text-sm rounded-xl border-slate-200" />
        </div>
      )}

      {type !== 'receivable' && (
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-600">
            Akun Bank <span className="text-slate-400 font-normal">(opsional)</span>
          </label>
          <SearchableSelect
            options={bankAccounts}
            value={formData.bank_account_id}
            onChange={(val) => handleSelectChange('bank_account_id', val)}
            placeholder="Pilih akun bank..."
            allowCreate={false}
          />
        </div>
      )}

      {type === 'income' && (
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-600">
            Metode Pembayaran <span className="text-slate-400 font-normal">(opsional)</span>
          </label>
          <SearchableSelect
            options={paymentMethods}
            value={formData.payment_method}
            onChange={(val) => {
              const opt = paymentMethods.find(o => o.value === val);
              handleSelectChange('payment_method', opt?.label || val);
            }}
            placeholder="Pilih metode pembayaran..."
            allowCreate={true}
          />
          {feePreview && (
            <p className="text-[11px] text-amber-600">
              Potongan bank ({feePreview.rule.fee_type === 'percentage' ? `${feePreview.rule.fee_value}%` : `Rp${feePreview.rule.fee_value}`}): {new Intl.NumberFormat('id-ID').format(feePreview.fee)} &bull; Bersih: Rp{new Intl.NumberFormat('id-ID').format(feePreview.net)}
            </p>
          )}
        </div>
      )}

      {type === 'receivable' && (
        <p className="text-[11px] text-slate-400 -mt-1">Piutang baru otomatis berstatus "Belum Lunas". Tandai lunas dari daftar piutang setelah dibayar.</p>
      )}

      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-slate-600">Deskripsi</label>
        <Textarea name="description" value={formData.description} onChange={handleChange}
          placeholder="Masukkan keterangan..." rows={3}
          className="text-sm rounded-xl border-slate-200 resize-none" />
      </div>

      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onCancel} disabled={loading}
          className="flex-1 h-9 rounded-xl text-xs font-semibold transition-all"
          style={{ background: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0' }}>
          Batal
        </button>
        <button type="submit" disabled={loading}
          className="flex-1 h-9 rounded-xl text-xs font-bold text-white transition-all flex items-center justify-center gap-2"
          style={{ background: type === 'expenditure' ? '#e11d48' : type === 'income' ? '#059669' : '#0891b2' }}>
          {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {loading ? 'Menyimpan...' : (isEditing ? 'Simpan Perubahan' : 'Simpan')}
        </button>
      </div>
    </form>
  );
};

export default OwnerFinanceForm;