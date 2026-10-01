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
import { Loader2, Upload, X } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import {
    generateMedicalRecordNumber,
    autoFillNickname,
    parseDateFromDisplay,
    validatePatientForm,
    normalizePhone,
    isValidDateFormat
} from '@/lib/patientFormHelpers';
import { getCachedClinicId } from '@/lib/api';

const RELIGION_OPTIONS = ['Islam', 'Kristen', 'Katolik', 'Hindu', 'Buddha', 'Konghucu', 'Lainnya'];
const MAX_KTP_SIZE = 5 * 1024 * 1024;

const PatientAddModal = ({ isOpen, onClose, onSuccess }) => {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [infoOptions, setInfoOptions] = useState([]);
    
    // Form State
    const [formData, setFormData] = useState({
        medical_record_number: '',
        full_name: '',
        nickname: '',
        birth_date: '', // Display format DD/MM/YYYY
        gender: '',
        phone: '',
        nik: '',
        address: '',
        occupation: '',
        religion: '',
        additional_info_option_id: '',
        status: 'aktif'
    });

    const [nicknameManuallyEdited, setNicknameManuallyEdited] = useState(false);
    const [errors, setErrors] = useState({});
    const [ktpFile, setKtpFile] = useState(null);
    const [ktpPreview, setKtpPreview] = useState(null);

    useEffect(() => {
        if (!ktpFile) { setKtpPreview(null); return; }
        const url = URL.createObjectURL(ktpFile);
        setKtpPreview(url);
        return () => URL.revokeObjectURL(url);
    }, [ktpFile]);

    const handleKtpChange = (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            toast({ variant: "destructive", title: "File tidak valid", description: "KTP harus berupa gambar (JPG/PNG)." });
            return;
        }
        if (file.size > MAX_KTP_SIZE) {
            toast({ variant: "destructive", title: "File terlalu besar", description: "Ukuran maksimal 5 MB." });
            return;
        }
        setKtpFile(file);
    };

    // Fetch Info Options on mount
    useEffect(() => {
        const fetchOptions = async () => {
            const { data: sessionData } = await supabase.auth.getSession();
            const userId = sessionData?.session?.user?.id;
            const userRow = { clinic_id: await getCachedClinicId(userId) };

            const { data } = await supabase
                .from('patient_info_options')
                .select('id, label')
                .eq('is_active', true)
                .eq('clinic_id', userRow?.clinic_id)
                .order('label');
            if (data) setInfoOptions(data);
        };
        fetchOptions();
    }, []);

    // Generate new RM when modal opens
    useEffect(() => {
        if (isOpen) {
            const fetchRm = async () => {
                const newRm = await generateMedicalRecordNumber();
                setFormData(prev => ({
                    ...prev,
                    medical_record_number: newRm
                }));
            };

            setFormData({
                medical_record_number: 'Loading...',
                full_name: '',
                nickname: '',
                birth_date: '',
                gender: '',
                phone: '',
                nik: '',
                address: '',
                occupation: '',
                religion: '',
                additional_info_option_id: 'none',
                status: 'aktif'
            });
            setErrors({});
            setKtpFile(null);
            setNicknameManuallyEdited(false);
            fetchRm();
        }
    }, [isOpen]);

    // Handle Input Changes
    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: null }));
        }

        // Logic for specific fields handled in effects or below
        if (name === 'nickname') {
            setNicknameManuallyEdited(true);
        }
    };

    // Specific Handlers to trigger auto-fill logic
    const handleFullNameChange = (e) => {
        const value = e.target.value;
        setFormData(prev => {
            const newData = { ...prev, full_name: value };
            if (!nicknameManuallyEdited) {
                newData.nickname = autoFillNickname(value, prev.birth_date, prev.gender);
            }
            return newData;
        });
        if (errors.full_name) setErrors(prev => ({ ...prev, full_name: null }));
    };

    const handleBirthDateChange = (e) => {
        const value = e.target.value;
        setFormData(prev => {
            const newData = { ...prev, birth_date: value };
            // Only attempt auto-fill if date looks complete/valid
            if (!nicknameManuallyEdited && isValidDateFormat(value)) {
                newData.nickname = autoFillNickname(prev.full_name, value, prev.gender);
            }
            return newData;
        });
        if (errors.birth_date) setErrors(prev => ({ ...prev, birth_date: null }));
    };

    const handleGenderChange = (value) => {
        setFormData(prev => {
            const newData = { ...prev, gender: value };
            if (!nicknameManuallyEdited) {
                newData.nickname = autoFillNickname(prev.full_name, prev.birth_date, value);
            }
            return newData;
        });
        if (errors.gender) setErrors(prev => ({ ...prev, gender: null }));
    };

    const handleSelectChange = (name, value) => {
        if (name === 'gender') {
            handleGenderChange(value);
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
            if (errors[name]) {
                setErrors(prev => ({ ...prev, [name]: null }));
            }
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
            // Upload KTP (bucket privat, folder per klinik)
            let ktpPath = null;
            if (ktpFile) {
                const { data: sessionData } = await supabase.auth.getSession();
                const clinicId = await getCachedClinicId(sessionData?.session?.user?.id);
                const ext = (ktpFile.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
                ktpPath = `${clinicId}/${crypto.randomUUID()}.${ext}`;
                const { error: uploadError } = await supabase.storage
                    .from('patient-ktp')
                    .upload(ktpPath, ktpFile, { contentType: ktpFile.type });
                if (uploadError) throw new Error(`Gagal upload KTP: ${uploadError.message}`);
            }

            // 2. Prepare Payload
            const payload = {
                medical_record_number: formData.medical_record_number,
                full_name: formData.full_name,
                nickname: formData.nickname,
                nickname_custom: nicknameManuallyEdited, 
                birth_date: parseDateFromDisplay(formData.birth_date), // Convert DD/MM/YYYY -> YYYY-MM-DD
                gender: formData.gender,
                phone: normalizePhone(formData.phone),
                nik: formData.nik || null,
                address: formData.address || null,
                occupation: formData.occupation.trim() || null,
                religion: formData.religion || null,
                ktp_photo_path: ktpPath,
                additional_info_option_id: formData.additional_info_option_id === 'none' ? null : formData.additional_info_option_id,
                status: formData.status,
                created_at: new Date().toISOString()
            };

            // 3. Insert
            const { data, error } = await supabase
                .from('patients')
                .insert([payload])
                .select()
                .single();

            if (error) throw error;

            toast({
                title: "Pasien Ditambahkan",
                description: `${data.full_name} berhasil didaftarkan.`
            });

            onSuccess?.(data);
            onClose();

        } catch (error) {
            console.error('Add Patient Error:', error);
            toast({
                variant: "destructive",
                title: "Gagal Menyimpan",
                description: error.message || "Terjadi kesalahan saat menyimpan data."
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Tambah Pasien Baru</DialogTitle>
                    <DialogDescription>
                        Isi formulir di bawah ini untuk mendaftarkan pasien baru ke dalam database.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="grid gap-4 py-4">
                    
                    {/* Row 1: RM (Read Only) & Full Name */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="medical_record_number">No RM (Auto)</Label>
                            <Input 
                                id="medical_record_number" 
                                value={formData.medical_record_number} 
                                readOnly 
                                className="bg-slate-100 font-mono text-slate-500 cursor-not-allowed"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="full_name" className={errors.full_name ? "text-red-500" : ""}>
                                Nama Lengkap <span className="text-red-500">*</span>
                            </Label>
                            <Input 
                                id="full_name" 
                                name="full_name"
                                placeholder="Masukkan nama lengkap" 
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
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="nickname" className={errors.nickname ? "text-red-500" : ""}>
                                    Nama Panggilan <span className="text-red-500">*</span>
                                </Label>
                                <Input 
                                    id="nickname" 
                                    name="nickname"
                                    placeholder="Nama panggilan" 
                                    value={formData.nickname}
                                    onChange={handleChange} // Standard change handler sets manual flag
                                    className={errors.nickname ? "border-red-500" : ""}
                                />
                                <span className="text-[10px] text-slate-500">
                                    {nicknameManuallyEdited ? "Custom" : "Auto-fill dari nama, usia & gender"}
                                </span>
                                {errors.nickname && <span className="text-xs text-red-500">{errors.nickname}</span>}
                            </div>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="birth_date" className={errors.birth_date ? "text-red-500" : ""}>
                                Tanggal Lahir (DD/MM/YYYY) <span className="text-red-500">*</span>
                            </Label>
                            <Input 
                                id="birth_date" 
                                name="birth_date"
                                placeholder="Contoh: 31/12/1990" 
                                value={formData.birth_date}
                                onChange={handleBirthDateChange}
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
                                placeholder="08xxxxxxxxxx" 
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
                                placeholder="16 digit NIK" 
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

                    {/* Row 4b: Pekerjaan & Agama */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="occupation">Pekerjaan (Opsional)</Label>
                            <Input
                                id="occupation"
                                name="occupation"
                                placeholder="Contoh: Karyawan swasta"
                                value={formData.occupation}
                                onChange={handleChange}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="religion">Agama (Opsional)</Label>
                            <Select
                                value={formData.religion}
                                onValueChange={(val) => handleSelectChange('religion', val)}
                            >
                                <SelectTrigger id="religion">
                                    <SelectValue placeholder="Pilih Agama" />
                                </SelectTrigger>
                                <SelectContent>
                                    {RELIGION_OPTIONS.map(r => (
                                        <SelectItem key={r} value={r}>{r}</SelectItem>
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
                            placeholder="Alamat lengkap domisili" 
                            rows={3}
                            value={formData.address}
                            onChange={handleChange}
                        />
                    </div>

                    {/* Upload KTP */}
                    <div className="grid gap-2">
                        <Label htmlFor="ktp">Foto KTP (Opsional)</Label>
                        {ktpPreview ? (
                            <div className="relative w-full max-w-xs">
                                <img src={ktpPreview} alt="Preview KTP" className="rounded-md border max-h-48 object-contain" />
                                <Button
                                    type="button"
                                    size="icon"
                                    variant="destructive"
                                    className="absolute top-1 right-1 h-6 w-6"
                                    onClick={() => setKtpFile(null)}
                                >
                                    <X className="h-3 w-3" />
                                </Button>
                            </div>
                        ) : (
                            <label
                                htmlFor="ktp"
                                className="flex items-center justify-center gap-2 border-2 border-dashed rounded-md p-4 text-sm text-slate-500 cursor-pointer hover:bg-slate-50"
                            >
                                <Upload className="h-4 w-4" /> Pilih gambar KTP (maks. 5 MB)
                            </label>
                        )}
                        <input id="ktp" type="file" accept="image/*" className="hidden" onChange={handleKtpChange} />
                    </div>

                    {/* Row 6: Status */}
                    <div className="grid gap-2">
                        <Label>Status</Label>
                        <RadioGroup 
                            defaultValue="aktif" 
                            value={formData.status}
                            onValueChange={handleStatusChange}
                            className="flex gap-4"
                        >
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="aktif" id="r-aktif" />
                                <Label htmlFor="r-aktif" className="cursor-pointer">Aktif</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="non-aktif" id="r-nonaktif" />
                                <Label htmlFor="r-nonaktif" className="cursor-pointer">Nonaktif</Label>
                            </div>
                        </RadioGroup>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
                            Batal
                        </Button>
                        <Button type="submit" disabled={loading} className="bg-indigo-600 hover:bg-indigo-700">
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Simpan Pasien
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default PatientAddModal;