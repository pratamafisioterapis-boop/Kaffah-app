import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { supabase } from '@/lib/customSupabaseClient';
import PackageSessionDisplay from '@/components/admin/PackageSessionDisplay';
import { getAdditionalInfoOptions, generateNickname } from '@/lib/api';
import { validateBirthDate, validateGender, validateUUIDFormatted, getSafePatientData } from '@/lib/utils';
import { normalizePatient } from '@/lib/patientHelpers';
import { Loader2, PackageX, CalendarClock, AlertCircle, Trash2, CheckCircle, XCircle, RotateCcw } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from '@/contexts/SupabaseAuthContext';

const PatientDialog = ({ open, onOpenChange, onSubmit, initialData, onDelete }) => {
  const { toast } = useToast();
  const { user } = useAuth();
  
  // Helper to safely format date for HTML input
  const safeDate = (dateVal) => {
      if (!dateVal) return '';
      try {
          return typeof dateVal === 'string' && dateVal.includes('T') 
            ? dateVal.split('T')[0] 
            : dateVal;
      } catch (e) {
          return '';
      }
  };

  const [formData, setFormData] = useState({
    full_name: '',
    nickname: '',
    nickname_custom: false,
    medical_record_number: '', 
    phone: '',
    gender: 'Laki-laki',
    birth_date: '',
    address: '',
    nik: '',
    additional_info_option_id: null
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [packages, setPackages] = useState([]);
  const [dailyRecaps, setDailyRecaps] = useState([]);
  const [packageDefinitions, setPackageDefinitions] = useState([]);
  const [loadingPackages, setLoadingPackages] = useState(false);
  const [additionalInfoOptions, setAdditionalInfoOptions] = useState([]);
  
  useEffect(() => {
      const fetchOptions = async () => {
          try {
            if (!user) return; 
            const { data, error } = await getAdditionalInfoOptions();
            if (error) throw error;
            if (data) setAdditionalInfoOptions(data);
          } catch (err) {
            console.error("Error fetching additional info options:", err);
          }
      };
      if (open) {
        fetchOptions();
      }
  }, [open, user]);

  useEffect(() => {
    if (open && initialData) {
      // Normalize first to ensure consistent fields
      const normalizedData = normalizePatient(initialData);
      
      setFormData({
        full_name: normalizedData.full_name || '',
        nickname: normalizedData.nickname || '',
        nickname_custom: initialData.nickname_custom || false,
        medical_record_number: normalizedData.medical_record_number || '',
        phone: normalizedData.phone || '', // Using standardized 'phone' field
        gender: normalizedData.genderLabel === 'Laki-laki' || normalizedData.genderLabel === 'Perempuan' 
               ? normalizedData.genderLabel 
               : 'Laki-laki',
        birth_date: safeDate(normalizedData.birth_date),
        address: normalizedData.address === '-' ? '' : normalizedData.address || '',
        nik: normalizedData.nik || '',
        additional_info_option_id: normalizedData.additional_info_option_id || normalizedData.additional_info?.id || null
      });
      
      if (initialData.id) {
          fetchPatientPackages(initialData.id);
      }
    } else if (open) {
      setFormData({
        full_name: '',
        nickname: '',
        nickname_custom: false,
        medical_record_number: '',
        phone: '',
        gender: 'Laki-laki',
        birth_date: '',
        address: '',
        nik: '',
        additional_info_option_id: null
      });
      setPackages([]);
      setDailyRecaps([]);
      setErrors({});
    }
  }, [open, initialData]);

  useEffect(() => {
    if (!formData.nickname_custom && formData.full_name && formData.birth_date && formData.gender) {
        const generated = generateNickname(formData.full_name, formData.gender, formData.birth_date);
        if (generated && generated !== formData.nickname) {
            setFormData(prev => ({ ...prev, nickname: generated }));
        }
    }
  }, [formData.full_name, formData.birth_date, formData.gender, formData.nickname_custom]);

  const validateField = (name, value) => {
    let error = '';
    
    if (name === 'full_name') {
        if (!value || (typeof value === 'string' && !value.trim())) {
            return 'Nama Lengkap wajib diisi';
        }
    }

    if (name === 'birth_date') {
        const dateRes = validateBirthDate(value);
        if (!dateRes.valid) return dateRes.error;
    }

    if (name === 'gender') {
        const genderRes = validateGender(value);
        if (!genderRes.valid) return genderRes.error;
    }

    if (name === 'phone') {
         if (!value) return 'No. HP wajib diisi';
         const cleanPhone = String(value).replace(/\D/g, '');
         if (cleanPhone.length < 8 || cleanPhone.length > 15) {
             return 'No. HP harus 8-15 digit';
         }
    }

    if (name === 'nik' && value) {
         if (!/^\d+$/.test(value) || value.length > 16) {
             return 'NIK harus angka dan maksimal 16 digit';
         }
    }
    
    if (name === 'address' && value && value.length > 500) {
        return 'Alamat maksimal 500 karakter';
    }
    
    if (name === 'additional_info_option_id' && value) {
         const uuidRes = validateUUIDFormatted(value);
         if (!uuidRes.valid) return 'Pilihan Info Tambahan tidak valid';
    }

    return error;
  };

  const handleInputChange = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
    const error = validateField(name, value);
    setErrors(prev => ({ ...prev, [name]: error }));
  };

  const handleNicknameChange = (value) => {
      if (value === '') {
          setFormData(prev => ({ ...prev, nickname: '', nickname_custom: false }));
      } else {
          setFormData(prev => ({ ...prev, nickname: value, nickname_custom: true }));
      }
  };

  const fetchPatientPackages = async (patientId) => {
    if (!user) return;
    setLoadingPackages(true);
    try {
        const [pkgRes, recapsRes, defsRes] = await Promise.all([
          supabase
            .from('package_tracking')
            .select('*')
            .eq('patient_id', patientId)
            .order('created_at', { ascending: false }),
          supabase
            .from('daily_recaps')
            .select('*, patient:patients!daily_recaps_patient_id_fkey(full_name)')
            .eq('patient_id', patientId)
            .order('recap_date', { ascending: true }),
          supabase.from('operational_options')
            .select('*')
            .in('category', ['tipe_paket', 'package_type'])
        ]);
        
        if (pkgRes.error) throw pkgRes.error;
        if (recapsRes.error) throw recapsRes.error;
        
        setPackages(pkgRes.data || []);
        setDailyRecaps(recapsRes.data || []);
        setPackageDefinitions(defsRes.data || []);

    } catch (err) {
        console.error("Failed to load packages", err);
    } finally {
        setLoadingPackages(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!user) {
      toast({ variant: "destructive", title: "Sesi Berakhir", description: "Silakan login kembali." });
      return;
    }

    let finalData = { ...formData };
    if (!finalData.nickname && finalData.full_name && finalData.gender && finalData.birth_date) {
        const autoNick = generateNickname(finalData.full_name, finalData.gender, finalData.birth_date);
        if (autoNick) {
            finalData.nickname = autoNick;
        }
    }

    if (finalData.nik) {
        finalData.nik = finalData.nik.substring(0, 16);
    }
    
    // Strict Field Validation
    const requiredFields = ['full_name', 'birth_date', 'phone', 'gender'];
    const newErrors = {};
    let hasError = false;

    requiredFields.forEach(field => {
      const error = validateField(field, finalData[field]);
      if (error) {
          newErrors[field] = error;
          hasError = true;
      }
    });
    
    // Check optionals
    ['nik', 'address', 'additional_info_option_id'].forEach(field => {
        if(finalData[field]) {
             const error = validateField(field, finalData[field]);
             if (error) {
                 newErrors[field] = error;
                 hasError = true;
             }
        }
    });
    
    if (hasError) {
       setErrors(newErrors);
       toast({ 
           variant: "destructive", 
           title: "Validasi Gagal", 
           description: "Mohon perbaiki field yang ditandai merah." 
       });
       return;
    }
    
    setIsSubmitting(true);
    try {
      const result = await onSubmit(finalData);
      
      if (result && result.error) {
          console.error(`[PatientDialog] Update failed:`, result.error);
          toast({ 
              variant: "destructive", 
              title: "Gagal Menyimpan", 
              description: result.error.message || "Terjadi kesalahan saat menyimpan.",
          });
      }

    } catch (error) {
      console.error(`[PatientDialog] Unexpected error:`, error);
      toast({ 
          variant: "destructive", 
          title: "Error Sistem", 
          description: error.message || "Terjadi kesalahan yang tidak terduga.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteClick = () => {
    if (onDelete && initialData) {
        onOpenChange(false); 
        onDelete(initialData); 
    }
  };

  const ValidationIcon = ({ field }) => {
     if (!formData[field]) return null;
     return errors[field] ? 
       <XCircle className="w-4 h-4 text-red-500 absolute right-3 top-3" /> : 
       <CheckCircle className="w-4 h-4 text-green-500 absolute right-3 top-3" />;
  };

  const activeErrorCount = Object.values(errors).filter(err => err && err.length > 0).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initialData ? 'Edit Data Pasien' : 'Tambah Pasien Baru'}</DialogTitle>
          <DialogDescription>
            {initialData ? 'Perbarui informasi pasien.' : 'Masukkan data lengkap pasien baru.'}
          </DialogDescription>
        </DialogHeader>
        
        {activeErrorCount > 0 && (
            <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                    Terdapat {activeErrorCount} field yang tidak valid. Periksa pesan error di bawah input.
                </AlertDescription>
            </Alert>
        )}

        <Tabs defaultValue="profile" className="w-full mt-4">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="profile">Profil Pasien</TabsTrigger>
                <TabsTrigger value="packages" disabled={!initialData}>Paket & Sesi</TabsTrigger>
            </TabsList>
            
            <TabsContent value="profile" className="focus-visible:outline-none focus-visible:ring-0">
                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    
                    {/* Full Name */}
                    <div className="space-y-1 relative">
                      <Label htmlFor="full_name" className="flex items-center gap-1">
                        Nama Lengkap <span className="text-red-500">*</span>
                      </Label>
                      <div className="relative">
                        <Input 
                          id="full_name" 
                          value={formData.full_name} 
                          onChange={(e) => handleInputChange('full_name', e.target.value)}
                          onBlur={(e) => handleInputChange('full_name', e.target.value)}
                          className={`bg-white pr-10 ${errors.full_name ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                          placeholder="Contoh: Budi Santoso"
                        />
                        <ValidationIcon field="full_name" />
                      </div>
                      {errors.full_name && <p className="text-xs text-red-500 mt-1">{errors.full_name}</p>}
                    </div>

                    {/* Nickname */}
                    <div className="space-y-1 relative">
                      <Label htmlFor="nickname" className="flex items-center gap-1">
                        Nama Panggilan
                        <span className="text-xs text-slate-400 font-normal ml-auto">
                            {formData.nickname_custom ? "(Manual)" : "(Auto)"}
                        </span>
                      </Label>
                      <div className="relative">
                        <Input 
                          id="nickname" 
                          value={formData.nickname} 
                          onChange={(e) => handleNicknameChange(e.target.value)}
                          className={`bg-white pr-10 ${!formData.nickname_custom && formData.nickname ? 'border-blue-300 bg-blue-50' : ''}`}
                          placeholder="Contoh: Budi"
                        />
                      </div>
                    </div>

                    {/* Medical Record Number */}
                    <div className="space-y-1">
                      <Label htmlFor="medical_record_number">No. Rekam Medis (Auto)</Label>
                      <Input 
                        id="medical_record_number" 
                        value={formData.medical_record_number || "Akan Digenerate Otomatis"} 
                        disabled
                        className="bg-slate-50 font-mono text-slate-500"
                      />
                    </div>

                    {/* Gender - REQUIRED */}
                    <div className="space-y-1">
                      <Label htmlFor="gender" className="flex items-center gap-1">
                        Jenis Kelamin <span className="text-red-500">*</span>
                      </Label>
                      <Select 
                        value={formData.gender} 
                        onValueChange={(value) => handleInputChange('gender', value)}
                      >
                        <SelectTrigger className={`bg-white ${errors.gender ? 'border-red-500 ring-1 ring-red-500' : ''}`}>
                          <SelectValue placeholder="Pilih" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Laki-laki">Laki-laki</SelectItem>
                          <SelectItem value="Perempuan">Perempuan</SelectItem>
                        </SelectContent>
                      </Select>
                      {errors.gender && <p className="text-xs text-red-500 mt-1">{errors.gender}</p>}
                    </div>

                    {/* Birth Date - REQUIRED */}
                    <div className="space-y-1">
                      <Label htmlFor="birth_date" className="flex items-center gap-1">
                        Tanggal Lahir <span className="text-red-500">*</span>
                      </Label>
                      <Input 
                        id="birth_date" 
                        type="date"
                        value={formData.birth_date} 
                        onChange={(e) => handleInputChange('birth_date', e.target.value)} 
                        onBlur={(e) => handleInputChange('birth_date', e.target.value)}
                        className={`bg-white ${errors.birth_date ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                      />
                      {errors.birth_date && <p className="text-xs text-red-500 mt-1">{errors.birth_date}</p>}
                    </div>

                    {/* Phone - REQUIRED */}
                    <div className="space-y-1 relative">
                      <Label htmlFor="phone" className="flex items-center gap-1">
                        No. HP (WhatsApp) <span className="text-red-500">*</span>
                      </Label>
                      <div className="relative">
                        <Input 
                          id="phone" 
                          value={formData.phone} 
                          onChange={(e) => handleInputChange('phone', e.target.value)}
                          onBlur={(e) => handleInputChange('phone', e.target.value)}
                          className={`bg-white pr-10 ${errors.phone ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                          placeholder="08..."
                        />
                        <ValidationIcon field="phone" />
                      </div>
                      {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone}</p>}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* NIK */}
                      <div className="space-y-1 relative">
                        <Label htmlFor="nik" className="flex items-center gap-1">
                            NIK (KTP)
                        </Label>
                        <div className="relative">
                           <Input 
                              id="nik" 
                              value={formData.nik} 
                              onChange={(e) => handleInputChange('nik', e.target.value)}
                              onBlur={(e) => handleInputChange('nik', e.target.value)}
                              className={`bg-white pr-10 ${errors.nik ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                              placeholder="16 digit angka (Opsional)"
                              maxLength={16}
                            />
                            <ValidationIcon field="nik" />
                        </div>
                        {errors.nik && <p className="text-xs text-red-500 mt-1">{errors.nik}</p>}
                      </div>

                      {/* Additional Info */}
                      <div className="space-y-1 relative">
                        <Label htmlFor="additional_info" className="flex items-center gap-1">
                            Info Tambahan
                        </Label>
                        <Select 
                            value={formData.additional_info_option_id || "none"} 
                            onValueChange={(value) => handleInputChange('additional_info_option_id', value === "none" ? null : value)}
                        >
                            <SelectTrigger className={`bg-white ${errors.additional_info_option_id ? 'border-red-500 ring-1 ring-red-500' : ''}`}>
                                <SelectValue placeholder="Pilih Sumber Info" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">Tidak dipilih</SelectItem>
                                {additionalInfoOptions.map(opt => (
                                    <SelectItem key={opt.id} value={opt.id}>{opt.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {errors.additional_info_option_id && <p className="text-xs text-red-500 mt-1">{errors.additional_info_option_id}</p>}
                      </div>
                  </div>

                  {/* Address */}
                  <div className="space-y-1">
                    <Label htmlFor="address" className="flex items-center gap-1">
                        Alamat Domisili
                    </Label>
                    <Input 
                      id="address" 
                      value={formData.address} 
                      onChange={(e) => handleInputChange('address', e.target.value)}
                      className={`bg-white ${errors.address ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                      placeholder="Jalan, Kota..."
                    />
                    {errors.address && <p className="text-xs text-red-500 mt-1">{errors.address}</p>}
                  </div>

                  <DialogFooter className="pt-4 flex justify-between items-center w-full">
                    {initialData && onDelete ? (
                        <Button 
                            type="button" 
                            variant="destructive" 
                            onClick={handleDeleteClick}
                            className="mr-auto"
                        >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Hapus
                        </Button>
                    ) : <div></div>}
                    
                    <div className="flex gap-2">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
                        <Button type="submit" disabled={isSubmitting || activeErrorCount > 0}>
                            {isSubmitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin"/> Menyimpan...</> : 'Simpan Data'}
                        </Button>
                    </div>
                  </DialogFooter>
                </form>
            </TabsContent>
            
            <TabsContent value="packages" className="py-4 focus-visible:outline-none focus-visible:ring-0">
                {loadingPackages ? (
                    <div className="flex justify-center py-10">
                        <Loader2 className="animate-spin w-8 h-8 text-blue-500" />
                    </div>
                ) : packages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-slate-500 border-2 border-dashed border-slate-200 rounded-lg">
                        <PackageX className="w-10 h-10 mb-2 opacity-20" />
                        <p className="font-medium">Belum ada paket yang terdaftar</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 gap-4">
                            {packages.map(pkg => {
                                // Calculate package status helper function
                                const sessionData = calculatePackageSessionsFromRecaps(
                                    initialData?.full_name || 'N/A',
                                    pkg.package_name,
                                    pkg.start_date,
                                    dailyRecaps,
                                    packageDefinitions,
                                    pkg 
                                );

                                return (
                                    <div key={pkg.id} className="relative">
                                        <PackageSessionDisplay 
                                            packageName={pkg.package_name}
                                            sessionData={sessionData}
                                        />
                                        
                                        <div className="mt-2 flex items-center justify-between text-xs bg-slate-50 p-2 rounded border border-slate-100">
                                            <div className="flex items-center gap-2">
                                                <CalendarClock className="w-3.5 h-3.5 text-slate-500" />
                                                <span className="text-slate-600 font-medium">
                                                    Masa Berlaku Hingga: 
                                                    <span className="text-slate-900 ml-1 font-semibold">{sessionData.packageEndDate}</span>
                                                </span>
                                            </div>
                                            
                                            <div>
                                                {sessionData.status === 'expired' ? (
                                                    <Badge variant="destructive" className="text-[10px] h-5">
                                                        <AlertCircle className="w-3 h-3 mr-1" /> Expired
                                                    </Badge>
                                                ) : sessionData.status === 'selesai' ? (
                                                    <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-200 border-none shadow-none text-[10px] h-5">
                                                        Selesai
                                                    </Badge>
                                                ) : sessionData.status === 'diperpanjang' ? (
                                                    <Badge className="bg-indigo-100 text-indigo-700 hover:bg-indigo-200 border-none shadow-none text-[10px] h-5">
                                                        Diperpanjang
                                                    </Badge>
                                                ) : (
                                                    <Badge className="bg-green-100 text-green-700 hover:bg-green-200 border-none shadow-none text-[10px] h-5">
                                                        Aktif
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

// Internal Helper for Packages display
const calculatePackageSessionsFromRecaps = (patientName, packageName, startDate, dailyRecaps, packageDefinitions, pkg) => {
    if (!packageName) return { totalSessions: 0, sessionUsed: 0, remaining: 0, packageEndDate: null, status: 'unknown', extendedUntil: null };

    const def = packageDefinitions.find(d => 
        d.label && d.label.toLowerCase() === packageName.toLowerCase()
    );
    
    const sessionCount = def?.session_count || 0;
    const validityDays = def?.validity_days || 30;
    
    let expiryDate = null;
    if (startDate) {
        const start = new Date(startDate);
        const end = new Date(start);
        end.setDate(end.getDate() + validityDays);
        expiryDate = end.toISOString().split('T')[0];
    }
    
    const used = dailyRecaps.filter(r => {
        const recapDate = new Date(r.recap_date);
        const start = new Date(startDate);
        const isAfterStart = recapDate >= start;
        const recapPackage = r.package_type || '';
        return isAfterStart && recapPackage.toLowerCase().includes(packageName.toLowerCase());
    }).length;
    
    const remaining = Math.max(0, sessionCount - used);
    
    let status = pkg.status || 'aktif';
    const now = new Date();
    
    if (!pkg.status) {
        if (expiryDate && new Date(expiryDate) < now) {
            status = 'expired';
        } else if (remaining === 0 && sessionCount > 0) {
            status = 'selesai';
        }
    }
    
    return {
        totalSessions: sessionCount,
        sessionUsed: used,
        remaining,
        packageEndDate: expiryDate,
        status,
        extendedUntil: pkg.extended_until
    };
};

export default PatientDialog;