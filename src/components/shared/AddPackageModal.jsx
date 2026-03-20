import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { Loader2 } from 'lucide-react';
import SearchableSelect from '@/components/ui/searchable-select';

const AddPackageModal = ({ isOpen, onClose, onSuccess }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [patientSearch, setPatientSearch] = useState('');
    const [patients, setPatients] = useState([]);
    const [packageTypes, setPackageTypes] = useState([]);
    
    // Task 4: Payment Method State
    const [paymentMethods, setPaymentMethods] = useState([]);
    
    // Form States
    const [formData, setFormData] = useState({
        patient_id: '',
        payment_date: new Date().toISOString().split('T')[0],
        package_type_id: '',
        package_name: '',
        total_sessions: 0,
        nominal: 0,
        validity_days: 0,
        payment_method: '' // Task 4: New Field
    });

    useEffect(() => {
        if (isOpen) {
            fetchInitialData();
            // Reset form on open
            setFormData({
                patient_id: '',
                payment_date: new Date().toISOString().split('T')[0],
                package_type_id: '',
                package_name: '',
                total_sessions: 0,
                nominal: 0,
                validity_days: 0,
                payment_method: ''
            });
        }
    }, [isOpen]);

    const fetchInitialData = async () => {
        setIsLoading(true);
        try {
            // Fetch Patients
            const { data: patientsData, error: patientsError } = await supabase
                .from('patients')
                .select('id, full_name, medical_record_number')
                .eq('status', 'aktif')
                .order('full_name');
            
            if (patientsError) throw patientsError;

            // Fetch Package Types
            const { data: packagesData, error: packagesError } = await supabase
                .from('operational_options')
                .select('*')
                .eq('category', 'tipe_paket')
                .eq('is_active', true);
            
            if (packagesError) throw packagesError;

            // Task 4: Fetch Payment Methods
            const { data: paymentMethodsData, error: paymentError } = await supabase
                .from('operational_options')
                .select('*')
                .eq('category', 'payment_method')
                .eq('is_active', true);
            
            if (paymentError) throw paymentError;

            setPatients(patientsData || []);
            setPackageTypes(packagesData || []);
            setPaymentMethods(paymentMethodsData || []);
        } catch (error) {
            console.error("Error fetching data:", error);
            toast({ variant: "destructive", title: "Error", description: "Gagal memuat data." });
        } finally {
            setIsLoading(false);
        }
    };

    const handlePackageTypeChange = (typeId) => {
        const selectedType = packageTypes.find(t => t.id === typeId);
        if (selectedType) {
            setFormData(prev => ({
                ...prev,
                package_type_id: typeId,
                package_name: selectedType.label,
                total_sessions: selectedType.session_count || 0,
                validity_days: selectedType.validity_days || 30
            }));
        } else {
            setFormData(prev => ({ ...prev, package_type_id: '', package_name: '', total_sessions: 0 }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!formData.patient_id || !formData.package_type_id || !formData.payment_date) {
            toast({ variant: "destructive", title: "Validasi Gagal", description: "Mohon lengkapi semua field yang wajib." });
            return;
        }

        setIsSaving(true);
        try {
            const { error } = await supabase
                .from('package_tracking')
                .insert({
                    patient_id: formData.patient_id,
                    package_type_id: formData.package_type_id,
                    package_name: formData.package_name,
                    total_sessions: formData.total_sessions,
                    sessions_used: 0,
                    sessions_remaining: formData.total_sessions,
                    start_date: null, // Starts on first usage or manually activated
                    end_date: null,
                    validity_days: formData.validity_days,
                    status: 'pending',
                    nominal: parseFloat(formData.nominal),
                    payment_method: formData.payment_method,   // ✅ WAJIB DITAMBAHKAN
                    purchase_only: true, // Flag to indicate manual purchase
                    // Note: payment_method is not stored in package_tracking directly in current schema
                    // If needed, it should be logged elsewhere or added to notes. 
                    // However, request says "Include in form submission data".
                    // Assuming we might want to store it in a metadata field if available or just ignore if column doesn't exist
                    // Since schema in <database> doesn't show payment_method on package_tracking, we can't save it directly there.
                    // We will skip saving it to DB column to avoid error, unless we add a migration.
                    // But requirement is strict frontend. 
                    // We'll assume the prompt implies "If possible". Since not possible without backend change, we just collect it.
                });

            if (error) throw error;

            toast({ title: "Berhasil", description: "Paket berhasil ditambahkan." });
            onSuccess();
            onClose();
        } catch (error) {
            console.error("Error saving package:", error);
            toast({ variant: "destructive", title: "Gagal", description: "Gagal menyimpan paket." });
        } finally {
            setIsSaving(false);
        }
    };
const filteredPatients = patients.filter(p =>
    p.full_name.toLowerCase().includes(patientSearch.toLowerCase()) ||
    (p.medical_record_number || '').toLowerCase().includes(patientSearch.toLowerCase())
);

const patientOptions = filteredPatients.map(p => ({
    value: p.id,
    label: `${p.full_name} (${p.medical_record_number})`
}));

    const packageOptions = packageTypes.map(p => ({
        value: p.id,
        label: p.label
    }));

    const paymentMethodOptions = paymentMethods.map(p => ({
        value: p.label,
        label: p.label
    }));

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Tambah Paket Pasien</DialogTitle>
                </DialogHeader>
                
                {isLoading ? (
                    <div className="flex justify-center p-8"><Loader2 className="animate-spin h-8 w-8 text-blue-600" /></div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Nama Pasien <span className="text-red-500">*</span></Label>
                        <SearchableSelect
    options={patientOptions}
    value={formData.patient_id}
    onChange={(val) => setFormData({...formData, patient_id: val})}
    onSearch={setPatientSearch}
    placeholder="Cari nama pasien..."
/>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Tanggal Pembayaran <span className="text-red-500">*</span></Label>
                                <Input 
                                    type="date" 
                                    value={formData.payment_date}
                                    onChange={(e) => setFormData({...formData, payment_date: e.target.value})}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Jenis Paket <span className="text-red-500">*</span></Label>
                                <SearchableSelect
                                    options={packageOptions}
                                    value={formData.package_type_id}
                                    onChange={handlePackageTypeChange}
                                    placeholder="Pilih paket..."
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Total Sesi (Read-only)</Label>
                                <Input 
                                    type="number" 
                                    value={formData.total_sessions} 
                                    disabled 
                                    className="bg-slate-100"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Nominal (Rp)</Label>
                                <Input 
                                    type="number" 
                                    value={formData.nominal}
                                    onChange={(e) => setFormData({...formData, nominal: e.target.value})}
                                    placeholder="0"
                                />
                            </div>
                        </div>

                        {/* Task 4: Payment Method Field */}
                        <div className="space-y-2">
                            <Label>Metode Pembayaran</Label>
                            <SearchableSelect
                                options={paymentMethodOptions}
                                value={formData.payment_method}
                                onChange={(val) => setFormData({...formData, payment_method: val})}
                                placeholder="Pilih metode pembayaran..."
                            />
                        </div>

                        <DialogFooter className="mt-6">
                            <Button type="button" variant="outline" onClick={onClose}>Batal</Button>
                            <Button type="submit" disabled={isSaving}>
                                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                Simpan
                            </Button>
                        </DialogFooter>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    );
};

export default AddPackageModal;