import React, { useState, useEffect } from 'react';
import { 
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { 
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from '@/components/ui/select';
import { Loader2, Calendar as CalendarIcon, AlertCircle, Trash2 } from 'lucide-react';
import DatePicker from '@/components/DatePicker';
import { 
    generateNextRM, 
    generateNickname, 
    parseBirthDate, 
    formatBirthDateDisplay, 
    calculateAge 
} from '@/lib/patientHelpers';
import { 
    getAdditionalInfoOptions, 
    createPatient, 
    updatePatient, 
    deletePatient 
} from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';


const PatientModal = ({ isOpen, onClose, patient = null, mode = 'add', onSuccess }) => {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [fetchingRM, setFetchingRM] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [additionalInfoOptions, setAdditionalInfoOptions] = useState([]);

    // Form State
    const [formData, setFormData] = useState({
        medical_record_number: '',
        full_name: '',
        nickname: '',
        birth_date_display: '', // dd/mm/yyyy
        birth_date_iso: '', // yyyy-MM-dd
        gender: '', // L or P
        phone: '',
        nik: '',
        address: '',
        additional_info_option_id: '',
        status: 'aktif'
    });

    // Validation Errors
    const [errors, setErrors] = useState({});
    const [nicknameManuallyEdited, setNicknameManuallyEdited] = useState(false);

    // Reset form when modal opens
    useEffect(() => {
        if (isOpen) {
            setErrors({});
            setShowDeleteConfirm(false);
            setNicknameManuallyEdited(false);
            fetchOptions();

            if (mode === 'edit' && patient) {
                // Populate form for edit
                const isoDate = patient.birth_date || '';
                setFormData({
                    medical_record_number: patient.medical_record_number || '',
                    full_name: patient.full_name || '',
                    nickname: patient.nickname || '',
                    birth_date_iso: isoDate,
                    birth_date_display: formatBirthDateDisplay(isoDate),
                    gender: patient.gender === 'Laki-laki' ? 'L' : (patient.gender === 'Perempuan' ? 'P' : patient.gender),
                    phone: patient.phone || '',
                    nik: patient.nik || '',
                    address: patient.address || '',
                    additional_info_option_id: patient.additional_info_option_id || '',
                    status: patient.status || 'aktif'
                });
            } else {
                // Initialize for add
                setFormData({
                    medical_record_number: 'Loading...',
                    full_name: '',
                    nickname: '',
                    birth_date_display: '',
                    birth_date_iso: '',
                    gender: '',
                    phone: '',
                    nik: '',
                    address: '',
                    additional_info_option_id: '',
                    status: 'aktif'
                });
                fetchNextRM();
            }
        }
    }, [isOpen, mode, patient]);

    // Auto-generate Nickname effect
    useEffect(() => {
        if (
            !nicknameManuallyEdited &&
            formData.full_name &&
            formData.birth_date_iso &&
            formData.gender
        ) {
            const generated = generateNickname(
                formData.full_name,
                formData.birth_date_iso,
                formData.gender
            );

            setFormData(prev => ({
                ...prev,
                nickname: generated
            }));
        }
    }, [formData.full_name, formData.birth_date_iso, formData.gender]);

    const fetchOptions = async () => {
        try {
            const { data } = await getAdditionalInfoOptions();
            if (data) setAdditionalInfoOptions(data);
        } catch (error) {
            console.error("Failed to fetch options", error);
        }
    };

    const fetchNextRM = async () => {
        setFetchingRM(true);
        const nextRM = await generateNextRM();
        setFormData(prev => ({ ...prev, medical_record_number: nextRM }));
        setFetchingRM(false);
    };

    const handleInputChange = (e) => {
    const { name, value } = e.target;

    if (name === "nickname") {
        setNicknameManuallyEdited(true);
    }

    setFormData(prev => ({ ...prev, [name]: value }));

    if (errors[name]) {
        setErrors(prev => ({ ...prev, [name]: null }));
    }

    if (name === 'birth_date_display') {
        const iso = parseBirthDate(value);
        setFormData(prev => ({ 
            ...prev, 
            birth_date_display: value, 
            birth_date_iso: iso 
        }));

        if (iso) {
            const dateObj = new Date(iso);
            if (dateObj > new Date()) {
                setErrors(prev => ({ ...prev, birth_date: 'Tanggal lahir tidak boleh di masa depan' }));
            } else {
                setErrors(prev => ({ ...prev, birth_date: null }));
            }
        }
    }
};
    const handleDateSelect = (isoDate) => {
        const display = formatBirthDateDisplay(isoDate);
        setFormData(prev => ({ 
            ...prev, 
            birth_date_iso: isoDate, 
            birth_date_display: display 
        }));
        
        if (isoDate) {
             const dateObj = new Date(isoDate);
             if (dateObj > new Date()) {
                 setErrors(prev => ({ ...prev, birth_date: 'Tanggal lahir tidak boleh di masa depan' }));
             } else {
                 setErrors(prev => ({ ...prev, birth_date: null }));
             }
        }
        setShowDatePicker(false);
    };

    const handleValueChange = (name, value) => {
        setFormData(prev => ({ ...prev, [name]: value }));
        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: null }));
        }
    };

    const validateForm = () => {
        const newErrors = {};
        
        if (!formData.full_name.trim()) newErrors.full_name = "Nama pasien wajib diisi";
        if (!formData.nickname.trim()) newErrors.nickname = "Nama panggilan wajib diisi";
        
        if (!formData.birth_date_iso) {
            newErrors.birth_date = "Format tanggal tidak valid (dd/mm/yyyy)";
        } else {
            const dateObj = new Date(formData.birth_date_iso);
            if (dateObj > new Date()) newErrors.birth_date = "Tanggal lahir tidak boleh di masa depan";
        }

        if (!formData.gender) newErrors.gender = "Jenis kelamin wajib dipilih";
        if (!formData.phone.trim()) newErrors.phone = "Nomor HP wajib diisi";

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async () => {
        if (!validateForm()) {
            toast({
                variant: "destructive",
                title: "Validasi Gagal",
                description: "Mohon lengkapi semua field yang wajib diisi."
            });
            return;
        }

        setLoading(true);
        try {
            const payload = {
                medical_record_number: formData.medical_record_number,
                full_name: formData.full_name,
                nickname: formData.nickname,
                birth_date: formData.birth_date_iso,
                gender: formData.gender === 'L' ? 'Laki-laki' : 'Perempuan',
                phone: formData.phone,
                nik: formData.nik,
                address: formData.address,
                additional_info_option_id: formData.additional_info_option_id || null,
                status: formData.status,
                nickname_custom: true
            };

            if (mode === 'add') {
                const { error } = await createPatient(payload);
                if (error) throw error;
                toast({ title: "Berhasil", description: "Data pasien baru berhasil disimpan." });
            } else {
                const { error } = await updatePatient(patient.id, payload);
                if (error) throw error;
                toast({ title: "Berhasil", description: "Data pasien berhasil diperbarui." });
            }
            onSuccess();
            onClose();
        } catch (error) {
            console.error("Save error:", error);
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
        setLoading(true);
        try {
            const { error } = await deletePatient(patient.id);
            if (error) throw error;
            toast({ title: "Berhasil", description: "Data pasien berhasil dihapus." });
            onSuccess();
            onClose();
        } catch (error) {
             console.error("Delete error:", error);
             toast({
                variant: "destructive",
                title: "Gagal Menghapus",
                description: "Gagal menghapus pasien. Pastikan tidak ada data kritis terkait."
            });
        } finally {
            setLoading(false);
        }
    };

    const getDayName = () => {
        if (!formData.birth_date_iso) return '';
        try {
            const date = new Date(formData.birth_date_iso);
            return format(date, 'EEEE', { locale: id });
        } catch {
            return '';
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !loading && onClose()}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl shadow-lg p-0">
                <div className="px-6 py-6 border-b border-slate-100">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold text-slate-900">{mode === 'add' ? 'Tambah Pasien Baru' : 'Edit Data Pasien'}</DialogTitle>
                        <DialogDescription className="text-sm text-slate-500">
                            Lengkapi informasi pasien di bawah ini. Field dengan tanda (*) wajib diisi.
                        </DialogDescription>
                    </DialogHeader>
                </div>

                <div className="px-6 py-4 space-y-5">
                    {/* Row 1: RM & Status */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="text-sm font-medium text-slate-700">No. Rekam Medis</Label>
                            <Input 
                                value={formData.medical_record_number} 
                                disabled 
                                className="bg-slate-50 font-mono text-slate-600 border-slate-200" 
                            />
                        </div>
                        <div className="space-y-2">
                             <Label className="text-sm font-medium text-slate-700">Status Pasien</Label>
                             <RadioGroup 
                                value={formData.status} 
                                onValueChange={(val) => handleValueChange('status', val)}
                                className="flex gap-4 pt-2.5"
                             >
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="aktif" id="st-aktif" className="text-blue-600 border-slate-300" />
                                    <Label htmlFor="st-aktif" className="font-normal cursor-pointer text-sm text-slate-700">Aktif</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="nonaktif" id="st-nonaktif" className="text-blue-600 border-slate-300" />
                                    <Label htmlFor="st-nonaktif" className="font-normal cursor-pointer text-sm text-slate-500">Nonaktif</Label>
                                </div>
                             </RadioGroup>
                        </div>
                    </div>

                    {/* Row 2: Names */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="full_name" className="text-sm font-medium text-slate-700">Nama Lengkap <span className="text-red-500">*</span></Label>
                            <Input 
                                id="full_name" 
                                name="full_name"
                                value={formData.full_name}
                                onChange={handleInputChange}
                                placeholder="Contoh: Budi Santoso"
                                className={cn("px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500", errors.full_name ? "border-red-500 focus:ring-red-200" : "")}
                            />
                            {errors.full_name && <span className="text-xs text-red-500 font-medium">{errors.full_name}</span>}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="nickname" className="text-sm font-medium text-slate-700">Nama Panggilan <span className="text-red-500">*</span></Label>
                            <Input 
                                id="nickname" 
                                name="nickname"
                                value={formData.nickname}
                                onChange={handleInputChange}
                                placeholder="Contoh: Bapak Budi"
                                className={cn("px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500", errors.nickname ? "border-red-500 focus:ring-red-200" : "")}
                            />
                             {errors.nickname && <span className="text-xs text-red-500 font-medium">{errors.nickname}</span>}
                        </div>
                    </div>

                    {/* Row 3: Gender & DOB */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                             <Label className="text-sm font-medium text-slate-700">Jenis Kelamin <span className="text-red-500">*</span></Label>
                             <RadioGroup 
                                value={formData.gender} 
                                onValueChange={(val) => handleValueChange('gender', val)}
                                className="flex gap-6 pt-3"
                             >
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="L" id="g-l" className="text-blue-600 border-slate-300" />
                                    <Label htmlFor="g-l" className="font-normal cursor-pointer text-sm text-slate-700">Laki-laki</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="P" id="g-p" className="text-blue-600 border-slate-300" />
                                    <Label htmlFor="g-p" className="font-normal cursor-pointer text-sm text-slate-700">Perempuan</Label>
                                </div>
                             </RadioGroup>
                             {errors.gender && <span className="text-xs text-red-500 font-medium">{errors.gender}</span>}
                        </div>

                        <div className="space-y-2 relative">
                            <Label className="text-sm font-medium text-slate-700">Tanggal Lahir <span className="text-red-500">*</span></Label>
                            <div className="flex gap-2">
                                <Input 
                                    name="birth_date_display"
                                    value={formData.birth_date_display}
                                    onChange={handleInputChange}
                                    placeholder="dd/mm/yyyy"
                                    className={cn("flex-1", errors.birth_date ? "border-red-500 focus:ring-red-200" : "")}
                                />
                                <Button 
                                    type="button" 
                                    variant="outline" 
                                    className="px-3 border-slate-300 text-slate-500"
                                    onClick={() => setShowDatePicker(!showDatePicker)}
                                >
                                    <CalendarIcon className="w-4 h-4" />
                                </Button>
                            </div>
                            {formData.birth_date_iso && !errors.birth_date && (
                                <div className="text-xs text-slate-500 mt-1 font-medium bg-slate-50 px-2 py-1 rounded w-fit">
                                    {getDayName()}, {formData.birth_date_display} ({calculateAge(formData.birth_date_iso)} tahun)
                                </div>
                            )}
                            {errors.birth_date && <span className="text-xs text-red-500 font-medium">{errors.birth_date}</span>}

                            {showDatePicker && (
                                <div className="fixed inset-0 z-[100] flex items-center justify-center">
                                    <div
                                        className="absolute inset-0 bg-black/20"
                                        onClick={() => setShowDatePicker(false)}
                                    />

                                    <div className="relative bg-white shadow-2xl rounded-xl border border-slate-200 p-2">
                                        <DatePicker
                                            value={formData.birth_date_iso}
                                            onChange={handleDateSelect}
                                            onClose={() => setShowDatePicker(false)}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Row 4: Phone & NIK */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="phone" className="text-sm font-medium text-slate-700">Nomor HP / WhatsApp <span className="text-red-500">*</span></Label>
                            <Input 
                                id="phone" 
                                name="phone"
                                value={formData.phone}
                                onChange={handleInputChange}
                                placeholder="08xxxxxxxxxx"
                                className={cn(errors.phone ? "border-red-500 focus:ring-red-200" : "")}
                            />
                            {errors.phone && <span className="text-xs text-red-500 font-medium">{errors.phone}</span>}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="nik" className="text-sm font-medium text-slate-700">NIK (Opsional)</Label>
                            <Input 
                                id="nik" 
                                name="nik"
                                value={formData.nik}
                                onChange={handleInputChange}
                                placeholder="16 digit NIK"
                            />
                        </div>
                    </div>

                    {/* Row 5: Info Tambahan */}
                    <div className="space-y-2">
                        <Label className="text-sm font-medium text-slate-700">Info Tambahan (Opsional)</Label>
                        <Select 
                            value={formData.additional_info_option_id} 
                            onValueChange={(val) => handleValueChange('additional_info_option_id', val)}
                        >
                            <SelectTrigger className="border-slate-300">
                                <SelectValue placeholder="Pilih info tambahan..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">- Tidak Ada -</SelectItem>
                                {additionalInfoOptions.map(opt => (
                                    <SelectItem key={opt.id} value={opt.id}>{opt.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Row 6: Address */}
                    <div className="space-y-2">
                        <Label htmlFor="address" className="text-sm font-medium text-slate-700">Alamat Lengkap</Label>
                        <Textarea 
                            id="address" 
                            name="address"
                            value={formData.address}
                            onChange={handleInputChange}
                            placeholder="Jalan, No Rumah, RT/RW, Kelurahan, Kecamatan..."
                            className="h-20 border-slate-300 focus:ring-2 focus:ring-blue-500 rounded-lg resize-none"
                        />
                    </div>
                </div>

                <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between gap-4 bg-slate-50/50">
                    {mode === 'edit' ? (
                        <div className="flex-1 flex justify-start">
                             {!showDeleteConfirm ? (
                                <Button 
                                    type="button" 
                                    variant="ghost" 
                                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                    onClick={() => setShowDeleteConfirm(true)}
                                    disabled={loading}
                                >
                                    <Trash2 className="w-4 h-4 mr-2" /> Hapus Pasien
                                </Button>
                             ) : (
                                 <div className="flex items-center gap-2 bg-red-50 p-1 rounded-lg border border-red-100 animate-in fade-in zoom-in duration-200">
                                     <span className="text-xs text-red-700 font-medium px-2">Yakin hapus?</span>
                                     <Button size="sm" variant="destructive" onClick={handleDelete} disabled={loading}>{loading ? '...' : 'Ya, Hapus'}</Button>
                                     <Button size="sm" variant="ghost" onClick={() => setShowDeleteConfirm(false)} disabled={loading} className="text-slate-600 hover:text-slate-800">Batal</Button>
                                 </div>
                             )}
                        </div>
                    ) : (
                        <div></div> 
                    )}
                    
                    <div className="flex gap-3">
                        <Button type="button" variant="outline" onClick={onClose} disabled={loading} className="px-6">Batal</Button>
                        <Button type="button" onClick={handleSubmit} disabled={loading || fetchingRM} className="bg-blue-600 hover:bg-blue-700 text-white px-6">
                            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            {mode === 'add' ? 'Simpan Pasien' : 'Simpan Perubahan'}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default PatientModal;