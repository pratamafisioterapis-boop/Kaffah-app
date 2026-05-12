import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { getBankAccounts, createOwnerExpenditure, createOwnerIncome, createOwnerReceivable, getAccountingSubcategories } from '@/lib/api';
import { format } from 'date-fns';
import SearchableSelect from '@/components/ui/searchable-select';

const OwnerFinanceForm = ({ type, onSuccess, onCancel, dateRange }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  
  // Default date to today, or startDate if today is out of range (optional UX, usually just today)
  const defaultDate = new Date().toISOString().split('T')[0];

  const [formData, setFormData] = useState({
    date: defaultDate,
    category: '',
    sub_category: '', 
    bank_account_id: '',
    description: '',
    amount: '',
    // Receivables specific
    custom_name: '',
    status: 'Unpaid' 
  });

  useEffect(() => {
    const fetchData = async () => {
        const [banksRes, subsRes] = await Promise.all([
            getBankAccounts(),
            getAccountingSubcategories()
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
  categoryName: sub.parent_category?.category_name
})));
        }
    };
    fetchData();
  }, []);

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
        result = await createOwnerExpenditure(payload);
      } else if (type === 'income') {
        payload.category = formData.category;
        result = await createOwnerIncome(payload);
      } else if (type === 'receivable') {
        payload.custom_name = formData.custom_name;
        payload.status = formData.status;
        result = await createOwnerReceivable(payload);
      }

      if (result.error) throw result.error;

      toast({
        title: "Success",
        description: `Successfully created new ${type} record.`
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
    <Card className="border-0 shadow-none">
      <CardContent className="p-0">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div className="space-y-2">
               <Label>Date</Label>
               <Input 
                 type="date" 
                 name="date" 
                 value={formData.date} 
                 onChange={handleChange} 
                 required 
               />
             </div>
             
             <div className="space-y-2">
                <Label>Amount (IDR)</Label>
                <Input 
                  type="number" 
                  name="amount" 
                  value={formData.amount} 
                  onChange={handleChange} 
                  placeholder="0" 
                  required 
                />
             </div>
          </div>

          {type !== 'receivable' && (
            <>
              <div className="space-y-2">
                <Label>Sub Category *</Label>
                <SearchableSelect
                  options={subcategories}
                  value={formData.sub_category}
                  onChange={handleSubCategoryChange}
                  placeholder="Select sub category..."
                  allowCreate={false} 
                  notFoundText="No sub category found."
                />
              </div>

              <div className="space-y-2">
                <Label>Main Category (Auto-filled)</Label>
                <Input 
                  value={formData.category} 
                  readOnly 
                  className="bg-slate-50 text-slate-500 cursor-not-allowed"
                  placeholder="Main category will appear here..."
                />
              </div>
            </>
          )}

          {type === 'receivable' && (
             <div className="space-y-2">
               <Label>Debtor Name (Nama Peminjam)</Label>
               <Input 
                 name="custom_name" 
                 value={formData.custom_name} 
                 onChange={handleChange} 
                 placeholder="Enter name"
                 required 
               />
             </div>
          )}

          {type !== 'receivable' && (
             <div className="space-y-2">
               <Label>Bank Account (Optional)</Label>
               <SearchableSelect
                  options={bankAccounts}
                  value={formData.bank_account_id}
                  onChange={(val) => handleSelectChange('bank_account_id', val)}
                  placeholder="Select bank account..."
                  allowCreate={false}
               />
             </div>
          )}
          
          {type === 'receivable' && (
             <div className="space-y-2">
                <Label>Status</Label>
                <Select 
                  value={formData.status} 
                  onValueChange={(val) => handleSelectChange('status', val)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                     <SelectItem value="Unpaid">Unpaid</SelectItem>
                     <SelectItem value="Paid">Paid</SelectItem>
                  </SelectContent>
                </Select>
             </div>
          )}

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea 
              name="description" 
              value={formData.description} 
              onChange={handleChange} 
              placeholder="Enter details..." 
              rows={3} 
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
             <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
               Cancel
             </Button>
             <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white">
               {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
               Save Record
             </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default OwnerFinanceForm;