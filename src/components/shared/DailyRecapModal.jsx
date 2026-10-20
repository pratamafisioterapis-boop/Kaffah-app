import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar as CalendarIcon, Loader2, Save, Plus, Trash2 } from 'lucide-react';
import SearchableSelect from '@/components/ui/searchable-select';
import { rankDiagnosisOptions } from '@/lib/diagnosisSearch';
import DatePicker from '@/components/DatePicker';
import { useToast } from '@/components/ui/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import PackageInfoCard from './PackageInfoCard';
import RecapInvoiceItems, { itemsNetTotal } from './RecapInvoiceItems';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import ExtendPackageModal from './ExtendPackageModal';
import { supabase } from '@/lib/customSupabaseClient';
import { 
    getPhysiotherapists, 
    createDailyRecap, 
    updateDailyRecap,
    getPatients,
    getServiceOptions,
    getDiagnosisOptions,
    getPatientTypeOptions,
    getPackageOptions,
    getPaymentMethodOptions,
    getDiscountTypeOptions,
    lookupReferralReward,
    getActiveReferralRewards,
    getReferralRewardById,
    getPatientActivePackage,
    extendPackage
} from '@/lib/api';
import { createOperationalOption } from '@/lib/api';
import { useSoapFirstSettings, useRecapQuote } from '@/hooks/useSoapFirst';
import { isSoapFirstActiveOn, ttvRequiredFor } from '@/lib/soapFirst';
import SoapOverrideDialog from './SoapOverrideDialog';

import { 
    parseDateFromDisplay,
    displayDateID as formatDateDisplay
} from '@/lib/dateFormatHelpers';

const useDebounce = (value, delay) => {
    const [debouncedValue, setDebouncedValue] = useState(value);
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);
        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);
    return debouncedValue;
};

const DailyRecapModal = ({ isOpen, onClose, mode = 'add', initialData = null, onSuccess }) => {
    const { toast } = useToast();
    const { userDetails } = useAuth();

    // Klinik dengan template invoice "kwitansi": item invoice dipilih dari katalog
    // harga langsung di recap, field "Tipe Layanan" & diskon recap tidak dipakai.
    const [isKwitansi, setIsKwitansi] = useState(false);
    const [invoiceItems, setInvoiceItems] = useState([]);

    useEffect(() => {
        if (!isOpen || !userDetails?.clinic_id) { setIsKwitansi(false); return; }
        let cancelled = false;
        supabase.from('clinics').select('invoice_template').eq('id', userDetails.clinic_id).maybeSingle()
            .then(({ data }) => { if (!cancelled) setIsKwitansi(data?.invoice_template === 'kwitansi'); });
        return () => { cancelled = true; };
    }, [isOpen, userDetails?.clinic_id]);

    useEffect(() => {
        if (!isOpen) return;
        if (mode !== 'edit' || !initialData?.id) { setInvoiceItems([]); return; }
        let cancelled = false;
        supabase.from('daily_recaps').select('invoice_items').eq('id', initialData.id).maybeSingle()
            .then(({ data }) => {
                if (cancelled) return;
                setInvoiceItems(Array.isArray(data?.invoice_items) ? data.invoice_items : []);
            });
        return () => { cancelled = true; };
    }, [isOpen, mode, initialData?.id]);

    // Nominal recap = total bersih item invoice (kecuali sesi paket Rp 0 yang terkunci).
    useEffect(() => {
        if (!isKwitansi || isPackageSessionLocked || invoiceItems.length === 0) return;
        const total = Math.round(itemsNetTotal(invoiceItems));
        setFormData(prev => (Number(prev.amount) === total ? prev : { ...prev, amount: total }));
    }, [isKwitansi, invoiceItems]);

    // 🔥 CREATE DIAGNOSA (FLOW BARU DENGAN POPUP SERVICE)
    const handleCreateDiagnosis = async (label) => {
      // simpan label sementara
      setPendingDiagnosisLabel(label);
      setSelectedParentService('');
      // buka popup pilih service
      setShowServicePicker(true);
      // true = tutup dropdown diagnosa. Dropdown di-portal dengan z-[9999] sehingga
      // kalau dibiarkan terbuka ia menutupi popup pilih layanan dan diagnosa baru
      // tidak bisa disimpan.
      return true;
    };

    // 🔥 KONFIRMASI SIMPAN DIAGNOSA SETELAH PILIH SERVICE
    const handleConfirmCreateDiagnosis = async () => {
      if (!selectedParentService) {
        toast({
          variant: "destructive",
          title: "Pilih Service",
          description: "Silakan pilih layanan untuk diagnosa ini."
        });
        return;
      }

      try {
        const result = await createOperationalOption(
          'diagnosa',
          pendingDiagnosisLabel,
          { parent_id: selectedParentService }
        );

        if (result.error) throw result.error;

        const newOption = result.data;

        const formattedOption = {
          value: newOption.id,
          label: newOption.label,
          parent_id: newOption.parent_id
        };

        // Tambahkan ke dropdown diagnosa
        setDiagnosisOptions(prev => [...prev, formattedOption]);

        // Auto select diagnosa & service
        setFormData(prev => ({
          ...prev,
          diagnosis: [...(prev.diagnosis || []), newOption.id],
          service_type: selectedParentService
        }));

        // Reset popup state
        setShowServicePicker(false);
        setPendingDiagnosisLabel(null);
        setSelectedParentService('');

        toast({
          title: "Berhasil",
          description: "Diagnosa berhasil ditambahkan."
        });

      } catch (err) {
        toast({
          variant: "destructive",
          title: "Gagal",
          description: err.message
        });
      }
    };
    
    // Core Data
    const [therapists, setTherapists] = useState([]);
    const [isLoadingCoreData, setIsLoadingCoreData] = useState(false);

    // Form State
    const [formData, setFormData] = useState({});
    
    // 🔥 CREATE DIAGNOSA FLOW STATE
    const [pendingDiagnosisLabel, setPendingDiagnosisLabel] = useState(null);
    const [showServicePicker, setShowServicePicker] = useState(false);
    const [selectedParentService, setSelectedParentService] = useState('');
    
    // Package Logic State
    const [selectedPackage, setSelectedPackage] = useState(null);
    const [isPackageExpired, setIsPackageExpired] = useState(false);
    const [showExtendModal, setShowExtendModal] = useState(false);
    const [extendLoading, setExtendLoading] = useState(false);

    // Searchable Options State - Initialize as empty arrays
    const [patientOptions, setPatientOptions] = useState([]);
    const [serviceOptions, setServiceOptions] = useState([]);
    const [diagnosisOptions, setDiagnosisOptions] = useState([]);
    const [patientTypeOptions, setPatientTypeOptions] = useState([]);
    const [packageOptions, setPackageOptions] = useState([]);
    const [paymentMethodOptions, setPaymentMethodOptions] = useState([]);
    const [discountTypeOptions, setDiscountTypeOptions] = useState([]);

    // Search terms state
    const [patientSearch, setPatientSearch] = useState('');
    const [serviceSearch, setServiceSearch] = useState('');
    const [diagnosisSearch, setDiagnosisSearch] = useState('');
    const [patientTypeSearch, setPatientTypeSearch] = useState('');
    const [packageSearch, setPackageSearch] = useState('');
    const [paymentMethodSearch, setPaymentMethodSearch] = useState('');
    const [discountTypeSearch, setDiscountTypeSearch] = useState('');
    // Kode reward referral: reward yang sedang dipakai di rekap ini + daftar reward aktif pasien
    const [rewardCode, setRewardCode] = useState('');
    const [rewardInfo, setRewardInfo] = useState(null);
    const [rewardError, setRewardError] = useState('');
    const [rewardChecking, setRewardChecking] = useState(false);
    const [activeRewards, setActiveRewards] = useState([]);

    // Loading states for each dropdown
    const [loadingPatients, setLoadingPatients] = useState(false);
    const [loadingServices, setLoadingServices] = useState(false);
    const [loadingDiagnoses, setLoadingDiagnoses] = useState(false);
    const [loadingPatientTypes, setLoadingPatientTypes] = useState(false);
    const [loadingPackages, setLoadingPackages] = useState(false);
    const [loadingPaymentMethods, setLoadingPaymentMethods] = useState(false);
    const [loadingDiscountTypes, setLoadingDiscountTypes] = useState(false);
    
    // Other states
    const [errors, setErrors] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState('');
    const [showDatePicker, setShowDatePicker] = useState(false);
    // Terkunci kalau recap ini SUDAH tertaut ke paket dengan nominal Rp 0 (sesi
    // pakai kuota paket, bukan transaksi pembelian) - dicek langsung ke DB
    // (bukan dari initialData yang bisa basi) supaya admin tidak bisa lagi
    // salah ketik nominal di sesi yang seharusnya gratis.
    const [isPackageSessionLocked, setIsPackageSessionLocked] = useState(false);

    // Split payment: satu recap dibayar dengan lebih dari 1 metode
    // (mis. QRIS 200rb + Cash 50rb untuk tagihan 250rb).
    const [useSplitPayment, setUseSplitPayment] = useState(false);
    const [paymentSplits, setPaymentSplits] = useState([{ payment_method: '', amount: '' }]);

    // DEBUG: Log initial data
    useEffect(() => {
        if (isOpen) {
        }
    }, [isOpen, initialData, mode]);

    useEffect(() => {
        if (!isOpen || mode !== 'edit' || !initialData?.id) {
            setIsPackageSessionLocked(false);
            return;
        }
        let cancelled = false;
        (async () => {
            const { data, error } = await supabase
                .from('daily_recaps')
                .select('package_tracking_id, amount, amount_original')
                .eq('id', initialData.id)
                .maybeSingle();
            if (cancelled || error || !data) return;
            const currentAmount = Number(data.amount_original ?? data.amount ?? 0);
            setIsPackageSessionLocked(!!data.package_tracking_id && currentAmount === 0);
        })();
        return () => { cancelled = true; };
    }, [isOpen, mode, initialData?.id]);

    // ── SOAP-first (khusus klinik yang mengaktifkannya, mis. Kaffah) ──
    // Server (trigger database) yang menentukan tipe pasien, nominal, dan kunci pembayaran.
    // Form ini hanya menampilkan hasilnya dan menyediakan jalur pengajuan pengecualian.
    const { settings: sfSettings } = useSoapFirstSettings();
    const [recapMeta, setRecapMeta] = useState(null);
    const [overrideDialog, setOverrideDialog] = useState(null);
    const recapIso = (() => {
        try { return formData.recap_date ? parseDateFromDisplay(formData.recap_date) : null; } catch { return null; }
    })();
    const sfActive = isSoapFirstActiveOn(sfSettings, recapIso);
    const sfEdit = sfActive && mode === 'edit' && !!initialData?.id;
    const sfDateLocked = sfEdit;
    const { quote, refresh: refreshQuote } = useRecapQuote(initialData?.id, formData.package_type, isOpen && sfEdit);

    const loadRecapMeta = useCallback(async () => {
        if (!initialData?.id) { setRecapMeta(null); return; }
        const { data } = await supabase
            .from('daily_recaps')
            .select('appointment_id, special_type, free_reason, xtratime, soap_completed_at, invoice_created_at, diagnosis, start_time, created_at, appointment:appointments!appointment_id(appointment_date)')
            .eq('id', initialData.id)
            .maybeSingle();
        setRecapMeta(data || null);
    }, [initialData?.id]);

    useEffect(() => {
        if (isOpen && mode === 'edit') loadRecapMeta(); else setRecapMeta(null);
    }, [isOpen, mode, loadRecapMeta]);

    // Diskon manual (mis. "Keluarga"): nilai diinput admin lalu wajib disetujui owner.
    const [manualOverride, setManualOverride] = useState(null);
    const [manualInput, setManualInput] = useState({ type: 'percentage', value: '' });
    const selectedDiscountOpt = discountTypeOptions.find(o => o.label === formData.discount_label);
    const sfManualDiscount = sfEdit && !!selectedDiscountOpt && (!selectedDiscountOpt.discount_value_type || !(Number(selectedDiscountOpt.discount_value) > 0));
    const loadManualOverride = useCallback(async () => {
        if (!initialData?.id) { setManualOverride(null); return; }
        const { data } = await supabase
            .from('soap_overrides')
            .select('id, status, payload, decision_note')
            .eq('recap_id', initialData.id)
            .eq('kind', 'manual_discount')
            .order('requested_at', { ascending: false })
            .limit(1)
            .maybeSingle();
        setManualOverride(data || null);
    }, [initialData?.id]);
    useEffect(() => {
        if (isOpen && sfEdit) loadManualOverride(); else setManualOverride(null);
    }, [isOpen, sfEdit, loadManualOverride]);

    useEffect(() => {
        if (!recapMeta) return;
        setFormData(prev => ({ ...prev, special_type: recapMeta.special_type || '', free_reason: recapMeta.free_reason || '' }));
    }, [recapMeta]);

    const initializeForm = () => {
        try {
            setSelectedPackage(null);
            setIsPackageExpired(false);
            // Modal tetap ter-mount antar pasien: reset kode reward supaya tidak terbawa dari recap sebelumnya
            setRewardInfo(null);
            setRewardCode('');
            setRewardError('');
            setActiveRewards([]);
            
            if (mode === 'edit' && initialData) {
                const dateStr = initialData.date || initialData.recap_date;
                const formattedDate = dateStr ? formatDateDisplay(dateStr) : formatDateDisplay(new Date().toISOString());

                const pkgLabel = initialData.package_type || '';

setFormData({
    recap_date: formattedDate,
    patient_id: initialData.patient_id || '',
    actual_patient_id: initialData.actual_patient_id || '', 
    patient_name: initialData.patient_name || '',
    guest_name: initialData.guest_name || '',
    diagnosis: (() => {
  let diag = initialData.raw_diagnosis || initialData.diagnosis || [];

  if (typeof diag === 'string') {
    try { diag = JSON.parse(diag); } catch { diag = []; }
  }

  if (!Array.isArray(diag)) diag = [diag];

  return diag;
})(),
    service_type: initialData.service_type || '',
    patient_type: initialData.patient_type || '',
    package_type_id: '', // ❗ kosong dulu
    package_type: pkgLabel,
    therapist_id: initialData.therapist_id || '', 
    amount: initialData.amount || 0,
    payment_method: initialData.payment_method || '',
    discount_type: initialData.discount_type || 'none',
    discount_value: initialData.discount_value || 0,
    discount_label: initialData.discount_label || '',
    referral_reward_id: initialData.referral_reward_id || ''
});

                const existingSplits = Array.isArray(initialData.payment_splits) ? initialData.payment_splits : [];
                if (existingSplits.length > 1) {
                    setUseSplitPayment(true);
                    setPaymentSplits(existingSplits.map(s => ({ payment_method: s.payment_method, amount: String(s.amount) })));
                } else {
                    setUseSplitPayment(false);
                    setPaymentSplits([{ payment_method: '', amount: '' }]);
                }

                // If editing, try to load current package status
                if (initialData.patient_id) {
                    checkPatientPackage(initialData.patient_id, false); // Don't autofill on edit
                }
            } else {
                setFormData({
                    recap_date: formatDateDisplay(new Date().toISOString()),
                    patient_id: '',
                    actual_patient_id: '',
                    patient_name: '',
                    guest_name: '',
                    diagnosis: [],
                    service_type: '',
                    patient_type: '',
                    package_type_id: '',
                    package_type: '',
                    therapist_id: '',
                    amount: '',
                    payment_method: '',
                    discount_type: 'none',
                    discount_value: 0,
                    discount_label: '',
                    referral_reward_id: ''
                });
                setRewardInfo(null);
                setRewardCode('');
                setUseSplitPayment(false);
                setPaymentSplits([{ payment_method: '', amount: '' }]);
            }
            setErrors({});
        } catch (err) {
            console.error("Error initializing form:", err);
            toast({ variant: "destructive", title: "Error", description: "Gagal inisialisasi form modal." });
        }
    };

    // Helper functions to fetch data
    const fetchPatientOptions = async (term) => {
        setLoadingPatients(true);
        try {
            const { data } = await getPatients(term);
            const newOptions = Array.isArray(data) ? data : [];

            // 🔥 MERGE + HINDARI DUPLIKAT (jangan replace, biar opsi yg sudah ter-inject/dipilih gak hilang)
            setPatientOptions(prev => {
                const merged = [
                    ...newOptions,
                    ...prev.filter(p => !newOptions.some(n => n.value === p.value))
                ];
                return merged;
            });
        } catch (e) { 
            console.error(e); 
            setPatientOptions([]);
        }
        setLoadingPatients(false);
    };

    const fetchServiceOptions = async (term) => {
        setLoadingServices(true);
        try {
            const { data } = await getServiceOptions(term);
            setServiceOptions(Array.isArray(data) ? data : []);
        } catch (e) { 
            console.error(e); 
            setServiceOptions([]);
        }
        setLoadingServices(false);
    };

    const handleSearch = useCallback(async (setter, loaderSetter, fetcher, term) => {
        loaderSetter(true);
        try {
            const data = await fetcher(term);
            const options = data?.data || data || [];
            setter(prev => {
                const newOptions = Array.isArray(options) ? options : [];

                // 🔥 MERGE + HINDARI DUPLIKAT
                const merged = [
                    ...prev,
                    ...newOptions.filter(
                        newOpt => !prev.some(prevOpt => prevOpt.value === newOpt.value)
                    )
                ];

                return merged;
            });
        } catch (e) { 
            console.error(e); 
            setter([]);
        }
        loaderSetter(false);
    }, []);

    const fetchAllOptions = async () => {
        setLoadingPatients(true);
        setLoadingServices(true);
        setLoadingDiagnoses(true);
        setLoadingPatientTypes(true);
        setLoadingPackages(true);
        setLoadingPaymentMethods(true);
        setLoadingDiscountTypes(true);

        try {
            const [
                patientsData,
                services, 
                diagnoses, 
                pTypes, 
                pkgs, 
                payMethods, 
                discTypes
            ] = await Promise.all([
                getPatients(''),
                getServiceOptions(''),
                getDiagnosisOptions(''),
                getPatientTypeOptions(''),
                getPackageOptions(''),
                getPaymentMethodOptions(''),
                getDiscountTypeOptions('')
            ]);
            
            setPatientOptions(Array.isArray(patientsData.data) ? patientsData.data : []);

            // 🔥 FIX PATIENT (UUID vs LABEL mismatch) - inject Pemilik Paket & Pasien Aktual
            if (mode === 'edit' && initialData) {
                setPatientOptions(prev => {
                    let merged = [...prev];

                    if (initialData.patient_id) {
                        const existsOwner = merged.some(opt => opt.value === initialData.patient_id);
                        if (!existsOwner) {
                            const ownerName = initialData.patients?.full_name || initialData.patient_name || 'Tidak diketahui';
                            const ownerRM = initialData.patients?.medical_record_number || 'RM';
                            merged.push({
                                value: initialData.patient_id,
                                label: `${ownerRM} - ${ownerName}`
                            });
                        }
                    }

                    if (initialData.actual_patient_id) {
                        const existsActual = merged.some(opt => opt.value === initialData.actual_patient_id);
                        if (!existsActual) {
                            const actualName = initialData.actual_patients?.full_name || initialData.actual_patient_name || 'Tidak diketahui';
                            const actualRM = initialData.actual_patients?.medical_record_number || 'RM';
                            merged.push({
                                value: initialData.actual_patient_id,
                                label: `${actualRM} - ${actualName}`
                            });
                        }
                    }

                    return merged;
                });
            }

            setServiceOptions(Array.isArray(services?.data || services) ? (services?.data || services) : []);
            
            // 🔥 FIX SERVICE (ID vs LABEL mismatch)
            if (mode === 'edit' && initialData?.service_type) {
                setServiceOptions(prev => {
                    const exists = prev.some(opt => opt.value === initialData.service_type);
                    if (exists) return prev;
            
                    return [
                        ...prev,
                        {
                            value: initialData.service_type,
                            label: initialData.service_type
                        }
                    ];
                });
            }

            setDiagnosisOptions(Array.isArray(diagnoses?.data || diagnoses) ? (diagnoses?.data || diagnoses) : []);
            const HIDDEN_PATIENT_TYPES = ['registered', 'guest'];
            const patientTypeArr = (Array.isArray(pTypes?.data || pTypes) ? (pTypes?.data || pTypes) : [])
              .filter(opt => !HIDDEN_PATIENT_TYPES.includes((opt.label || '').toLowerCase()));
            setPatientTypeOptions(patientTypeArr);

            // 🔥 FIX: inject patient_type existing sebagai option jika berupa label (bukan UUID)
            if (mode === 'edit' && initialData?.patient_type) {
                const existingType = initialData.patient_type;
                const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(existingType);
                if (!isUUID && !HIDDEN_PATIENT_TYPES.includes(existingType.toLowerCase())) {
                    setPatientTypeOptions(prev => {
                        const exists = prev.some(opt => opt.value === existingType || opt.label === existingType);
                        if (exists) return prev;
                        return [...prev, { value: existingType, label: existingType }];
                    });
                }
            }
            const rawPackages = Array.isArray(pkgs?.data || pkgs) ? (pkgs?.data || pkgs) : [];

            setPackageOptions(
              rawPackages.map(p => ({
                value: p.id || p.value || p.package_type_id,
                label: p.name || p.label || p.package_name || p.package_type
              }))
            );

            // 🔥 FIX PACKAGE TYPE (ID vs LABEL mismatch)
            if (mode === 'edit' && initialData) {
                const pkgLabel = initialData.package_type;
                const pkgId = initialData.raw_package_type_id || initialData.package_type_id;
                

                if (pkgLabel || pkgId) {
                    setPackageOptions(prev => {
                        if (pkgId && prev.some(opt => opt.value === pkgId)) return prev;
                        if (prev.some(opt => opt.label === pkgLabel)) return prev;
                
                        const injectId = pkgId || pkgLabel;
                        const injectLabel = pkgLabel || 'Package';

                        return [
                            ...prev,
                            {
                                value: injectId,
                                label: injectLabel
                            }
                        ];
                    });
                }
            }

            setPaymentMethodOptions(Array.isArray(payMethods?.data || payMethods) ? (payMethods?.data || payMethods) : []);
            setDiscountTypeOptions(Array.isArray(discTypes?.data || discTypes) ? (discTypes?.data || discTypes) : []);
            
            // 🔥 FIX EDIT VALUE AGAR TIDAK KOSONG
            if (mode === 'edit' && initialData) {
                const inject = (setter, value) => {
                    if (!value) return;
                    setter(prev => {
                        const exists = prev.some(opt => opt.value === value);
                        if (exists) return prev;
                        return [...prev, { value, label: value }];
                    });
                };
            
                // ✅ FIELD YANG KOSONG KEMARIN (skip hidden types)
                if (!HIDDEN_PATIENT_TYPES.includes((initialData.patient_type || '').toLowerCase())) {
                    inject(setPatientTypeOptions, initialData.patient_type);
                }
                inject(setServiceOptions, initialData.service_type);
                inject(setPaymentMethodOptions, initialData.payment_method);
            
                // 🔥 DIAGNOSIS (ARRAY)
                let diag = initialData.raw_diagnosis || initialData.diagnosis || [];
            
                if (typeof diag === 'string') {
                    try { diag = JSON.parse(diag); } catch { diag = [diag]; }
                }
                if (!Array.isArray(diag)) diag = [diag];
            
                setDiagnosisOptions(prev => {
                    const missing = diag.filter(id => !prev.some(d => d.value === id));
                    if (missing.length === 0) return prev;
            
                    return [
                        ...prev,
                        ...missing.map(id => ({
                            value: id,
                            label: id
                        }))
                    ];
                });
            }

            // Fix for pre-populating services if not in list
            if (mode === 'edit' && initialData) {
                const currentServices = Array.isArray(services?.data || services) ? (services?.data || services) : [];
                if (initialData.service_type && !currentServices.some(o => o.value === initialData.service_type)) {
                   setServiceOptions(prev => [...prev, {value: initialData.service_type, label: initialData.service_type}]);
                }
            }

        } catch (error) {
            console.error("Error fetching options:", error);
            // Ensure all are arrays on error
            setPatientOptions(prev => Array.isArray(prev) ? prev : []);
            setServiceOptions(prev => Array.isArray(prev) ? prev : []);
            setDiagnosisOptions(prev => Array.isArray(prev) ? prev : []);
            setPatientTypeOptions(prev => Array.isArray(prev) ? prev : []);
            setPackageOptions(prev => Array.isArray(prev) ? prev : []);
            setPaymentMethodOptions(prev => Array.isArray(prev) ? prev : []);
            setDiscountTypeOptions(prev => Array.isArray(prev) ? prev : []);
        } finally {
            setLoadingPatients(false);
            setLoadingServices(false);
            setLoadingDiagnoses(false);
            setLoadingPatientTypes(false);
            setLoadingPackages(false);
            setLoadingPaymentMethods(false);
            setLoadingDiscountTypes(false);
        }
    };
    
    // 🔥 Timing Fix: Sync formData.package_type_id with packageOptions if we only had a label
    useEffect(() => {
    if (!loadingPackages && packageOptions.length > 0 && formData.package_type) {
        const matched = packageOptions.find(
            p => p.label === formData.package_type
        );

        if (matched) {
            setFormData(prev => ({
                ...prev,
                package_type_id: matched.value
            }));
        }
    }
}, [loadingPackages, packageOptions, formData.package_type]);

    useEffect(() => {
        if (isOpen) {
            initializeForm();
            fetchAllOptions();

            const loadCore = async () => {
                setIsLoadingCoreData(true);
                try {
                    const response = await getPhysiotherapists();
                    if (response.data && Array.isArray(response.data)) {
                      // 1️⃣ Sort aktif dulu, lalu non aktif
                      const sortedTherapists = [...response.data].sort((a, b) => {
                        // Aktif di atas
                        if (a.is_active !== b.is_active) {
                          return a.is_active ? -1 : 1;
                        }
                        // Dalam grup yang sama → A-Z
                        return a.name.localeCompare(b.name);
                      });
                    
                      setTherapists(
                        sortedTherapists.map(t => ({
                          value: t.id,
                          label: t.name
                        }))
                      );
                    } else {
                        setTherapists([]);
                    }
                } catch (e) {
                    console.error("Failed to load therapists:", e);
                    setTherapists([]);
                }
                setIsLoadingCoreData(false);
            };
            loadCore();
        }
    }, [isOpen, initialData, mode]);

    const debouncedPatientSearch = useDebounce(patientSearch, 300);
    useEffect(() => { 
        if (!isOpen) return;
        const load = async () => {
            await fetchPatientOptions(debouncedPatientSearch);
            // AUTO SELECT jika hanya 1 hasil dan belum ada patient_id
            if (
                debouncedPatientSearch.trim() &&
                patientOptions.length === 1 &&
                !formData.patient_id
            ) {
                handlePatientChange(patientOptions[0].value);
            }
        };
        load();
    }, [debouncedPatientSearch, isOpen]);

    const debouncedServiceSearch = useDebounce(serviceSearch, 300);
    useEffect(() => { 
      if (!isOpen) return;
      fetchServiceOptions(debouncedServiceSearch).then(() => {
        // 🔥 INJECT ULANG SETELAH FETCH
        if (mode === 'edit' && initialData?.service_type) {
          setServiceOptions(prev => {
            const exists = prev.some(opt => opt.value === initialData.service_type);
            if (exists) return prev;
            return [
              ...prev,
              {
                value: initialData.service_type,
                label: initialData.service_type
              }
            ];
          });
        }
      });
    }, [debouncedServiceSearch, isOpen]);

    const debouncedDiagnosisSearch = useDebounce(diagnosisSearch, 300);
    useEffect(() => { handleSearch(setDiagnosisOptions, setLoadingDiagnoses, getDiagnosisOptions, debouncedDiagnosisSearch) }, [debouncedDiagnosisSearch]);
    
    useEffect(() => {
        if (!diagnosisOptions.length) return;
        if (!formData.diagnosis?.length) return;

        const missing = formData.diagnosis.filter(id =>
            !diagnosisOptions.some(opt => opt.value === id)
        );

        if (missing.length > 0) {
            setDiagnosisOptions(prev => [
                ...prev,
                ...missing.map(id => ({ value: id, label: "Loading..." }))
            ]);
        }
    }, [diagnosisOptions, formData.diagnosis]);

    // ✅ AUTO FILL SERVICE (MULTIPLE SAFE + RESET WHEN EMPTY)
    useEffect(() => {
        if (!Array.isArray(formData.diagnosis)) return;
        if (!Array.isArray(diagnosisOptions)) return;

        // ✅ 1️⃣ Kalau diagnosis kosong → reset service
        if (formData.diagnosis.length === 0) {
            setFormData(prev => {
                if (!prev.service_type) return prev;
                return {
                    ...prev,
                    service_type: ''
                };
            });
            return;
        }

        if (diagnosisOptions.length === 0) return;

        const selectedDiagnoses = formData.diagnosis
            .map(id => diagnosisOptions.find(d => d?.value === id))
            .filter(Boolean);

        if (selectedDiagnoses.length === 0) return;

        let chosenParent = null;

        // 1️⃣ Jika 1 atau 2 diagnosa → pakai yang pertama
        if (selectedDiagnoses.length <= 2) {
            chosenParent = selectedDiagnoses[0]?.parent_id;
        }
        // 2️⃣ Jika ≥ 3 → ambil parent terbanyak
        else {
            const parentIds = selectedDiagnoses
                .map(d => d.parent_id)
                .filter(Boolean);

            if (parentIds.length === 0) return;

            const frequency = parentIds.reduce((acc, id) => {
                acc[id] = (acc[id] || 0) + 1;
                return acc;
            }, {});

            chosenParent = Object.keys(frequency).reduce((a, b) =>
                frequency[a] >= frequency[b] ? a : b
            );
        }

        if (!chosenParent) return;

        setFormData(prev => {
            if (prev.service_type === chosenParent) return prev;
            return {
                ...prev,
                service_type: chosenParent
            };
        });

    }, [formData.diagnosis, diagnosisOptions, mode]);

    const debouncedPatientTypeSearch = useDebounce(patientTypeSearch, 300);
    useEffect(() => { handleSearch(setPatientTypeOptions, setLoadingPatientTypes, getPatientTypeOptions, debouncedPatientTypeSearch) }, [debouncedPatientTypeSearch]);

    const debouncedPackageSearch = useDebounce(packageSearch, 300);
    useEffect(() => { 
      const load = async () => {
        await handleSearch(setPackageOptions, setLoadingPackages, getPackageOptions, debouncedPackageSearch);

        // 🔥 INJECT ULANG SETELAH FETCH
        if (mode === 'edit' && initialData) {
          const pkgLabel = initialData.package_type;
          const pkgId = initialData.raw_package_type_id || initialData.package_type_id;
          
          if (pkgLabel || pkgId) {
              setPackageOptions(prev => {
                if (pkgId && prev.some(opt => opt.value === pkgId)) return prev;
                if (prev.some(opt => opt.label === pkgLabel)) return prev;
                
                const injectId = pkgId || pkgLabel;
                const injectLabel = pkgLabel || 'Package';
                
                return [
                  ...prev,
                  {
                    value: injectId,
                    label: injectLabel
                  }
                ];
              });
          }
        }
      };
      load();
    }, [debouncedPackageSearch, initialData, mode]);

    const debouncedPaymentMethodSearch = useDebounce(paymentMethodSearch, 300);
    useEffect(() => { handleSearch(setPaymentMethodOptions, setLoadingPaymentMethods, getPaymentMethodOptions, debouncedPaymentMethodSearch) }, [debouncedPaymentMethodSearch]);
    
    const debouncedDiscountTypeSearch = useDebounce(discountTypeSearch, 300);
    useEffect(() => { handleSearch(setDiscountTypeOptions, setLoadingDiscountTypes, getDiscountTypeOptions, debouncedDiscountTypeSearch) }, [debouncedDiscountTypeSearch]);
    
    useEffect(() => {
        if (mode !== 'edit') return;
        if (!initialData) return;

        const value = initialData.raw_package_type_id || initialData.package_type_id || initialData.package_type;
        const label = initialData.package_type;

        if (!value) return;

        // 🔥 PAKSA OPTION MASUK
        setPackageOptions(prev => {
            const exists = prev.some(opt => opt.value === value || opt.label === label);
            if (exists) return prev;

            return [
                ...prev,
                {
                    value: value,
                    label: label || 'Package'
                }
            ];
        });

        // 🔥 PAKSA VALUE SET JIKA KOSONG
        setFormData(prev => {
            if (prev.package_type_id) return prev;
            return {
                ...prev,
                package_type_id: value,
                package_type: label || ''
            };
        });

    }, [initialData, mode]);

    // Reward aktif milik pasien terpilih (petunjuk kode di form diskon)
    useEffect(() => {
        let cancelled = false;
        if (!isOpen || !formData.patient_id) { setActiveRewards([]); return; }
        getActiveReferralRewards(formData.patient_id).then(({ data }) => {
            if (!cancelled) setActiveRewards(data || []);
        });
        return () => { cancelled = true; };
    }, [isOpen, formData.patient_id]);

    // Edit: tampilkan kode reward yang sudah terpasang di rekap ini
    useEffect(() => {
        if (!isOpen || mode !== 'edit' || !initialData?.referral_reward_id) return;
        getReferralRewardById(initialData.referral_reward_id).then(({ data }) => {
            if (!data) return;
            setRewardInfo(data);
            setRewardCode(data.code);
        });
    }, [isOpen, mode, initialData?.referral_reward_id]);

    // Ganti pasien (rekap baru): kode reward milik pasien sebelumnya dilepas
    const rewardPatientRef = useRef(formData.patient_id);
    useEffect(() => {
        if (rewardPatientRef.current !== formData.patient_id) {
            rewardPatientRef.current = formData.patient_id;
            if (mode === 'add' && formData.referral_reward_id) clearReferralReward();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [formData.patient_id]);

    const clearReferralReward = () => {
        setRewardInfo(null);
        setRewardCode('');
        setRewardError('');
        setFormData(prev => ({ ...prev, referral_reward_id: '', discount_type: 'none', discount_value: 0, discount_label: '' }));
    };

    const applyReferralReward = async () => {
        const code = rewardCode.trim();
        if (!code) return;
        if (!formData.patient_id) {
            setRewardError('Pilih pasien terlebih dahulu.');
            return;
        }
        setRewardChecking(true);
        setRewardError('');
        try {
            const { data, error } = await lookupReferralReward(code, formData.patient_id, mode === 'edit' ? initialData?.id : null);
            if (error) throw error;
            if (!data?.valid) {
                setRewardError(data?.reason || 'Kode reward tidak valid.');
                return;
            }
            setRewardInfo(data);
            setRewardCode(data.code);
            setFormData(prev => ({
                ...prev,
                referral_reward_id: data.id,
                discount_type: data.discount_value_type,
                discount_value: String(data.discount_value),
                discount_label: data.discount_label
            }));
        } catch (err) {
            setRewardError(err.message || 'Gagal memeriksa kode reward.');
        } finally {
            setRewardChecking(false);
        }
    };

    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        if (errors[field]) setErrors(prev => ({ ...prev, [field]: null }));
    };

    // --- Package Management Logic ---
    const checkPatientPackage = async (patientId, shouldAutofill = true) => {
        if (!patientId) {
            setSelectedPackage(null);
            setIsPackageExpired(false);
            return;
        }

        try {
            const { data: pkg } = await getPatientActivePackage(patientId);
            
            if (pkg) {
                // Determine expired status locally (pakai tanggal kalender WITA,
                // bukan UTC mentah - supaya konsisten dgn filter tanggal lain)
                const today = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().split('T')[0];
                const endDate = pkg.extended_until || pkg.end_date;
                const isActuallyExpired = pkg.status === 'expired' || (endDate && endDate < today && pkg.sessions_used < pkg.total_sessions);

                setSelectedPackage(pkg);
                setIsPackageExpired(isActuallyExpired);
            } else {
                setSelectedPackage(null);
                setIsPackageExpired(false);
            }
        } catch (e) {
            console.error("Error checking package:", e);
        }
    };
    
    useEffect(() => {
        if (!selectedPackage) return;

        const pkg = selectedPackage;

        // 🔹 Ambil ID tipe paket langsung dari package_tracking
        const packageTypeId = pkg.package_type_id;
        const packageLabel = pkg.package_name;

        // 🔹 Pastikan option tersedia di dropdown
        const exists = packageOptions.some(o => o.value === packageTypeId);

        if (!exists && packageTypeId && packageLabel) {
            setPackageOptions(prev => [
                ...prev,
                { value: packageTypeId, label: packageLabel }
            ]);
        }

        // Saat edit recap yang sudah ada, jangan autofill amount/payment_method
        // (nilai historis recap tidak boleh ditimpa) — tapi Jenis Paket tetap
        // harus ikut ter-set dari paket aktif pasien, kalau belum terisi.
        if (mode !== 'add') {
            setFormData(prev => (
                prev.package_type_id
                    ? prev
                    : { ...prev, package_type_id: packageTypeId, package_type: packageLabel }
            ));
            return;
        }

        const isPending = pkg.status === 'pending';

        // 🔒 Guard: "Package" (amount 0) hanya boleh untuk sesi ke-2 dst pada
        // paket multi-sesi yang sudah pernah dipakai minimal 1x. Sesi pertama
        // (sessions_used === 0 / paket masih pending) WAJIB diisi manual oleh
        // staff dengan metode pembayaran asli, jangan di-auto-fill 'Package'.
        const isMultiSession = (pkg.total_sessions || 0) > 1;
        const hasStartedUsage = (pkg.sessions_used || 0) > 0;
        const shouldAutoFillPackage = !isPending && isMultiSession && hasStartedUsage;

        setFormData(prev => ({
            ...prev,
            package_type_id: packageTypeId,   // ✅ INI YANG PENTING
            package_type: packageLabel,
            amount: shouldAutoFillPackage ? 0 : prev.amount,
            payment_method: shouldAutoFillPackage ? 'Package' : prev.payment_method
        }));

    }, [selectedPackage, mode]);

    const handlePatientChange = (selectedId) => {
        // RESET SEMUA DATA TERKAIT PAKET DULU
        setSelectedPackage(null);
        setIsPackageExpired(false);

        setFormData(prev => ({
            ...prev,
            patient_id: selectedId || '',
            patient_name: '',
            package_type_id: '',
            package_type: '',
            amount: '',
            payment_method: ''
        }));

        if (!selectedId) return; // Kalau pasien dihapus, stop di sini

        const selectedOption = patientOptions.find(p => p.value === selectedId);

        setFormData(prev => ({
            ...prev,
            patient_name: selectedOption ? selectedOption.label : ''
        }));

        if (errors.patient_id) {
            setErrors(prev => ({ ...prev, patient_id: null }));
        }

        // Cek paket lagi
        checkPatientPackage(selectedId, true);
    };

    const handleExtendPackage = async (newEndDate) => {
        if (!selectedPackage) return;
        if (sfActive) {
            // Perpanjangan masa aktif paket wajib disetujui owner.
            setShowExtendModal(false);
            setOverrideDialog({
                kind: 'package_extend',
                packageId: selectedPackage.id,
                payload: { new_end_date: String(newEndDate).slice(0, 10) },
                description: `Perpanjang masa aktif paket sampai ${String(newEndDate).slice(0, 10)}. Berlaku setelah disetujui owner.`,
            });
            return;
        }
        setExtendLoading(true);
        try {
            // extendPackage(id, days) mengharapkan JUMLAH HARI, bukan tanggal ISO -
            // konversi dulu selisih hari dari hari ini ke tanggal target yang dipilih.
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const selected = new Date(newEndDate);
            selected.setHours(0, 0, 0, 0);
            const diffDays = Math.ceil((selected - today) / (1000 * 60 * 60 * 24));

            const { error } = await extendPackage(selectedPackage.id, diffDays);
            if (error) throw error;
            
            toast({ title: "Berhasil", description: "Paket berhasil diperpanjang" });
            setShowExtendModal(false);
            
            // Refresh package info
            await checkPatientPackage(formData.patient_id, true);
        } catch (error) {
            console.error(error);
            toast({ variant: "destructive", title: "Gagal", description: error.message || "Gagal memperpanjang paket" });
        } finally {
            setExtendLoading(false);
        }
    };

    const handleServiceChange = (selectedValue) => {
        setFormData(prev => ({
            ...prev,
            service_type: selectedValue,
        }));
    };

    const handleDateSelect = (isoDate) => {
        handleChange('recap_date', formatDateDisplay(isoDate));
        setShowDatePicker(false);
    };

    const isUUID = (str) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

    const handleSplitRowChange = (index, field, value) => {
        setPaymentSplits(prev => prev.map((row, i) => i === index ? { ...row, [field]: value } : row));
    };

    const addSplitRow = () => {
        setPaymentSplits(prev => [...prev, { payment_method: '', amount: '' }]);
    };

    const removeSplitRow = (index) => {
        setPaymentSplits(prev => prev.length <= 1 ? prev : prev.filter((_, i) => i !== index));
    };

    // SOAP-first: nominal berasal dari server (daftar harga), dikurangi diskon bila ada.
    const sfIsPayment = !!formData.payment_method && formData.payment_method !== 'Package';
    const sfBaseAmount = quote?.active && quote.total != null ? Number(quote.total) : null;
    const sfFinalAmount = (() => {
        if (!sfEdit) return null;
        if (quote?.invoice_locked) return Number(initialData?.amount ?? formData.amount ?? 0);
        if (formData.special_type === 'free') return 0;
        if (sfBaseAmount == null) return null;
        let dType = formData.discount_type;
        let dv = parseFloat(formData.discount_value) || 0;
        if (sfManualDiscount) {
            if (manualOverride?.status === 'approved') {
                dType = manualOverride.payload?.discount_type;
                dv = Number(manualOverride.payload?.discount_value) || 0;
            } else {
                dType = 'none';
                dv = 0;
            }
        }
        if (dType === 'percentage' && dv > 0) return Math.max(Math.round((sfBaseAmount - sfBaseAmount * Math.min(dv, 100) / 100) / 1000) * 1000, 0);
        if (dType === 'nominal' && dv > 0) return Math.max(Math.round(sfBaseAmount - Math.min(dv, sfBaseAmount)), 0);
        return sfBaseAmount;
    })();
    const effectiveAmount = sfFinalAmount != null ? sfFinalAmount : (parseFloat(formData.amount) || 0);
    const sfBlocked = sfEdit && sfIsPayment && !!quote?.error && !quote?.invoice_locked;

    const splitTotal = paymentSplits.reduce((sum, row) => sum + (parseFloat(row.amount) || 0), 0);
    const splitRemaining = effectiveAmount - splitTotal;

    const handleSubmit = async () => {
        const newErrors = {};

        if (!formData.patient_id && !formData.guest_name) {
            newErrors.patient_id = "Pasien wajib diisi";
        }
        if (!formData.recap_date) {
            newErrors.recap_date = "Tanggal wajib diisi";
        }
        if (!formData.therapist_id) {
            newErrors.therapist_id = "Terapis wajib diisi";
        }
        if (!formData.package_type_id) {
            newErrors.package_type = "Jenis paket wajib diisi";
        }
        if (sfActive && mode === 'add') {
            toast({ variant: "destructive", title: "Recap manual dinonaktifkan", description: "Di klinik ini recap dibuat otomatis dari appointment. Buat appointment terlebih dahulu." });
            return;
        }
        if (sfEdit && formData.special_type === 'free' && (formData.free_reason || '').trim().length < 3) {
            newErrors.free_reason = "Alasan pasien Free wajib diisi";
        }
        if (sfManualDiscount && sfIsPayment && !quote?.invoice_locked && manualOverride?.status !== 'approved') {
            toast({ variant: "destructive", title: "Diskon belum disetujui", description: `Diskon "${formData.discount_label}" diinput manual dan wajib disetujui owner. Ajukan persetujuan lebih dulu.` });
            return;
        }
        if (sfEdit && sfIsPayment && quote?.error && !quote?.invoice_locked) {
            toast({ variant: "destructive", title: "Pembayaran belum bisa disimpan", description: quote.error });
            return;
        }

        // Ada nominal tapi metode kosong = pembayaran tidak tercatat (termasuk Recovery di luar paket).
        if (!useSplitPayment && formData.special_type !== 'free' && !formData.payment_method && parseFloat(formData.amount) > 0) {
            newErrors.payment_method = "Metode pembayaran wajib dipilih karena nominal sudah terisi";
        }

        if (useSplitPayment) {
            const incompleteRow = paymentSplits.some(row => !row.payment_method || !(parseFloat(row.amount) > 0));
            if (incompleteRow) {
                newErrors.payment_splits = "Lengkapi metode & nominal setiap baris split pembayaran";
            } else if (Math.abs(splitRemaining) > 1) {
                newErrors.payment_splits = `Total split pembayaran (Rp ${splitTotal.toLocaleString('id-ID')}) belum sama dengan nominal (Rp ${effectiveAmount.toLocaleString('id-ID')})`;
            }
        }

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            toast({ variant: "destructive", title: "Validasi Gagal", description: "Mohon lengkapi field yang wajib diisi." });
            return;
        }

        setIsSubmitting(true);
        setSubmitError('');
        try {
            const isoDate = parseDateFromDisplay(formData.recap_date);
            const selectedTherapist = therapists.find(t => t.value === formData.therapist_id);
            const therapistName = selectedTherapist ? selectedTherapist.label : '';

            // Resolve patient_type: jika UUID → cari label-nya, jika sudah label → pakai langsung
            const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(formData.patient_type || '');
            const resolvedPatientType = isUUID
                ? (patientTypeOptions.find(o => o.value === formData.patient_type)?.label || formData.patient_type)
                : formData.patient_type;

            // Resolve payment_method: jika UUID → cari label-nya, jika sudah label → pakai langsung
            const resolvePaymentMethodLabel = (value) => {
                const isUuidValue = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value || '');
                return isUuidValue
                    ? (paymentMethodOptions.find(o => o.value === value)?.label || value)
                    : value;
            };

            let resolvedPaymentMethod = resolvePaymentMethodLabel(formData.payment_method);
            let resolvedPaymentSplits = [];

            if (useSplitPayment) {
                resolvedPaymentSplits = paymentSplits.map(row => ({
                    payment_method: resolvePaymentMethodLabel(row.payment_method),
                    amount: parseFloat(row.amount) || 0
                }));
                // Ringkasan payment_method di daily_recaps dipakai oleh trigger fee
                // bank, rekonsiliasi, dsb yang mengasumsikan 1 metode - pakai metode
                // dgn nominal terbesar sebagai representasinya.
                const largestSplit = [...resolvedPaymentSplits].sort((a, b) => b.amount - a.amount)[0];
                resolvedPaymentMethod = largestSplit?.payment_method || resolvedPaymentMethod;
            }

            const payload = {
                ...formData,
                recap_date: isoDate,
                therapist_name: therapistName,
                patient_type: resolvedPatientType,
                // Kosong harus NULL, bukan '': trigger SOAP-first menganggap payment_method
                // non-NULL (selain 'Package') sebagai pembayaran dan menolak simpan
                // ("SOAP belum diisi... Pembayaran terkunci") padahal admin belum bayar.
                payment_method: resolvedPaymentMethod || null,
                payment_splits: resolvedPaymentSplits,
                diagnosis: Array.isArray(formData.diagnosis) && formData.diagnosis.length > 0
  ? formData.diagnosis.map(d => {
      if (typeof d === 'string') return d; // kalau sudah UUID
      if (typeof d === 'object' && d.value) return d.value; // ambil value
      return null;
    }).filter(Boolean)
  : undefined,
                amount: parseFloat(formData.amount) || 0,
                // Tanpa tipe potongan = tanpa diskon: nilai & label ikut dikosongkan
                // supaya diskon lama benar-benar terhapus di DB dan invoice.
                discount_value: formData.discount_type === 'none' ? 0 : (parseFloat(formData.discount_value) || 0),
                discount_type: formData.discount_type === 'none' ? null : formData.discount_type,
                discount_label: formData.discount_type === 'none' ? null : (formData.discount_label || null),
                referral_reward_id: formData.referral_reward_id || null,
                package_type_id: formData.package_type_id || null,
                package_type: formData.package_type || null,
                // Kosong harus NULL: constraint daily_recaps_special_type_check hanya
                // menerima NULL / 'free' / 'konsultasi', bukan ''.
                special_type: formData.special_type || null,
                free_reason: formData.special_type === 'free' ? ((formData.free_reason || '').trim() || null) : null,
                // FIX: saat edit, pertahankan package_tracking_id ASLI recap ini
                // (initialData) - jangan pakai selectedPackage, karena itu adalah
                // paket AKTIF pasien SAAT INI dan bisa berbeda dari paket yang
                // sebenarnya dipakai waktu recap ini dibuat. Kalau di-mismatch,
                // hitungan sesi paket lama & baru jadi rusak.
                package_tracking_id: mode === 'edit'
                    ? (initialData?.package_tracking_id ?? null)
                    : (selectedPackage?.id ?? null)
            };
            if (sfEdit) {
                // Server yang menentukan diagnosa, tipe pasien, nominal & nilai diskon.
                delete payload.diagnosis;
                delete payload.patient_type;
                delete payload.amount;
                delete payload.discount_type;
                delete payload.discount_value;
                payload.special_type = formData.special_type || null;
                payload.free_reason = formData.special_type === 'free' ? ((formData.free_reason || '').trim() || null) : null;
            }
            // Diskon recap tidak dipakai di kwitansi (diskon per item); invoice_items
            // disimpan terpisah setelah recap tersimpan.
            if (isKwitansi) {
                if (invoiceItems.length > 0 && !isPackageSessionLocked) {
                    payload.amount = Math.round(itemsNetTotal(invoiceItems));
                }
                payload.discount_type = null;
                payload.discount_value = 0;
                payload.discount_label = null;
                payload.referral_reward_id = null;
            }
            // Sesi paket (metode 'Package') selalu Rp 0. Tanpa ini, nominal basi di form
            // (mis. harga paket dari quote) / amount_original lama bisa ikut tersimpan dan
            // melanggar chk_package_payment_zero_amount. Harus setelah blok kwitansi,
            // yang menimpa amount dari total item invoice (harga paket).
            if (payload.payment_method === 'Package') {
                payload.amount = 0;
                payload.amount_original = 0;
                payload.discount_type = null;
                payload.discount_value = 0;
                payload.discount_label = null;
                payload.referral_reward_id = null;
            }

            let result;
            if (mode === 'add') {
                result = await createDailyRecap(payload);
            } else {
                result = await updateDailyRecap(initialData.id, payload);
            }

            if (result.error) throw result.error;

            if (isKwitansi) {
                const recapId = mode === 'add' ? result.data?.recap_id : initialData.id;
                if (recapId) {
                    const { error: itemsError } = await supabase
                        .from('daily_recaps')
                        .update({ invoice_items: invoiceItems.length > 0 ? invoiceItems : null })
                        .eq('id', recapId);
                    if (itemsError) throw itemsError;
                }
            }
            toast({ title: "Berhasil", description: `Data berhasil ${mode === 'add' ? 'disimpan' : 'diperbarui'}.` });
            if (sfEdit) { loadRecapMeta(); refreshQuote(); }
            // id recap yang tersimpan dikirim ke pemanggil (mis. untuk membuka konfirmasi tagihan/invoice).
            const savedRecapId = mode === 'add' ? (result.data?.recap_id ?? null) : (initialData?.id ?? null);
            if (onSuccess) onSuccess({ recapId: savedRecapId, mode });
            onClose();
        } catch (error) {
            setSubmitError(error.message || "Gagal menyimpan data.");
            toast({ variant: "destructive", title: "Error", description: error.message || "Gagal menyimpan data." });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const fDate = (
        <>
                                <div className="space-y-1 relative">
                                    <Label>Tanggal Sesi <span className="text-red-500">*</span></Label>
                                    <div className="flex gap-2">
                                        <Input value={formData.recap_date || ''} onChange={(e) => handleChange('recap_date', e.target.value)} disabled={sfDateLocked} />
                                        <Button variant="outline" size="icon" disabled={sfDateLocked} onClick={() => setShowDatePicker(p => !p)}><CalendarIcon className="w-4 h-4" /></Button>
                                    </div>
                                    {sfDateLocked && <p className="text-xs text-slate-500">Tanggal sesi mengikuti appointment dan tidak dapat diubah di sini. Ubah jadwal lewat appointment.</p>}
                                    {errors.recap_date && <p className="text-xs text-red-500">{errors.recap_date}</p>}
                                    {showDatePicker && <div className="absolute z-50 mt-1"><DatePicker value={parseDateFromDisplay(formData.recap_date)} onChange={handleDateSelect} onClose={() => setShowDatePicker(false)} /></div>}
                                </div>
        </>
    );

    const fOwner = (
        <>
                                <div className="space-y-1">
                                    <Label>Pemilik Paket / Akun <span className="text-red-500">*</span></Label>
                                    <SearchableSelect 
                                        options={patientOptions} 
                                        value={formData.patient_id} 
                                        onChange={handlePatientChange} 
                                        onSearch={setPatientSearch}
                                        placeholder="Cari Pasien..." 
                                        isLoading={loadingPatients}
                                    />
                                    {errors.patient_id && <p className="text-xs text-red-500">{errors.patient_id}</p>}
                                </div>
        </>
    );

    const fGuestPkg = (
        <>
                                {formData.guest_name?.trim() && !formData.patient_id && (
                                    <div className="bg-amber-50 border border-amber-200 rounded-app-sm p-3">
                                        <p className="text-sm font-semibold text-amber-800">
                                            Pasien Baru: {formData.guest_name}
                                        </p>
                                        <p className="text-xs text-amber-700 mt-1">
                                            Pilih pasien database di atas untuk menghubungkan data pasien.
                                        </p>
                                    </div>
                                )}
                                
                                {/* Package Info Card */}
                                {selectedPackage && (
                                    <PackageInfoCard 
                                        packageData={selectedPackage} 
                                        isExpired={isPackageExpired} 
                                        onExtend={() => setShowExtendModal(true)} 
                                    />
                                )}

        </>
    );

    const fActual = (
        <>
                                {/* Actual Patient - Unconditionally rendered, always enabled */}
                                <div className="space-y-1">
                                    <Label>Pasien Aktual</Label>
                                    <SearchableSelect 
                                        options={patientOptions} 
                                        value={formData.actual_patient_id} 
                                        onChange={(v) => handleChange('actual_patient_id', v)} 
                                        onSearch={setPatientSearch}
                                        placeholder="Kosongkan jika sama" 
                                        isLoading={loadingPatients} 
                                    />
                                </div>
        </>
    );

    const fDiagnosisEditable = (
        <>
                                {/* 🔥 DIAGNOSA DULU */}
                                <div className="space-y-1">
                                  <Label>Diagnosa</Label>
                                  <SearchableSelect 
                                    options={diagnosisOptions} 
                                    value={formData.diagnosis} 
                                    onChange={v => handleChange('diagnosis', v)} 
                                    rankOptions={rankDiagnosisOptions}
                                    placeholder="Cari atau tambah diagnosa..." 
                                    isLoading={loadingDiagnoses} 
                                    multiple={true} 
                                    allowCreate={true}
                                    onCreateOption={handleCreateDiagnosis}
                                  />
                                </div>
        </>
    );

    const fDiagnosis = sfActive ? (
        <div className="space-y-1">
            <Label>Diagnosa (diisi terapis di SOAP)</Label>
            <div className="flex flex-wrap gap-1.5 rounded-app-sm border bg-slate-50 p-2 min-h-[2.5rem]">
                {(formData.diagnosis || []).length === 0 && <span className="text-xs text-slate-500">Belum diisi terapis</span>}
                {(formData.diagnosis || []).map((id) => (
                    <span key={id} className="rounded-full bg-white border px-2 py-0.5 text-xs text-slate-700">
                        {diagnosisOptions.find(d => d.value === id)?.label || 'Memuat...'}
                    </span>
                ))}
            </div>
        </div>
    ) : fDiagnosisEditable;

    const fServiceEditable = (
        <>
                                {/* 🔥 LAYANAN KEDUA */}
                                <div className="space-y-1">
                                  <Label>Tipe Layanan</Label>
                                  <SearchableSelect 
                                    options={serviceOptions} 
                                    value={formData.service_type} 
                                    onChange={handleServiceChange} 
                                    onSearch={setServiceSearch} 
                                    placeholder="Cari tipe layanan..." 
                                    isLoading={loadingServices} 
                                  />
                                </div>
        </>
    );

    // SOAP-first: tipe layanan terisi otomatis dari diagnosa (induk diagnosa) sehingga dikunci.
    const fService = sfActive ? (
        <div className="space-y-1">
            <Label>Tipe Layanan (otomatis dari diagnosa)</Label>
            <div className="rounded-app-sm border bg-slate-50 px-3 py-2 text-sm font-medium text-slate-800">
                {serviceOptions.find(o => o.value === formData.service_type)?.label || formData.service_type || 'Terisi otomatis setelah terapis memilih diagnosa'}
            </div>
        </div>
    ) : fServiceEditable;

    const fPatientTypeEditable = (
        <>
                                <div className="space-y-1">
                                    <Label>Tipe Pasien</Label>
                                    <SearchableSelect options={patientTypeOptions} value={formData.patient_type} onChange={v => handleChange('patient_type', v)} onSearch={setPatientTypeSearch} placeholder="Cari tipe pasien..." isLoading={loadingPatientTypes} />
                                </div>
        </>
    );

    const fPatientType = sfActive ? (
        <div className="space-y-1">
            <Label>Tipe Pasien (otomatis dari SOAP)</Label>
            <div className="rounded-app-sm border bg-slate-50 px-3 py-2 text-sm font-medium text-slate-800">
                {quote?.type_label || (['registered', 'guest'].includes(String(formData.patient_type || '').toLowerCase()) ? '' : formData.patient_type) || (quote?.homecare ? 'Homecare (pilih waktu homecare)' : 'Menunggu SOAP')}
            </div>
        </div>
    ) : fPatientTypeEditable;

    const fPackageType = (
        <>
                                <div className="space-y-1">
                                    <Label>Jenis Paket <span className="text-red-500">*</span></Label>
                                    <SearchableSelect
                                        key={(formData.package_type_id || '') + packageOptions.length}
                                        options={packageOptions}
                                        value={formData.package_type_id || ''}
                                        onChange={(id) => {
                                            const selected = packageOptions.find(p => p.value === id);
                                            setFormData(prev => ({
                                                ...prev,
                                                package_type_id: id,
                                                package_type: selected?.label || ''
                                            }));
                                        }}
                                        onSearch={setPackageSearch}
                                        placeholder="Cari jenis paket..."
                                        isLoading={loadingPackages}
                                    />
                                    {errors.package_type && <p className="text-xs text-red-500">{errors.package_type}</p>}
                                    {(!packageOptions.length && formData.package_type) && (
                                        <p className="text-xs text-slate-500 mt-1">Saat ini: {formData.package_type}</p>
                                    )}
                                </div>
        </>
    );

    const fTherapist = (
        <>
                                <div className="space-y-1">
                                    <Label>Fisioterapis{mode === 'edit' ? '' : <span className="text-red-500"> *</span>}</Label>
                                    {mode === 'edit' ? (
                                        <>
                                            <div className="flex h-10 items-center rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700">
                                                {therapists.find(t => t.value === formData.therapist_id)?.label || initialData?.therapist_name || '-'}
                                            </div>
                                            <p className="text-[11px] text-slate-500">Ubah fisioterapis lewat appointment.</p>
                                        </>
                                    ) : (
                                        <>
                                            <SearchableSelect options={therapists} value={formData.therapist_id} onChange={v => handleChange('therapist_id', v)} placeholder="Pilih Terapis..." isLoading={isLoadingCoreData} />
                                            {errors.therapist_id && <p className="text-xs text-red-500">{errors.therapist_id}</p>}
                                        </>
                                    )}
                                </div>
        </>
    );

    const fPayment = (
        <>
                                <div className="grid grid-cols-2 items-end gap-3 sm:gap-4">
                                    <div className="space-y-1 min-w-0">
                                        <Label className="block whitespace-nowrap">Nominal (Rp)</Label>
                                        <Input type="number" value={sfEdit && sfFinalAmount != null ? sfFinalAmount : (formData.amount ?? '')} onChange={e => handleChange('amount', e.target.value)} placeholder="0" disabled={sfActive || isPackageSessionLocked || (isKwitansi && invoiceItems.length > 0)}/>
                                        {sfEdit && sfFinalAmount == null && quote?.error && <p className="text-[11px] text-red-600">{quote.error}</p>}
                                    </div>
                                    <div className="space-y-1 min-w-0">
                                        <Label className="block whitespace-nowrap">Metode Pembayaran{parseFloat(formData.amount) > 0 && !useSplitPayment && formData.special_type !== 'free' && <span className="text-red-500"> *</span>}</Label>
                                        <SearchableSelect options={paymentMethodOptions} value={formData.payment_method} onChange={v => handleChange('payment_method', v)} onSearch={setPaymentMethodSearch} placeholder="Cari metode..." isLoading={loadingPaymentMethods} disabled={isPackageSessionLocked || useSplitPayment} />
                                        {errors.payment_method && <p className="text-xs text-red-500">{errors.payment_method}</p>}
                                    </div>
                                </div>
                                {isPackageSessionLocked && (
                                    <p className="text-xs text-slate-500 -mt-1">
                                        Sesi ini memakai kuota paket (Rp 0) sehingga nominal &amp; metode pembayaran dikunci. Kalau ini bukan sesi paket, hubungi admin sistem.
                                    </p>
                                )}
                                {!isPackageSessionLocked && (
                                    <div className="flex items-center gap-2">
                                        <Checkbox
                                            id="use-split-payment"
                                            checked={useSplitPayment}
                                            onCheckedChange={(checked) => setUseSplitPayment(!!checked)}
                                        />
                                        <Label htmlFor="use-split-payment" className="text-xs font-normal cursor-pointer">
                                            Bayar dengan lebih dari 1 metode (split pembayaran)
                                        </Label>
                                    </div>
                                )}
                                {useSplitPayment && (
                                    <div className="space-y-2 bg-slate-50 p-3 rounded-app-sm border">
                                        {paymentSplits.map((row, index) => (
                                            <div key={index} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-start">
                                                <SearchableSelect
                                                    options={paymentMethodOptions}
                                                    value={row.payment_method}
                                                    onChange={v => handleSplitRowChange(index, 'payment_method', v)}
                                                    onSearch={setPaymentMethodSearch}
                                                    placeholder="Metode..."
                                                    isLoading={loadingPaymentMethods}
                                                />
                                                <Input
                                                    type="number"
                                                    value={row.amount}
                                                    onChange={e => handleSplitRowChange(index, 'amount', e.target.value)}
                                                    placeholder="Nominal"
                                                />
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => removeSplitRow(index)}
                                                    disabled={paymentSplits.length <= 1}
                                                >
                                                    <Trash2 className="h-4 w-4 text-red-500" />
                                                </Button>
                                            </div>
                                        ))}
                                        <Button type="button" variant="outline" size="sm" onClick={addSplitRow}>
                                            <Plus className="h-4 w-4 mr-1" /> Tambah Metode
                                        </Button>
                                        <p className={`text-xs ${Math.abs(splitRemaining) > 1 ? 'text-red-500' : 'text-green-600'}`}>
                                            Total split: Rp {splitTotal.toLocaleString('id-ID')} {' '}
                                            {Math.abs(splitRemaining) > 1
                                                ? `(sisa Rp ${splitRemaining.toLocaleString('id-ID')} dari nominal)`
                                                : '(sudah sesuai nominal)'}
                                        </p>
                                        {errors.payment_splits && <p className="text-xs text-red-500">{errors.payment_splits}</p>}
                                    </div>
                                )}
        </>
    );

    const fDiscount = (
        <>
                                <div className="space-y-3 bg-slate-50 p-3 rounded-app-sm border">
                                    <Label className="font-semibold">Diskon (Opsional)</Label>
                                    {/* Kode Reward Referral */}
                                    <div className="space-y-1">
                                        <Label className="text-xs">Kode Reward Referral</Label>
                                        {formData.referral_reward_id && rewardInfo ? (
                                            <div className="flex items-center justify-between gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                                                <span>
                                                    <span className="font-semibold">{rewardInfo.code}</span>
                                                    {' · '}{rewardInfo.discount_label || 'Referral Reward'}{' '}
                                                    ({rewardInfo.discount_value_type === 'percentage'
                                                        ? `${Number(rewardInfo.discount_value)}%`
                                                        : `Rp ${Number(rewardInfo.discount_value).toLocaleString('id-ID')}`})
                                                </span>
                                                <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs text-red-600" onClick={clearReferralReward}>Lepas</Button>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="flex gap-2">
                                                    <Input
                                                        value={rewardCode}
                                                        onChange={e => { setRewardCode(e.target.value.toUpperCase()); setRewardError(''); }}
                                                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); applyReferralReward(); } }}
                                                        placeholder="Contoh: REF-7QX4M"
                                                        className="h-9 text-xs bg-white"
                                                    />
                                                    <Button type="button" size="sm" className="h-9" onClick={applyReferralReward} disabled={rewardChecking || !rewardCode.trim()}>
                                                        {rewardChecking ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Terapkan'}
                                                    </Button>
                                                </div>
                                                {rewardError && <p className="text-xs text-red-500">{rewardError}</p>}
                                                {activeRewards.length > 0 && (
                                                    <p className="text-xs text-emerald-700">
                                                        Pasien punya reward aktif:{' '}
                                                        {activeRewards.map(r => (
                                                            <button key={r.id} type="button" className="mr-2 font-semibold underline" onClick={() => setRewardCode(r.code)}>{r.code}</button>
                                                        ))}
                                                    </p>
                                                )}
                                            </>
                                        )}
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs">Jenis Diskon</Label>
                                        <SearchableSelect disabled={!!formData.referral_reward_id} options={discountTypeOptions.filter(o => !o.is_referral_reward)} value={formData.discount_label} onChange={v => {
                                            // Dihapus (tombol X): reset seluruh diskon
                                            if (!v) {
                                                setFormData(prev => ({ ...prev, discount_label: '', discount_type: 'none', discount_value: 0 }));
                                                return;
                                            }
                                            const selected = discountTypeOptions.find(d => d.value === v);
                                            // `v` is either an existing option's id (uuid) or, when created via
                                            // "Buat ..." (allowCreate), the freshly typed label text. If it looks
                                            // like a uuid but isn't found in the current options (e.g. a stale
                                            // list during search), don't store the raw id as the label — keep
                                            // whatever label was already selected instead of corrupting it.
                                            const looksLikeUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v || '');
                                            setFormData(prev => ({
                                                ...prev,
                                                discount_label: selected?.label || (looksLikeUuid ? prev.discount_label : v),
                                                discount_type: selected?.discount_value_type || prev.discount_type,
                                                discount_value: selected?.discount_value != null ? String(selected.discount_value) : prev.discount_value
                                            }));
                                        }} onSearch={setDiscountTypeSearch} placeholder="Cari jenis diskon..." isLoading={loadingDiscountTypes} allowCreate={!sfActive}/>
                                    </div>
                                    {sfManualDiscount && (
                                        <div className="space-y-2 rounded-app-sm border border-amber-200 bg-amber-50 p-3">
                                            <p className="text-xs text-amber-800">Diskon “{formData.discount_label}” diisi manual dan baru berlaku setelah disetujui owner.</p>
                                            {manualOverride?.status === 'approved' ? (
                                                <p className="text-xs font-semibold text-emerald-700">
                                                    Disetujui: {manualOverride.payload?.discount_type === 'percentage' ? `${manualOverride.payload?.discount_value}%` : `Rp ${Number(manualOverride.payload?.discount_value || 0).toLocaleString('id-ID')}`}
                                                </p>
                                            ) : manualOverride?.status === 'pending' ? (
                                                <p className="text-xs font-semibold text-amber-700">Menunggu persetujuan owner.</p>
                                            ) : (
                                                <>
                                                    {manualOverride?.status === 'rejected' && <p className="text-xs font-semibold text-red-600">Pengajuan sebelumnya ditolak{manualOverride.decision_note ? `: ${manualOverride.decision_note}` : ''}.</p>}
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <Select value={manualInput.type} onValueChange={(v) => setManualInput(prev => ({ ...prev, type: v }))}>
                                                            <SelectTrigger className="h-9 text-xs bg-white"><SelectValue/></SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="percentage">Persentase (%)</SelectItem>
                                                                <SelectItem value="nominal">Nominal (Rp)</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                        <Input type="number" className="h-9 text-xs bg-white" value={manualInput.value} onChange={e => setManualInput(prev => ({ ...prev, value: e.target.value }))} placeholder={manualInput.type === 'percentage' ? 'Contoh: 10' : 'Contoh: 50000'} />
                                                    </div>
                                                    <Button type="button" size="sm" className="h-8 text-xs" disabled={!(Number(manualInput.value) > 0)}
                                                        onClick={() => openOverride({ kind: 'manual_discount', payload: { discount_type: manualInput.type, discount_value: Number(manualInput.value), discount_label: formData.discount_label }, description: `Ajukan diskon "${formData.discount_label}" sebesar ${manualInput.type === 'percentage' ? `${manualInput.value}%` : `Rp ${Number(manualInput.value).toLocaleString('id-ID')}`}. Berlaku setelah disetujui owner.` })}>
                                                        Ajukan persetujuan owner
                                                    </Button>
                                                </>
                                            )}
                                        </div>
                                    )}
                                    <div className={`${sfManualDiscount ? 'hidden' : ''} grid grid-cols-2 gap-4`}>
                                        <div className="space-y-1">
                                            <Label className="text-xs">Tipe Potongan</Label>
                                            <Select disabled={!!formData.referral_reward_id || sfActive} value={formData.discount_type} onValueChange={v => {
                                                if (v === 'none') setFormData(prev => ({ ...prev, discount_type: 'none', discount_value: 0, discount_label: '' }));
                                                else handleChange('discount_type', v);
                                            }}>
                                                <SelectTrigger className="h-9 text-xs bg-white"><SelectValue/></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="none">Tidak ada</SelectItem>
                                                    <SelectItem value="nominal">Nominal (Rp)</SelectItem>
                                                    <SelectItem value="percentage">Persentase (%)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs">Nilai</Label>
                                            <Input type="number" value={formData.discount_value || ''} onChange={e => handleChange('discount_value', e.target.value)} disabled={!!formData.referral_reward_id || sfActive || formData.discount_type === 'none' || !formData.discount_label}/>
                                        </div>
                                    </div>
                                </div>
        </>
    );

    // ── Panel SOAP-first ──
    const sfSoapDone = !!(quote?.soap_done ?? recapMeta?.soap_completed_at);
    const sfInvoiceLocked = !!quote?.invoice_locked;
    const sfTherapistName = therapists.find(t => t.value === formData.therapist_id)?.label || 'terapis';
    const sfNeedHomecareTime = !!quote?.error && quote.error.includes('Pilih homecare');

    const [homecareTimeLocal, setHomecareTimeLocal] = useState('');
    useEffect(() => {
        const apptId = recapMeta?.appointment_id;
        if (!apptId || !quote?.homecare) return;
        supabase.from('appointments').select('homecare_time_type').eq('id', apptId).maybeSingle()
            .then(({ data }) => setHomecareTimeLocal(data?.homecare_time_type || ''));
    }, [recapMeta?.appointment_id, quote?.homecare]);
    const setHomecareTime = async (value) => {
        const apptId = recapMeta?.appointment_id;
        if (!apptId || !initialData?.id) return;
        const { data: saved, error } = await supabase.from('appointments').update({ homecare_time_type: value }).eq('id', apptId).select('id');
        if (error || !saved?.length) {
            toast({ variant: "destructive", title: "Gagal menyimpan", description: error?.message || 'Waktu homecare tidak tersimpan. Coba lagi.' });
            return;
        }
        setHomecareTimeLocal(value);
        await supabase.from('daily_recaps').update({ updated_at: new Date().toISOString() }).eq('id', initialData.id);
        refreshQuote();
    };

    const openOverride = (cfg) => setOverrideDialog({ recapId: initialData?.id, ...cfg });

    const fSoapPanel = sfEdit ? (
        <div className="mx-6 mt-6 space-y-3">
            {quote?.error && !sfInvoiceLocked && sfIsPayment && (
                <div className="rounded-app-sm border border-red-200 bg-red-50 p-3 text-xs text-red-700">{quote.error}</div>
            )}
            {quote?.error && !sfInvoiceLocked && !sfIsPayment && !sfSoapDone && quote?.needs_soap && (
                <div className="rounded-app-sm border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                    Pembayaran baru bisa disimpan setelah SOAP selesai. Minta {sfTherapistName} mengisi SOAP lebih dulu{ttvRequiredFor(sfSettings, recapMeta) ? ', dan pastikan TTV (tanda vital) sudah diisi karena TTV bagian dari SOAP' : ''}.
                </div>
            )}

            {sfNeedHomecareTime && !sfInvoiceLocked && (
                <div className="space-y-1 max-w-xs">
                    <Label className="text-xs">Waktu homecare{sfNeedHomecareTime && <span className="text-red-500"> * wajib dipilih agar nominal terhitung</span>}</Label>
                    <Select value={homecareTimeLocal} onValueChange={setHomecareTime}>
                        <SelectTrigger className="h-9 text-xs bg-white"><SelectValue placeholder="Dalam atau luar jam kerja" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="dalam">Dalam jam kerja</SelectItem>
                            <SelectItem value="luar">Luar jam kerja</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                    <Label className="text-xs">Jenis khusus</Label>
                    <Select value={formData.special_type || 'none'} disabled={sfInvoiceLocked} onValueChange={(v) => handleChange('special_type', v === 'none' ? '' : v)}>
                        <SelectTrigger className="h-9 text-xs bg-white"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="none">Biasa (otomatis dari SOAP)</SelectItem>
                            <SelectItem value="konsultasi">Konsultasi</SelectItem>
                            <SelectItem value="free">Free (nominal Rp 0)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                {formData.special_type === 'free' && (
                    <div className="space-y-1">
                        <Label className="text-xs">Alasan Free <span className="text-red-500">*</span></Label>
                        <Input className="h-9 text-xs bg-white" value={formData.free_reason || ''} disabled={sfInvoiceLocked} onChange={e => handleChange('free_reason', e.target.value)} placeholder="Wajib diisi, owner akan diberi tahu" />
                        {errors.free_reason && <p className="text-xs text-red-500">{errors.free_reason}</p>}
                    </div>
                )}
            </div>
        </div>
    ) : (sfActive && mode === 'add' ? (
        <div className="mx-6 mt-6 rounded-app border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            Di klinik ini recap dibuat otomatis dari appointment dan pembayaran hanya bisa disimpan setelah terapis menyelesaikan SOAP. Buat appointment terlebih dahulu, lalu buka recap-nya di sini.
        </div>
    ) : null);

    if(!isOpen) return null;

    return (
        <>
            <Dialog open={isOpen} onOpenChange={(open) => !isSubmitting && onClose()}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto rounded-app shadow-lg p-0">
                    <div className="px-6 py-6 border-b border-slate-100">
                        <DialogHeader>
                            <DialogTitle className="text-xl font-bold text-slate-900">{mode === 'add' ? 'Tambah Recap Harian' : 'Edit Recap Harian'}</DialogTitle>
                            <DialogDescription className="text-slate-500">Lengkapi data kunjungan pasien berikut.</DialogDescription>
                        </DialogHeader>
                    </div>
                    {fSoapPanel}
                    {isKwitansi ? (
                    <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Layout kwitansi: urutan mengikuti kwitansi - data pasien, diagnosa, item, pembayaran */}
                        <div className="space-y-6">
                            <div className="space-y-3">
                                <h3 className="text-sm font-bold text-slate-800 border-b pb-2">Data Pasien & Kunjungan</h3>
                                {fDate}
                                {fOwner}
                                {fGuestPkg}
                                {fActual}
                                {fTherapist}
                            </div>
                            <div className="space-y-3">
                                <h3 className="text-sm font-bold text-slate-800 border-b pb-2">Diagnosa & Kategori</h3>
                                {fDiagnosis}
                                {fPatientType}
                                {fPackageType}
                            </div>
                        </div>
                        <div className="space-y-6">
                            <div className="space-y-3">
                                <h3 className="text-sm font-bold text-slate-800 border-b pb-2">Item Invoice (Katalog Harga)</h3>
                                <RecapInvoiceItems clinicId={userDetails?.clinic_id} items={invoiceItems} onChange={setInvoiceItems} />
                            </div>
                            <div className="space-y-3">
                                <h3 className="text-sm font-bold text-slate-800 border-b pb-2">Pembayaran</h3>
                                {fPayment}
                            </div>
                        </div>
                    </div>
                    ) : (
                    <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* LEFT COLUMN */}
                        <div className="space-y-6">
                            <div className="space-y-3">
                                <h3 className="text-sm font-bold text-slate-800 border-b pb-2">Tanggal & Pasien</h3>
                                {fDate}
                                {fOwner}
                                {fGuestPkg}
                                {fActual}
                            </div>
                            <div className="space-y-3">
                                <h3 className="text-sm font-bold text-slate-800 border-b pb-2">Diagnosa & Layanan</h3>
                                {fDiagnosis}
                                {fService}
                            </div>
                        </div>
                        {/* RIGHT COLUMN */}
                        <div className="space-y-6">
                            <div className="space-y-3">
                                <h3 className="text-sm font-bold text-slate-800 border-b pb-2">Kategori & Terapis</h3>
                                {fPatientType}
                                {fPackageType}
                                {fTherapist}
                            </div>
                            <div className="space-y-3">
                                <h3 className="text-sm font-bold text-slate-800 border-b pb-2">Pembayaran</h3>
                                {fPayment}
                                {fDiscount}
                            </div>
                        </div>
                    </div>
                    )}

                    {submitError && (
                        <div role="alert" className="mx-6 mb-3 rounded-app-sm border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                            Gagal menyimpan: {submitError}
                        </div>
                    )}
                    <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50/50">
                        <Button variant="outline" onClick={onClose} disabled={isSubmitting}>Batal</Button>
                        <Button onClick={handleSubmit} disabled={isSubmitting || sfBlocked || (sfActive && mode === 'add')} className="bg-app-accent hover:bg-app-accent-hover text-white">
                            {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            {mode === 'add' ? 'Simpan' : 'Simpan Perubahan'}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            <SoapOverrideDialog
                open={!!overrideDialog}
                onOpenChange={(v) => { if (!v) setOverrideDialog(null); }}
                kind={overrideDialog?.kind}
                recapId={overrideDialog?.recapId ?? null}
                packageId={overrideDialog?.packageId ?? null}
                payload={overrideDialog?.payload || {}}
                description={overrideDialog?.description}
                withAmount={!!overrideDialog?.withAmount}
                withDiscount={!!overrideDialog?.withDiscount}
                discountOptions={discountTypeOptions.filter(o => !o.is_referral_reward)}
                onDone={() => { refreshQuote(); loadRecapMeta(); loadManualOverride(); }}
            />

            {/* Extend Package Modal */}
            <ExtendPackageModal 
                open={showExtendModal} 
                onOpenChange={setShowExtendModal} 
                onExtend={handleExtendPackage}
                isLoading={extendLoading}
            />
            
            {/* 🔥 SERVICE PICKER MODAL (LETakkan DI SINI) */}
            <Dialog open={showServicePicker} onOpenChange={setShowServicePicker}>
                <DialogContent>
                    <DialogHeader>
                    <DialogTitle>Pilih Layanan</DialogTitle>
                    <DialogDescription>
                        Pilih layanan untuk diagnosa:
                        <b> {pendingDiagnosisLabel}</b>
                    </DialogDescription>
                    </DialogHeader>

                    <SearchableSelect
                    options={serviceOptions}
                    value={selectedParentService}
                    onChange={setSelectedParentService}
                    placeholder="Pilih layanan..."
                    isLoading={loadingServices}
                    />

                    <div className="flex justify-end gap-2 mt-4">
                    <Button
                        variant="outline"
                        onClick={() => setShowServicePicker(false)}
                    >
                        Batal
                    </Button>

                    <Button onClick={handleConfirmCreateDiagnosis} disabled={!selectedParentService}>
                        Simpan
                    </Button>
                    </div>
                </DialogContent>
            </Dialog>

        </>
    );
};

export default DailyRecapModal;