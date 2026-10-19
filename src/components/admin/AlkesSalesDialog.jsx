import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, Receipt, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getPatients } from '@/lib/api';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import SearchableSelect from '@/components/ui/searchable-select';
import RecapInvoiceItems, { itemsNetTotal } from '@/components/shared/RecapInvoiceItems';
import AlkesInvoiceModal from './AlkesInvoiceModal';

const PAYMENT_METHODS = ['Cash', 'Qris', 'Transfer', 'Debit', 'Credit'];

const todayWITA = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Makassar', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

const idr = (v) => `Rp ${Math.round(Number(v) || 0).toLocaleString('id-ID')}`;

// Penjualan alkes ke pasien (mis. pasien paket beli alat di sesi ke-3/4).
// Dicatat terpisah dari rekap harian: tidak memotong kuota paket dan tidak
// dihitung ke insentif terapis. Invoice bisa dicetak / diunduh kapan saja.
const AlkesSalesDialog = ({ isOpen, onClose }) => {
  const { userDetails } = useAuth();
  const { toast } = useToast();
  const [patients, setPatients] = useState([]);
  const [patientId, setPatientId] = useState('');
  const [items, setItems] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [sales, setSales] = useState([]);
  const [loadingSales, setLoadingSales] = useState(false);
  const [invoiceSale, setInvoiceSale] = useState(null);
  const [today, setToday] = useState(todayWITA());

  const loadPatients = useCallback(async (term = '') => {
    const { data } = await getPatients(term);
    setPatients(Array.isArray(data) ? data : []);
  }, []);

  const loadSales = useCallback(async (date) => {
    setLoadingSales(true);
    const { data, error } = await supabase
      .from('alkes_sales')
      .select('*, patient:patients(full_name, medical_record_number)')
      .eq('sale_date', date)
      .order('created_at', { ascending: false });
    if (error) toast({ variant: 'destructive', title: 'Gagal memuat penjualan alkes', description: error.message });
    setSales(data || []);
    setLoadingSales(false);
  }, [toast]);

  useEffect(() => {
    if (!isOpen) return;
    const date = todayWITA();
    setToday(date);
    loadPatients();
    loadSales(date);
  }, [isOpen, loadPatients, loadSales]);

  const total = Math.round(itemsNetTotal(items));
  const cleanItems = items
    .map((it) => ({ ...it, name: (it.name || '').trim() }))
    .filter((it) => it.name);
  const canSave = !!patientId && cleanItems.length > 0 && cleanItems.length === items.length && total > 0 && !saving;

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('alkes_sales')
        .insert([{
          clinic_id: userDetails?.clinic_id,
          patient_id: patientId,
          sale_date: todayWITA(),
          items: cleanItems,
          payment_method: paymentMethod,
          notes: notes.trim() || null,
          created_by: userDetails?.id || null,
        }])
        .select('*, patient:patients(full_name, medical_record_number)')
        .single();
      if (error) throw error;
      toast({ title: 'Tersimpan', description: 'Penjualan alkes dicatat. Invoice siap dicetak.' });
      setPatientId('');
      setItems([]);
      setNotes('');
      loadSales(todayWITA());
      setInvoiceSale(data);
    } catch (err) {
      toast({ variant: 'destructive', title: 'Gagal menyimpan', description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (sale) => {
    if (!window.confirm(`Hapus penjualan alkes ${sale.patient?.full_name || ''} (${idr(sale.total)})?`)) return;
    const { error } = await supabase.from('alkes_sales').delete().eq('id', sale.id);
    if (error) {
      toast({ variant: 'destructive', title: 'Gagal menghapus', description: error.message });
      return;
    }
    loadSales(today);
  };

  const dayTotal = sales.reduce((s, r) => s + (Number(r.total) || 0), 0);

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose?.(); }}>
        <DialogContent className="max-w-2xl w-[calc(100%-1.5rem)] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Penjualan Alkes</DialogTitle>
            <DialogDescription>
              Pembelian alat kesehatan oleh pasien. Dicatat terpisah dari rekap: tidak memotong sesi paket dan tidak masuk insentif terapis.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Pasien <span className="text-red-500">*</span></Label>
              <SearchableSelect
                options={patients}
                value={patientId}
                onChange={setPatientId}
                placeholder="Cari pasien..."
                onSearch={loadPatients}
              />
            </div>

            <div className="space-y-2">
              <Label>Item Alkes <span className="text-red-500">*</span></Label>
              <RecapInvoiceItems
                clinicId={userDetails?.clinic_id}
                items={items}
                onChange={setItems}
                allowManual
                defaultCategory="consumable"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Metode Pembayaran</Label>
                <select
                  className="w-full border rounded-md h-9 px-2 text-sm bg-white"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                >
                  {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Catatan (opsional)</Label>
                <Input className="h-9" value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
            </div>

            <Button className="w-full bg-app-accent hover:bg-app-accent-hover" disabled={!canSave} onClick={handleSave}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Receipt className="w-4 h-4 mr-2" />}
              Simpan & Buat Invoice{total > 0 ? ` (${idr(total)})` : ''}
            </Button>

            <div className="pt-2 border-t space-y-2">
              <div className="flex justify-between text-sm font-semibold">
                <span>Penjualan alkes hari ini</span>
                <span>{idr(dayTotal)}</span>
              </div>
              {loadingSales && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
              {!loadingSales && sales.length === 0 && (
                <p className="text-xs text-slate-500">Belum ada penjualan alkes hari ini.</p>
              )}
              {sales.map((s) => (
                <div key={s.id} className="flex items-center gap-2 border rounded-app-sm p-2 bg-white">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{s.patient?.full_name || '-'}</p>
                    <p className="text-xs text-slate-500 truncate">
                      {(s.items || []).map((it) => `${it.name} x${it.qty}`).join(', ')} · {s.payment_method}
                    </p>
                  </div>
                  <span className="text-sm font-semibold shrink-0">{idr(s.total)}</span>
                  <Button size="sm" variant="outline" className="h-8 shrink-0" onClick={() => setInvoiceSale(s)}>Invoice</Button>
                  <button type="button" aria-label="Hapus" className="text-red-500 shrink-0 p-1" onClick={() => handleDelete(s)}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlkesInvoiceModal isOpen={!!invoiceSale} sale={invoiceSale} onClose={() => setInvoiceSale(null)} />
    </>
  );
};

export default AlkesSalesDialog;
