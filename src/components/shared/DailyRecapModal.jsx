import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar as CalendarIcon, Loader2, Save } from 'lucide-react';
import SearchableSelect from '@/components/ui/searchable-select';
import DatePicker from '@/components/DatePicker';
import { useToast } from '@/components/ui/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import PackageInfoCard from './PackageInfoCard';
import ExtendPackageModal from './ExtendPackageModal';
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
    getPatientActivePackage,
    extendPackage
} from '@/lib/api';
import { createOperationalOption } from '@/lib/api';

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
    
    // 🔥 CREATE DIAGNOSA (FLOW BARU DENGAN POPUP SERVICE)
    const handleCreateDiagnosis = async (label) => {
      // simpan label sementara
      setPendingDiagnosisLabel(label);
      // buka popup pilih service
      setShowServicePicker(true);
      return false; // penting supaya input tidak reset
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
    const [showDatePicker, setShowDatePicker] = useState(false);

    // DEBUG: Log initial data
    useEffect(() => {
        if (isOpen) {
            console.log("DailyRecapModal Opened. Mode:", mode);
            console.log("DailyRecapModal initialData:", initialData);
        }
    }, [isOpen, initialData, mode]);

    const initializeForm = () => {
        try {
            setSelectedPackage(null);
            setIsPackageExpired(false);
            
            if (mode === 'edit' && initialData) {
                console.log("DailyRecapModal initializing form with edit data");
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
    discount_label: initialData.is_auto_filled?.discount_label || ''
});
                
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
                    discount_label: ''
                });
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
            setPatientOptions(Array.isArray(data) ? data : []);
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
            const patientTypeArr = Array.isArray(pTypes?.data || pTypes) ? (pTypes?.data || pTypes) : [];
setPatientTypeOptions(patientTypeArr);

// 🔥 FIX: inject patient_type existing sebagai option jika berupa label (bukan UUID)
if (mode === 'edit' && initialData?.patient_type) {
    const existingType = initialData.patient_type;
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(existingType);
    if (!isUUID) {
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
                
                console.log("DailyRecapModal Checking Package Injection:", { pkgLabel, pkgId });

                if (pkgLabel || pkgId) {
                    setPackageOptions(prev => {
                        if (pkgId && prev.some(opt => opt.value === pkgId)) return prev;
                        if (prev.some(opt => opt.label === pkgLabel)) return prev;
                
                        const injectId = pkgId || pkgLabel;
                        const injectLabel = pkgLabel || 'Package';
                        console.log(`Injecting missing package option: { value: ${injectId}, label: ${injectLabel} }`);

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
            
                // ✅ FIELD YANG KOSONG KEMARIN
                inject(setPatientTypeOptions, initialData.patient_type);
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
                // Determine expired status locally
                const today = new Date().toISOString().split('T')[0];
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

        const isPending = pkg.status === 'pending';

        setFormData(prev => ({
            ...prev,
            package_type_id: packageTypeId,   // ✅ INI YANG PENTING
            package_type: packageLabel,
            amount: isPending ? pkg.nominal : 0,
            payment_method: isPending ? pkg.payment_method : 'Package'
        }));

    }, [selectedPackage]);

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

    const handleExtendPackage = async (newEndDate, notes) => {
        if (!selectedPackage) return;
        setExtendLoading(true);
        try {
            const { error } = await extendPackage(selectedPackage.id, newEndDate, notes);
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
        
        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            toast({ variant: "destructive", title: "Validasi Gagal", description: "Mohon lengkapi field yang wajib diisi." });
            return;
        }

        setIsSubmitting(true);
        try {
            const isoDate = parseDateFromDisplay(formData.recap_date);
            const selectedTherapist = therapists.find(t => t.value === formData.therapist_id);
            const therapistName = selectedTherapist ? selectedTherapist.label : '';

            // Resolve patient_type: jika UUID → cari label-nya, jika sudah label → pakai langsung
            const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(formData.patient_type || '');
            const resolvedPatientType = isUUID
                ? (patientTypeOptions.find(o => o.value === formData.patient_type)?.label || formData.patient_type)
                : formData.patient_type;

            const payload = {
                ...formData,
                recap_date: isoDate,
                therapist_name: therapistName,
                patient_type: resolvedPatientType,
                diagnosis: Array.isArray(formData.diagnosis) && formData.diagnosis.length > 0
  ? formData.diagnosis.map(d => {
      if (typeof d === 'string') return d; // kalau sudah UUID
      if (typeof d === 'object' && d.value) return d.value; // ambil value
      return null;
    }).filter(Boolean)
  : undefined,
                amount: parseFloat(formData.amount) || 0,
                discount_value: parseFloat(formData.discount_value) || 0,
                discount_type: formData.discount_type === 'none' ? null : formData.discount_type,
                package_type_id: formData.package_type_id || null,
                package_type: formData.package_type || null
            };

            let result;
            if (mode === 'add') {
                result = await createDailyRecap(payload);
            } else {
                result = await updateDailyRecap(initialData.id, payload);
            }

            if (result.error) throw result.error;
            toast({ title: "Berhasil", description: `Data berhasil ${mode === 'add' ? 'disimpan' : 'diperbarui'}.` });
            if (onSuccess) onSuccess();
            onClose();
        } catch (error) {
            toast({ variant: "destructive", title: "Error", description: error.message || "Gagal menyimpan data." });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    if(!isOpen) return null;

    return (
        <>
            <Dialog open={isOpen} onOpenChange={(open) => !isSubmitting && onClose()}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto rounded-xl shadow-lg p-0">
                    <div className="px-6 py-6 border-b border-slate-100">
                        <DialogHeader>
                            <DialogTitle className="text-xl font-bold text-slate-900">{mode === 'add' ? 'Tambah Recap Harian' : 'Edit Recap Harian'}</DialogTitle>
                            <DialogDescription className="text-slate-500">Lengkapi data kunjungan pasien berikut.</DialogDescription>
                        </DialogHeader>
                    </div>
                    <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* LEFT COLUMN */}
                        <div className="space-y-6">
                            <div className="space-y-3">
                                <h3 className="text-sm font-bold text-slate-800 border-b pb-2">Tanggal & Pasien</h3>
                                <div className="space-y-1 relative">
                                    <Label>Tanggal Sesi <span className="text-red-500">*</span></Label>
                                    <div className="flex gap-2">
                                        <Input value={formData.recap_date || ''} onChange={(e) => handleChange('recap_date', e.target.value)} />
                                        <Button variant="outline" size="icon" onClick={() => setShowDatePicker(p => !p)}><CalendarIcon className="w-4 h-4" /></Button>
                                    </div>
                                    {errors.recap_date && <p className="text-xs text-red-500">{errors.recap_date}</p>}
                                    {showDatePicker && <div className="absolute z-50 mt-1"><DatePicker value={parseDateFromDisplay(formData.recap_date)} onChange={handleDateSelect} onClose={() => setShowDatePicker(false)} /></div>}
                                </div>
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
                                
                                {formData.guest_name?.trim() && !formData.patient_id && (
                                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
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
                            </div>

                            <div className="space-y-3">
                                <h3 className="text-sm font-bold text-slate-800 border-b pb-2">
                                  Diagnosa & Layanan
                                </h3>

                                {/* 🔥 DIAGNOSA DULU */}
                                <div className="space-y-1">
                                  <Label>Diagnosa</Label>
                                  <SearchableSelect 
                                    options={diagnosisOptions} 
                                    value={formData.diagnosis} 
                                    onChange={v => handleChange('diagnosis', v)} 
                                    onSearch={setDiagnosisSearch} 
                                    placeholder="Cari atau tambah diagnosa..." 
                                    isLoading={loadingDiagnoses} 
                                    multiple={true} 
                                    allowCreate={true}
                                    onCreateOption={handleCreateDiagnosis}
                                  />
                                </div>

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
                            </div>
                        </div>
                        
                        {/* RIGHT COLUMN */}
                        <div className="space-y-6">
                            <div className="space-y-3">
                                <h3 className="text-sm font-bold text-slate-800 border-b pb-2">Kategori & Terapis</h3>
                                <div className="space-y-1">
                                    <Label>Tipe Pasien</Label>
                                    <SearchableSelect options={patientTypeOptions} value={formData.patient_type} onChange={v => handleChange('patient_type', v)} onSearch={setPatientTypeSearch} placeholder="Cari tipe pasien..." isLoading={loadingPatientTypes} />
                                </div>
                                <div className="space-y-1">
                                    <Label>Jenis Paket <span className="text-red-500">*</span></Label>
                                    <SearchableSelect
                                        key={(formData.package_type_id || '') + packageOptions.length}
                                        options={packageOptions}
                                        value={formData.package_type_id || ''}
                                        onChange={(id) => {
                                            const selected = packageOptions.find(p => p.value === id);
                                            console.log("Package type selected:", { id, selected });
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
                                <div className="space-y-1">
                                    <Label>Fisioterapis <span className="text-red-500">*</span></Label>
                                    <SearchableSelect options={therapists} value={formData.therapist_id} onChange={v => handleChange('therapist_id', v)} placeholder="Pilih Terapis..." isLoading={isLoadingCoreData} />
                                    {errors.therapist_id && <p className="text-xs text-red-500">{errors.therapist_id}</p>}
                                </div>
                            </div>
                            <div className="space-y-3">
                                <h3 className="text-sm font-bold text-slate-800 border-b pb-2">Pembayaran</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <Label>Nominal (Rp)</Label>
                                        <Input type="number" value={formData.amount ?? ''} onChange={e => handleChange('amount', e.target.value)} placeholder="0"/>
                                    </div>
                                    <div className="space-y-1">
                                        <Label>Metode Pembayaran</Label>
                                        <SearchableSelect options={paymentMethodOptions} value={formData.payment_method} onChange={v => handleChange('payment_method', v)} onSearch={setPaymentMethodSearch} placeholder="Cari metode..." isLoading={loadingPaymentMethods} />
                                    </div>
                                </div>
                                <div className="space-y-3 bg-slate-50 p-3 rounded-lg border">
                                    <Label className="font-semibold">Diskon (Opsional)</Label>
                                    <div className="space-y-1">
                                        <Label className="text-xs">Jenis Diskon</Label>
                                        <SearchableSelect options={discountTypeOptions} value={formData.discount_label} onChange={v => handleChange('discount_label', v)} onSearch={setDiscountTypeSearch} placeholder="Cari jenis diskon..." isLoading={loadingDiscountTypes} allowCreate={true}/>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <Label className="text-xs">Tipe Potongan</Label>
                                            <Select value={formData.discount_type} onValueChange={v => handleChange('discount_type', v)}>
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
                                            <Input type="number" value={formData.discount_value || ''} onChange={e => handleChange('discount_value', e.target.value)} disabled={formData.discount_type === 'none'}/>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50/50">
                        <Button variant="outline" onClick={onClose} disabled={isSubmitting}>Batal</Button>
                        <Button onClick={handleSubmit} disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700 text-white">
                            {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            {mode === 'add' ? 'Simpan' : 'Simpan Perubahan'}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

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

                    <Button onClick={handleConfirmCreateDiagnosis}>
                        Simpan
                    </Button>
                    </div>
                </DialogContent>
            </Dialog>

        </>
    );
};

export default DailyRecapModal;