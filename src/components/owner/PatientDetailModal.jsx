import React, { useState, useEffect } from 'react';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { 
  X, Edit2, Trash2, Power, Save, User, Calendar, Phone, Info 
} from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from "@/components/ui/use-toast";
import { normalizePatient, getGenderLabel } from '@/lib/patientHelpers';

const PatientDetailModal = ({ 
    patient, 
    onClose, 
    onStatusToggle, 
    onDelete, 
    onRefresh 
}) => {
    const { toast } = useToast();
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [formData, setFormData] = useState({});
    const [infoOptions, setInfoOptions] = useState([]);

    // Reset state when patient changes
    useEffect(() => {
        if (patient) {
            const normalized = normalizePatient(patient);
            setFormData({
                full_name: normalized.full_name || '',
                nickname: normalized.nickname || '',
                birth_date: normalized.birth_date || '',
                gender: normalized.genderLabel || 'Laki-laki',
                phone: normalized.phone || '',
                additional_info_option_id: normalized.additional_info_option_id || null
            });
            setIsEditing(false);
        }
    }, [patient]);

    // Fetch options for additional info dropdown
    useEffect(() => {
        const fetchOptions = async () => {
            const { data: sessionData } = await supabase.auth.getSession();
            const userId = sessionData?.session?.user?.id;
            const { data: userRow } = await supabase.from('users').select('clinic_id').eq('id', userId).single();

            const { data } = await supabase
                .from('patient_info_options')
                .select('*')
                .eq('is_active', true)
                .eq('clinic_id', userRow?.clinic_id);
            if (data) setInfoOptions(data);
        };
        fetchOptions();
    }, []);

    const handleSave = async () => {
        if (!patient) return;
        setIsSaving(true);
        try {
            const { error } = await supabase
                .from('patients')
                .update({
                    full_name: formData.full_name,
                    nickname: formData.nickname,
                    birth_date: formData.birth_date,
                    gender: formData.gender,
                    phone: formData.phone,
                    additional_info_option_id: formData.additional_info_option_id,
                    updated_at: new Date()
                })
                .eq('id', patient.id);

            if (error) throw error;

            toast({
                title: "Berhasil",
                description: "Data pasien berhasil diperbarui",
            });
            setIsEditing(false);
            onRefresh();
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Gagal Menyimpan",
                description: error.message
            });
        } finally {
            setIsSaving(false);
        }
    };

    if (!patient) return null;

    const displayData = normalizePatient(patient);

    return (
        <Dialog open={!!patient} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader className="flex flex-row items-center justify-between space-y-0 pb-4 border-b">
                    <DialogTitle className="text-xl font-bold flex items-center gap-2">
                        <User className="w-5 h-5 text-indigo-600" />
                        {isEditing ? "Edit Data Pasien" : "Detail Pasien"}
                    </DialogTitle>
                    <div className="flex items-center gap-2">
                        {!isEditing && (
                            <Badge className={`${displayData.statusClass} capitalize`}>
                                {displayData.status || 'Non-Aktif'}
                            </Badge>
                        )}
                    </div>
                </DialogHeader>

                <div className="py-6">
                    {isEditing ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="full_name">Nama Lengkap</Label>
                                <Input 
                                    id="full_name" 
                                    value={formData.full_name} 
                                    onChange={e => setFormData({...formData, full_name: e.target.value})}
                                    className="border-slate-300 focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="nickname">Nama Panggilan</Label>
                                <Input 
                                    id="nickname" 
                                    value={formData.nickname} 
                                    onChange={e => setFormData({...formData, nickname: e.target.value})}
                                    className="border-slate-300 focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="birth_date">Tanggal Lahir</Label>
                                <Input 
                                    id="birth_date" 
                                    type="date"
                                    value={formData.birth_date} 
                                    onChange={e => setFormData({...formData, birth_date: e.target.value})}
                                    className="border-slate-300 focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="gender">Jenis Kelamin</Label>
                                <Select 
                                    value={formData.gender} 
                                    onValueChange={val => setFormData({...formData, gender: val})}
                                >
                                    <SelectTrigger className="border-slate-300 focus:ring-2 focus:ring-indigo-500">
                                        <SelectValue placeholder="Pilih Gender" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Laki-laki">Laki-laki</SelectItem>
                                        <SelectItem value="Perempuan">Perempuan</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="phone">No. Handphone</Label>
                                <Input 
                                    id="phone" 
                                    value={formData.phone} 
                                    onChange={e => setFormData({...formData, phone: e.target.value})}
                                    className="border-slate-300 focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="info_source">Sumber Info</Label>
                                <Select 
                                    value={formData.additional_info_option_id || "none"} 
                                    onValueChange={val => setFormData({...formData, additional_info_option_id: val === "none" ? null : val})}
                                >
                                    <SelectTrigger className="border-slate-300 focus:ring-2 focus:ring-indigo-500">
                                        <SelectValue placeholder="Pilih Sumber" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">Tidak Ada</SelectItem>
                                        {infoOptions.map(opt => (
                                            <SelectItem key={opt.id} value={opt.id}>{opt.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                            <DetailItem label="No RM" value={displayData.medical_record_number} isMono />
                            <DetailItem label="Nama Lengkap" value={displayData.full_name} isBold />
                            <DetailItem label="Nama Panggilan" value={displayData.nickname || '-'} />
                            <DetailItem label="Gender" value={displayData.genderLabel} />
                            <DetailItem label="Usia" value={displayData.formattedAge ? `${displayData.formattedAge} Tahun` : '-'} />
                            <DetailItem label="Tgl Lahir" value={displayData.formattedBirthDateLong} icon={<Calendar className="w-3 h-3" />} />
                            <DetailItem label="No HP" value={displayData.formattedPhone} icon={<Phone className="w-3 h-3" />} />
                            <DetailItem label="Info Tambahan" value={patient.patient_info_options?.label || '-'} icon={<Info className="w-3 h-3" />} />
                        </div>
                    )}
                </div>

                <DialogFooter className="border-t pt-4 flex flex-row justify-between items-center sm:justify-between w-full">
                    {isEditing ? (
                        <>
                            <Button variant="outline" onClick={() => setIsEditing(false)} disabled={isSaving}>
                                Batal
                            </Button>
                            <Button 
                                className="bg-emerald-600 hover:bg-emerald-700 text-white" 
                                onClick={handleSave} 
                                disabled={isSaving}
                            >
                                {isSaving ? "Menyimpan..." : "Simpan Perubahan"}
                            </Button>
                        </>
                    ) : (
                        <>
                             <div className="flex gap-2">
                                <Button 
                                    variant="outline" 
                                    className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                                    onClick={() => onDelete(patient)}
                                >
                                    <Trash2 className="w-4 h-4 mr-2" /> Hapus
                                </Button>
                                <Button 
                                    variant="outline" 
                                    className={displayData.status === 'aktif' ? "text-amber-600 border-amber-200 hover:bg-amber-50" : "text-emerald-600 border-emerald-200 hover:bg-emerald-50"}
                                    onClick={() => onStatusToggle(patient)}
                                >
                                    <Power className="w-4 h-4 mr-2" /> 
                                    {displayData.status === 'aktif' ? 'Nonaktifkan' : 'Aktifkan'}
                                </Button>
                             </div>
                             <div className="flex gap-2">
                                <Button variant="outline" onClick={onClose}>
                                    Tutup
                                </Button>
                                <Button 
                                    className="bg-blue-600 hover:bg-blue-700 text-white"
                                    onClick={() => setIsEditing(true)}
                                >
                                    <Edit2 className="w-4 h-4 mr-2" /> Edit
                                </Button>
                             </div>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

const DetailItem = ({ label, value, isMono, isBold, icon }) => (
    <div className="flex flex-col space-y-1">
        <span className="text-xs text-slate-500 uppercase tracking-wider flex items-center gap-1">
            {icon} {label}
        </span>
        <span className={`text-slate-900 ${isMono ? 'font-mono' : ''} ${isBold ? 'font-semibold text-lg' : 'text-base'}`}>
            {value}
        </span>
    </div>
);

export default PatientDetailModal;