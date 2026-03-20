import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { 
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle 
} from "@/components/ui/dialog";
import { 
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { 
    parseDateFromDisplay, 
    formatDateToDisplay,
    validatePatientForm, 
    normalizePhone,
    isValidDateFormat,
    autoFillNickname
} from '@/lib/patientFormHelpers';
import { deletePatient } from '@/lib/api';

const PatientEditModal = ({ isOpen, onClose, onSuccess, patient }) => {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [infoOptions, setInfoOptions] = useState([]);
    
    // Form State
    const [formData, setFormData] = useState({
        medical_record_number: '',
        full_name: '',
        nickname: '',
        birth_date: '', 
        gender: '',
        phone: '',
        nik: '',
        address: '',
        additional_info_option_id: '',
        status: ''
    });

    const [nicknameManuallyEdited, setNicknameManuallyEdited] = useState(false);
    const [errors, setErrors] = useState({});

    // Fetch Info Options on mount
    useEffect(() => {
        const fetchOptions = async () => {
            const { data } = await supabase
                .from('patient_info_options')
                .select('id, label')
                .eq('is_active', true)
                .order('label');
            if (data) setInfoOptions(data);
        };
        fetchOptions();
    }, []);

    // Load Patient Data
    useEffect(() => {
        if (isOpen && patient) {
            setFormData({
                medical_record_number: patient.medical_record_number || '',
                full_name: patient.full_name || '',
                nickname: patient.nickname || '',
                birth_date: formatDateToDisplay(patient.birth_date), // Convert YYYY-MM-DD -> DD/MM/YYYY
                gender: patient.gender === 'L' ? 'Laki-laki' : patient.gender === 'P' ? 'Perempuan' : patient.gender || '',
                phone: patient.phone || '',
                nik: patient.nik || '',
                address: patient.address || '',
                additional_info_option_id: patient.additional_info_option_id || 'none',
                status: patient.status || 'aktif'
            });
            setErrors({});
            setNicknameManuallyEdited(false); // Reset on open
        }
    }, [isOpen, patient]);

    // Handle Input Changes
    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: null }));
        }

        if (name === 'nickname') {
            setNicknameManuallyEdited(true);
        }
    };

    // Separate handlers for logic
    const handleFullNameChange = (e) => {
        const value = e.target.value;
        setFormData(prev => ({ ...prev, full_name: value }));
        // Note: No auto-fill in Edit mode as requested
        if (errors.full_name) setErrors(prev => ({ ...prev, full_name: null }));
    };

    const handleSelectChange = (name, value) => {
        setFormData(prev => ({ ...prev, [name]: value }));
        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: null }));
        }
    };

    const handleStatusChange = (value) => {
        setFormData(prev => ({ ...prev, status: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        // 1. Validate
        const { isValid, errors: validationErrors } = validatePatientForm(formData);
        if (!isValid) {
            setErrors(validationErrors);
            toast({
                variant: "destructive",
                title: "Validasi Gagal",
                description: "Mohon periksa kembali form anda."
            });
            return;
        }

        setLoading(true);

        try {
            // 2. Prepare Payload
            const payload = {
                full_name: formData.full_name,
                nickname: formData.nickname,
                nickname_custom: nicknameManuallyEdited,
                birth_date: parseDateFromDisplay(formData.birth_date), // Convert DD/MM/YYYY -> YYYY-MM-DD
                gender: formData.gender,
                phone: normalizePhone(formData.phone),
                nik: formData.nik || null,
                address: formData.address || null,
                additional_info_option_id: formData.additional_info_option_id === 'none' ? null : formData.additional_info_option_id,
                status: formData.status,
                updated_at: new Date().toISOString()
            };

            // 3. Update
            const { data, error } = await supabase
                .from('patients')
                .update(payload)
                .eq('id', patient.id)
                .select()
                .single();

            if (error) throw error;

            toast({
                title: "Data Diperbarui",
                description: `Data pasien ${formData.full_name} berhasil disimpan.`
            });

            onSuccess?.(data);
            onClose();

        } catch (error) {
            console.error('Update Patient Error:', error);
            toast({
                variant: "destructive",
                title: "Gagal Menyimpan",
                description: error.message || "Terjadi kesalahan saat menyimpan data."
            });
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm(`Yakin ingin menghapus data pasien ${formData.full_name}? Tindakan ini tidak dapat dibatalkan.`)) return;
        
        setLoading(true);
        try {
            const { error } = await deletePatient(patient.id);
            if (error) throw error;

            toast({
                title: "Pasien Dihapus",
                description: "Data pasien berhasil dihapus permanen."
            });
            onSuccess?.(null); // Pass null or indicator for deletion
            onClose();
        } catch (error) {
             toast({
                variant: "destructive",
                title: "Gagal Menghapus",
                description: error.message
            });
        } finally {
            setLoading(false);
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Edit Data Pasien</DialogTitle>
                    <DialogDescription>
                        Perbarui informasi pasien di bawah ini.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="grid gap-4 py-4">
                    
                    {/* Row 1: RM (Read Only) & Full Name */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="medical_record_number">No RM (Read Only)</Label>
                            <Input 
                                id="medical_record_number" 
                                value={formData.medical_record_number} 
                                readOnly 
                                disabled
                                className="bg-slate-100 font-mono text-slate-500 cursor-not-allowed"
                            />
                            <span className="text-[10px] text-slate-400">Tidak dapat diubah</span>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="full_name" className={errors.full_name ? "text-red-500" : ""}>
                                Nama Lengkap <span className="text-red-500">*</span>
                            </Label>
                            <Input 
                                id="full_name" 
                                name="full_name"
                                value={formData.full_name}
                                onChange={handleFullNameChange}
                                className={errors.full_name ? "border-red-500" : ""}
                            />
                            {errors.full_name && <span className="text-xs text-red-500">{errors.full_name}</span>}
                        </div>
                    </div>

                    {/* Row 2: Nickname & Birth Date */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="nickname" className={errors.nickname ? "text-red-500" : ""}>
                                Nama Panggilan <span className="text-red-500">*</span>
                            </Label>
                            <Input 
                                id="nickname" 
                                name="nickname"
                                value={formData.nickname}
                                onChange={handleChange}
                                className={errors.nickname ? "border-red-500" : ""}
                            />
                            {errors.nickname && <span className="text-xs text-red-500">{errors.nickname}</span>}
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="birth_date" className={errors.birth_date ? "text-red-500" : ""}>
                                Tanggal Lahir (DD/MM/YYYY) <span className="text-red-500">*</span>
                            </Label>
                            <Input 
                                id="birth_date" 
                                name="birth_date"
                                placeholder="DD/MM/YYYY" 
                                value={formData.birth_date}
                                onChange={handleChange}
                                className={errors.birth_date ? "border-red-500" : ""}
                            />
                            {errors.birth_date && <span className="text-xs text-red-500">{errors.birth_date}</span>}
                        </div>
                    </div>

                    {/* Row 3: Gender & Phone */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="gender" className={errors.gender ? "text-red-500" : ""}>
                                Gender <span className="text-red-500">*</span>
                            </Label>
                            <Select 
                                value={formData.gender} 
                                onValueChange={(val) => handleSelectChange('gender', val)}
                            >
                                <SelectTrigger className={errors.gender ? "border-red-500" : ""}>
                                    <SelectValue placeholder="Pilih Gender" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Laki-laki">Laki-laki</SelectItem>
                                    <SelectItem value="Perempuan">Perempuan</SelectItem>
                                </SelectContent>
                            </Select>
                            {errors.gender && <span className="text-xs text-red-500">{errors.gender}</span>}
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="phone" className={errors.phone ? "text-red-500" : ""}>
                                Nomor HP <span className="text-red-500">*</span>
                            </Label>
                            <Input 
                                id="phone" 
                                name="phone"
                                value={formData.phone}
                                onChange={handleChange}
                                className={errors.phone ? "border-red-500" : ""}
                            />
                            {errors.phone && <span className="text-xs text-red-500">{errors.phone}</span>}
                        </div>
                    </div>

                    {/* Row 4: NIK & Info Tambahan */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="nik">NIK (Opsional)</Label>
                            <Input 
                                id="nik" 
                                name="nik"
                                value={formData.nik}
                                onChange={handleChange}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="additional_info">Info Tambahan (Opsional)</Label>
                            <Select 
                                value={formData.additional_info_option_id} 
                                onValueChange={(val) => handleSelectChange('additional_info_option_id', val)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Pilih Sumber Info" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">-- Tidak Ada --</SelectItem>
                                    {infoOptions.map(opt => (
                                        <SelectItem key={opt.id} value={opt.id}>{opt.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Row 5: Address */}
                    <div className="grid gap-2">
                        <Label htmlFor="address">Alamat (Opsional)</Label>
                        <Textarea 
                            id="address" 
                            name="address"
                            rows={3}
                            value={formData.address}
                            onChange={handleChange}
                        />
                    </div>

                     {/* Row 6: Status */}
                     <div className="grid gap-2">
                        <Label>Status</Label>
                        <RadioGroup 
                            value={formData.status}
                            onValueChange={handleStatusChange}
                            className="flex gap-4"
                        >
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="aktif" id="edit-aktif" />
                                <Label htmlFor="edit-aktif" className="cursor-pointer">Aktif</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="non-aktif" id="edit-nonaktif" />
                                <Label htmlFor="edit-nonaktif" className="cursor-pointer">Nonaktif</Label>
                            </div>
                        </RadioGroup>
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0">
                        <div className="flex-1 flex justify-start">
                             <Button 
                                type="button" 
                                variant="destructive" 
                                onClick={handleDelete}
                                disabled={loading}
                                className="bg-red-50 text-red-600 hover:bg-red-100 border-red-200"
                             >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Hapus Pasien
                            </Button>
                        </div>
                        <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
                            Batal
                        </Button>
                        <Button type="submit" disabled={loading} className="bg-indigo-600 hover:bg-indigo-700">
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Simpan Perubahan
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default PatientEditModal;