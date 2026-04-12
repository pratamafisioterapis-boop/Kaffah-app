import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import SearchableSelect from '@/components/ui/searchable-select';
import { Calendar as CalendarIcon, Loader2, RefreshCw, Trash2 } from 'lucide-react';
import { 
fetchPhysiotherapists, 
fetchOperationalOptions, 
fetchPackageTypes,
formatDateDisplay,
parseDateFromDisplay,
validateDailyRecapForm
} from '@/lib/dailyRecapHelpers';
import { fetchPatients } from '@/lib/dailyRecapHelpers';
import { getDiagnosisOptions } from '@/lib/api';
import { supabase } from '@/lib/customSupabaseClient';
import DatePicker from '@/components/DatePicker';
import { Badge } from '@/components/ui/badge';
import ExtendPackageModal from './ExtendPackageModal';
import { cn } from '@/lib/utils';
import { createDailyRecap, updateDailyRecap } from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';

// Helper functions for Package Type resolution
const isUUID = (str) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

const resolvePackageTypeValue = (val, options) => {
if (!val || !options || !options.length) return null;

// 1. Kalau UUID → langsung match
const byValue = options.find(p => p.value === val);
if (byValue) return byValue.value;

// 2. Match label ke name (case insensitive biar aman)
const byLabel = options.find(p => 
p.label?.toLowerCase() === String(val).toLowerCase()
);
if (byLabel) return byLabel.value;

return null;
};
const DailyRecapForm = ({ initialData, mode, onSuccess, onCancel, onDelete }) => {
const { toast } = useToast();
const [patients, setPatients] = useState([]);
const [therapists, setTherapists] = useState([]);
const [diagnoses, setDiagnoses] = useState([]);
const [services, setServices] = useState([]);
const [patientTypes, setPatientTypes] = useState([]);
const [packageTypes, setPackageTypes] = useState([]);
const [paymentMethods, setPaymentMethods] = useState([]);
const [discountOptions, setDiscountOptions] = useState([]);
const [isLoadingData, setIsLoadingData] = useState(false);
const [isSubmitting, setIsSubmitting] = useState(false);
const [showDatePicker, setShowDatePicker] = useState(false);
const [packageInfo, setPackageInfo] = useState(null);
const [showExtendModal, setShowExtendModal] = useState(false);

const [formData, setFormData] = useState({
recap_date: formatDateDisplay(new Date().toISOString()),
patient_id: '',
actual_patient_id: '',
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
discount_label: '',
discount_value: ''
});

const [errors, setErrors] = useState({});

useEffect(() => {
loadOptions();
}, []);

useEffect(() => {
if (patients.length > 0 && initialData && mode === 'edit') {
initializeForm(initialData);
}
}, [patients, initialData, mode]);

// Inject missing patients after options are loaded
useEffect(() => {
if (mode === 'edit' && initialData) {
const injectMissingPatient = async (patientId) => {
if (!patientId || patients.some(p => p.value === patientId)) return;
try {
const { data: pat, error } = await supabase
.from('patients')
.select('full_name')
.eq('id', patientId)
.single();
if (!error && pat) {
setPatients(prev => [...prev, { value: patientId, label: pat.full_name }]);
}
} catch (e) {
console.error('Error fetching patient name', e);
}
};

if (initialData.patient_id) {
injectMissingPatient(initialData.patient_id);
}
if (initialData.actual_patient_id) {
injectMissingPatient(initialData.actual_patient_id);
}
}
}, [patients, mode, initialData]);

const loadOptions = async () => {
setIsLoadingData(true);
try {
const [pats, physios, diagOpts, servOpts, pTypes, pkgTypes, payMethods, discountOpts] = await Promise.all([
fetchPatients(),
fetchPhysiotherapists(),
getDiagnosisOptions(),
fetchOperationalOptions(['service', 'layanan']),
fetchOperationalOptions('patient_type'),
fetchPackageTypes(),
fetchOperationalOptions('payment_method'),
fetchOperationalOptions('discount_type')
]);
setPatients(Array.isArray(pats) ? pats : []);
setTherapists(Array.isArray(physios) ? physios : []);
setDiagnoses(diagOpts?.data || []);
setServices(Array.isArray(servOpts) ? servOpts : []);
setPatientTypes(Array.isArray(pTypes) ? pTypes : []);
const loadedPackageTypes = Array.isArray(pkgTypes) ? pkgTypes : [];
setPackageTypes(loadedPackageTypes);
setPaymentMethods(Array.isArray(payMethods) ? payMethods : []);
setDiscountOptions(Array.isArray(discountOpts) ? discountOpts : []);
if (mode === 'edit' && initialData) {
// PATIENT
if (initialData.patient_id && (initialData.patient_name || initialData.patients?.full_name)) {
const label = initialData.patient_name || initialData.patients?.full_name;
setPatients(prev => {
const exists = prev.some(p => p.value === initialData.patient_id);
if (exists) return prev;
return [...prev, { value: initialData.patient_id, label }];
});
}

// ACTUAL PATIENT
if (initialData.actual_patient_id && (initialData.actual_patient_name || initialData.actual_patients?.full_name)) {
const label = initialData.actual_patient_name || initialData.actual_patients?.full_name;
setPatients(prev => {
const exists = prev.some(p => p.value === initialData.actual_patient_id);
if (exists) return prev;
return [...prev, { value: initialData.actual_patient_id, label }];
});
}

// Fetch missing patient names if not in options
const fetchMissingPatient = async (patientId, isActual = false) => {
if (!patientId || patients.some(p => p.value === patientId)) return;
try {
const { data: pat, error } = await supabase
.from('patients')
.select('full_name')
.eq('id', patientId)
.single();
if (!error && pat) {
setPatients(prev => [...prev, { value: patientId, label: pat.full_name }]);
}
} catch (e) {
console.error('Error fetching patient name', e);
}
};

if (initialData.patient_id) {
fetchMissingPatient(initialData.patient_id);
}
if (initialData.actual_patient_id) {
fetchMissingPatient(initialData.actual_patient_id);
}

// THERAPIST
if (initialData.therapist_id && initialData.therapist_name) {
setTherapists(prev => {
const exists = prev.some(t => t.value === initialData.therapist_id);
if (exists) return prev;
return [...prev, { value: initialData.therapist_id, label: initialData.therapist_name }];
});
}

// PAYMENT METHOD
if (initialData.payment_method) {
setPaymentMethods(prev => {
const exists = prev.some(p => p.value === initialData.payment_method);
if (exists) return prev;
return [...prev, { value: initialData.payment_method, label: initialData.payment_method }];
});
}

// SERVICE
if (initialData.service_type) {
setServices(prev => {
const exists = prev.some(s => s.value === initialData.service_type);
if (exists) return prev;
return [...prev, { value: initialData.service_type, label: initialData.service_type }];
});
}

// PACKAGE TYPE INJECTION
const pkgLabel = initialData.package_type;
const pkgId = initialData.package_tracking_id || initialData.raw_package_type_id || initialData.package_type_id;

if (pkgLabel || pkgId) {
setPackageTypes(prev => {
const exists = prev.some(p => p.value === pkgId || p.label === pkgLabel);
if (exists) return prev;

return [
...prev,
{
value: pkgId || pkgLabel,
label: pkgLabel || 'Package'
}
];
});
}
}
} catch (error) {
console.error("Error loading options:", error);
setPatients([]);
setTherapists([]);
setDiagnoses([]);
setServices([]);
setPatientTypes([]);
setPackageTypes([]);
setPaymentMethods([]);
}
finally {
setIsLoadingData(false);
}
};

const initializeForm = (data) => {
let diag = data.diagnosis || [];
if (typeof diag === 'string') {
try { diag = JSON.parse(diag); } catch { diag = [diag]; }
}
if (!Array.isArray(diag)) diag = [diag];
const guestNameFix = (
data.guest_name ||
data.patient_name ||
data.name ||
data.patient ||
''
).trim();
let originalAmount = data.amount_original ?? data.amount ?? 0;

if (data.discount_type === 'percentage') {
  originalAmount = Math.round(
    data.amount / (1 - (data.discount_value || 0) / 100)
  );
}

if (data.discount_type === 'nominal') {
  originalAmount = data.amount + (data.discount_value || 0);
}
setFormData(prev => ({
...prev,
recap_date: formatDateDisplay(data.date || data.recap_date),
patient_id: data.patient_id || '',
actual_patient_id: data.actual_patient_id ?? data.patient_id ?? '',
guest_name: guestNameFix,
diagnosis: diag,
service_type: data.service_type || '',
patient_type: data.patient_type || '',
package_type_id: '',
package_type: '', // Preserve label
therapist_id: data.therapist_id || '',
amount: data.amount_original ?? originalAmount,
payment_method: data.payment_method || '',
discount_type: data.discount_type || 'none',
discount_label: data.discount_label || '',
discount_value: data.discount_value || ''
}));
// FORCE inject patient supaya label pasti ada
if (data.patient_id) {
setPatients(prev => {
const exists = prev.some(p => p.value === data.patient_id);
if (exists) return prev;

return [
...prev,
{
value: data.patient_id,
label: data.patient_name || 'Loading...'
}
];
});
}
if (data.patient_id) {
setPatients(prev => {
const exists = prev.some(p => p.value === data.patient_id);
if (exists) return prev;
return [...prev, {
value: data.patient_id,
label: data.patient_name || data.patients?.full_name || 'Tidak diketahui'
}];
});
}

if (data.actual_patient_id) {
setPatients(prev => {
const exists = prev.some(p => p.value === data.actual_patient_id);
if (exists) return prev;
return [...prev, {
value: data.actual_patient_id,
label: data.actual_patient_name || data.actual_patients?.full_name || 'Tidak diketahui'
}];
});
}

if (data.therapist_id) {
setTherapists(prev => {
const exists = prev.some(t => t.value === data.therapist_id);
if (exists) return prev;
return [...prev, {
value: data.therapist_id,
label: data.therapist_name || data.therapist?.name || 'Tidak diketahui'
}];
});
}

if (data.patient_id) {
setTimeout(() => {
fetchPatientPackageInfo(data.patient_id);
}, 0);
}
};

// Resolve Package Type UUID based on initialData
useEffect(() => {
if (mode === 'edit' && initialData && packageTypes.length > 0) {
if (!formData.package_type_id) {
// Determine the value to resolve
const valToResolve = initialData.package_type;
const resolvedId = resolvePackageTypeValue(valToResolve, packageTypes);
if (resolvedId) {
const matchedOption = packageTypes.find(p => p.value === resolvedId);
setFormData(prev => ({
...prev,
package_type_id: resolvedId,
package_type: matchedOption?.label || initialData.package_type
}));
}
}
}
}, [packageTypes, mode, initialData, formData.package_type_id]);

const fetchPatientPackageInfo = async (patientId) => {
if (!patientId) {
setPackageInfo(null);
return;
}

try {
const { data: packages, error } = await supabase
.from('package_tracking')
.select(`
*,
packages (
name
)
`)
.eq('patient_id', patientId)
.order('created_at', { ascending: false });

if (error) throw error;

if (packages && packages.length > 0) {
let pkg = packages.find(p => p.status === 'aktif' && p.sessions_remaining > 0);

if (!pkg) pkg = packages.find(p => p.status === 'aktif');

if (!pkg) pkg = packages[0];

if (!pkg) {
setPackageInfo(null);
return;
}
const endDate = new Date(pkg.extended_until || pkg.end_date);
const today = new Date();
today.setHours(0,0,0,0);
const isExpired = 
endDate < today || 
pkg.sessions_used >= pkg.total_sessions;
setPackageInfo({
...pkg,
package_name: pkg.packages?.name || pkg.package_name,
isExpired
});

const isPackageAlreadySelected = !!formData.package_type_id;

if (mode === 'add' && !isPackageAlreadySelected) {
setFormData(prev => ({
...prev,
package_type_id: pkg.package_type_id,
package_type: pkg.package_name,
amount: 0,
payment_method: 'Package'
}));
}
} else {
setPackageInfo(null);
}
} catch (err) {
console.error("Error fetching package info:", err);
setPackageInfo(null);
}
};

const handlePatientChange = (val) => {
setFormData(prev => ({
...prev,
patient_id: val,
package_type_id: '', // reset hanya saat ganti pemilik
package_type: ''
}));
fetchPatientPackageInfo(val);
};

const handleChange = (field, value) => {
setFormData(prev => ({ ...prev, [field]: value }));
if (errors[field]) setErrors(prev => ({ ...prev, [field]: null }));
};

const handleExtendPackage = async (newDateIso) => {
if (!packageInfo) return;
try {
const { error } = await supabase
.from('package_tracking')
.update({ 
end_date: newDateIso, 
extended_until: newDateIso,
status: 'aktif' 
})
.eq('id', packageInfo.id);

if (error) throw error;
fetchPatientPackageInfo(formData.patient_id);
setFormData(prev => ({
...prev,
package_type_id: packageInfo.package_type_id,
package_type: packageInfo.package_name,
amount: 0,
payment_method: 'Package'
}));
} catch (err) {
console.error("Failed to extend package", err);
}
};

const handleSubmit = async () => {
const validation = validateDailyRecapForm(formData);
if (!validation.isValid) {
setErrors(validation.errors);
return;
}
setIsSubmitting(true);
try {
const isoDate = parseDateFromDisplay(formData.recap_date);
const therapistName = therapists.find(t => t.value === formData.therapist_id)?.label || '';
const { data: activePackage } = await supabase
.from('package_tracking')
.select('id')
.eq('patient_id', formData.patient_id)
.eq('status', 'aktif')
.lt('sessions_used', 'total_sessions')
.order('created_at', { ascending: false })
.limit(1)
.single();
const selectedDiagnosisLabels = diagnoses
.filter(d => formData.diagnosis.includes(d.value))
.map(d => d.label);

const selectedServiceLabel = services.find(s => s.value === formData.service_type)?.label || '';
const selectedPatientTypeLabel = patientTypes.find(p => p.value === formData.patient_type)?.label || '';

const selectedPackage = packageTypes.find(
  p => String(p.value) === String(formData.package_type_id)
);

if (!selectedPackage) {
  throw new Error("Package tidak terdeteksi. Pilih ulang paket.");
}

const payload = {
recap_date: isoDate,
patient_id: formData.patient_id,
actual_patient_id: formData.actual_patient_id,

diagnosis: formData.diagnosis,
diagnosis_labels: selectedDiagnosisLabels,

service_type: selectedServiceLabel,
patient_type: selectedPatientTypeLabel,

package_tracking_id: null,


package_type: selectedPackage.label,

therapist_id: formData.therapist_id,
therapist_name: therapistName,
amount_original: parseFloat(formData.amount) || 0,
amount: parseFloat(formData.amount) || 0,
payment_method: formData.payment_method,
discount_type: formData.discount_type === 'none' ? null : formData.discount_type,
discount_value: formData.discount_type === 'none' ? 0 : (parseFloat(formData.discount_value) || 0),
discount_label: formData.discount_label || null
};

let result;
if (mode === 'add') {
result = await createDailyRecap(payload);
} else {
if (!initialData?.id) {
throw new Error("Missing ID for update");
}
result = await updateDailyRecap(initialData.id, payload);
}

if (result.error) {
if (result.error.code === 'NOT_FOUND') {
toast({ variant: "destructive", title: "Gagal", description: "Data rekap tidak ditemukan atau sudah dihapus." });
onCancel(); 
} else {
throw result.error;
}
} else {
onSuccess();
}
} catch (error) {
console.error("Submit error:", error);
toast({ variant: "destructive", title: "Error", description: error.message || "Gagal menyimpan data." });
} finally {
setIsSubmitting(false);
}
};

return (
<div className="space-y-4">
<div className="space-y-2 relative">
<Label>Tanggal <span className="text-red-500">*</span></Label>
<div className="flex gap-2">
<Input 
value={formData.recap_date}
onChange={(e) => handleChange('recap_date', e.target.value)}
placeholder="dd/mm/yyyy"
className={cn(errors.recap_date && "border-red-500")}
/>
<Button 
variant="outline" 
size="icon"
onClick={() => setShowDatePicker(!showDatePicker)}
>
<CalendarIcon className="w-4 h-4" />
</Button>
</div>
{errors.recap_date && <p className="text-xs text-red-500">{errors.recap_date}</p>}
{showDatePicker && (
<div className="absolute top-full left-0 z-50 mt-1">
<DatePicker 
value={parseDateFromDisplay(formData.recap_date)}
onChange={(iso) => {
handleChange('recap_date', formatDateDisplay(iso));
setShowDatePicker(false);
}}
onClose={() => setShowDatePicker(false)}
/>
</div>
)}
</div>

{(formData.guest_name || '').trim() !== '' && (
<div className="bg-amber-50 border border-amber-200 rounded p-3 text-sm">
<p className="font-medium text-amber-800">
Pasien Guest: {formData.guest_name}
</p>
{initialData?.guest_phone && (
<p className="text-amber-700">{initialData?.guest_phone}</p>
)}
<p className="text-xs text-amber-700 mt-1">
Pilih pasien database di bawah jika ingin mengubah menjadi pasien terdaftar.
</p>
</div>
)}

<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
<div className="space-y-2">
<Label>Nama Pasien (Pemilik Paket) <span className="text-red-500">*</span></Label>
<SearchableSelect
options={patients}
value={formData.patient_id || ''}
onChange={handlePatientChange}
placeholder="Cari pasien..."
onSearch={async (term) => {
const data = await fetchPatients(term);
setPatients(Array.isArray(data) ? data : []);
}}
/>
{errors.patient_id && <p className="text-xs text-red-500">{errors.patient_id}</p>}
</div>
<div className="space-y-2">
<Label>Nama Pasien Aktual <span className="text-red-500">*</span></Label>
<SearchableSelect 
options={patients}
value={formData.actual_patient_id}
onChange={(val) => handleChange('actual_patient_id', val)}
placeholder="Pilih pasien yang berobat..."
className={errors.actual_patient_id ? "border-red-500" : ""}
/>
{errors.actual_patient_id && <p className="text-xs text-red-500">{errors.actual_patient_id}</p>}
</div>
</div>

{packageInfo && (
<div className={cn("p-3 rounded-lg border text-sm flex justify-between items-center", 
packageInfo.isExpired ? "bg-red-50 border-red-200" : "bg-blue-50 border-blue-200"
)}>
<div>
<p className="font-semibold text-slate-800">{packageInfo.package_name}</p>
<p className="text-slate-600">
Sesi: {packageInfo.sessions_used} / {packageInfo.total_sessions} | 
Status: <span className="capitalize font-medium">{packageInfo.status}</span>
</p>
{packageInfo.isExpired && (
<p className="text-red-600 text-xs mt-1">
Paket kadaluarsa pada {formatDateDisplay(packageInfo.end_date || packageInfo.extended_until)}
</p>
)}
</div>
<div className="flex gap-2">
{packageInfo.isExpired ? (
<>
<Button size="sm" variant="outline" onClick={() => setShowExtendModal(true)}>
<RefreshCw className="w-3 h-3 mr-1" /> Extend
</Button>
<Button size="sm" onClick={() => {
setFormData(prev => ({ ...prev, package_type_id: '', package_type: '', amount: '' }));
}}>
Beli Baru
</Button>
</>
) : (
<Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-blue-200">Aktif</Badge>
)}
</div>
</div>
)}

<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
<div className="space-y-2">
<Label>Diagnosa</Label>
<SearchableSelect 
options={diagnoses}
value={formData.diagnosis}
onChange={(val) => handleChange('diagnosis', val)}
multiple={true}
allowCreate={true}
/>
</div>
<div className="space-y-2">
<Label>Nama Fisioterapis <span className="text-red-500">*</span></Label>
<SearchableSelect 
options={therapists}
value={formData.therapist_id}
onChange={(val) => handleChange('therapist_id', val)}
className={errors.therapist_id ? "border-red-500" : ""}
/>
{errors.therapist_id && <p className="text-xs text-red-500">{errors.therapist_id}</p>}
</div>
</div>

<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
<div className="space-y-2">
<Label>Tipe Layanan</Label>
<SearchableSelect 
options={services}
value={formData.service_type}
onChange={(val) => handleChange('service_type', val)}
allowCreate={true}
/>
</div>
<div className="space-y-2">
<Label>Tipe Pasien</Label>
<SearchableSelect 
options={patientTypes}
value={formData.patient_type}
onChange={(val) => handleChange('patient_type', val)}
allowCreate={true}
/>
</div>
<div className="space-y-2">
<Label>Tipe Paket</Label>
<SearchableSelect 

options={packageTypes}
value={formData.package_type || ''}
onChange={(val) => {
  const selected = packageTypes.find(p => p.value === val);

  setFormData(prev => ({
    ...prev,
    package_type_id: val,
    package_type: selected?.label || ''
  }));
}}
allowCreate={true}
/>
{(!packageTypes.length && formData.package_type) && (
<p className="text-xs text-slate-500 mt-1">Saat ini: {formData.package_type}</p>
)}
</div>
</div>

<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
<div className="space-y-2">
<Label>Nominal (Rp)</Label>
<Input 
  type="number"
  value={formData.amount}
  onChange={(e) => {
    const value = Number(e.target.value || 0);
    setFormData(prev => ({
      ...prev,
      amount: value,
      amount_original: value // 🔥 INI KUNCINYA
    }));
  }}
  placeholder="0"
/>
</div>
<div className="space-y-2">
<Label>Metode Pembayaran</Label>
<SearchableSelect 
options={paymentMethods}
value={formData.payment_method}
onChange={(val) => handleChange('payment_method', val)}
allowCreate={true}
/>
</div>
</div>

<div className="space-y-2 bg-slate-50 p-3 rounded-lg border border-slate-100">
<Label className="mb-2 block">Diskon</Label>
<RadioGroup 
value={formData.discount_type} 
onValueChange={(val) => handleChange('discount_type', val)}
className="flex gap-4 mb-3"
>
  <SearchableSelect
  options={discountOptions}
  value={formData.discount_label}
  onChange={(val) => {
  const selected = discountOptions.find(d => d.value === val);
  setFormData(prev => ({
    ...prev,
    discount_label: selected?.label || ''
  }));
}}
  placeholder="Pilih jenis diskon (opsional)"
/>
<div className="flex items-center space-x-2">
<RadioGroupItem value="none" id="d-none" />
<Label htmlFor="d-none" className="font-normal cursor-pointer">Tidak ada</Label>
</div>
<div className="flex items-center space-x-2">
<RadioGroupItem value="percentage" id="d-perc" />
<Label htmlFor="d-perc" className="font-normal cursor-pointer">Persentase (%)</Label>
</div>
<div className="flex items-center space-x-2">
<RadioGroupItem value="nominal" id="d-nom" />
<Label htmlFor="d-nom" className="font-normal cursor-pointer">Nominal (Rp)</Label>
</div>
</RadioGroup>

{formData.discount_type !== 'none' && (
<div>
<Input 
type="number"
value={formData.discount_value}
onChange={(e) => handleChange('discount_value', e.target.value)}
placeholder={formData.discount_type === 'percentage' ? "Contoh: 10" : "Contoh: 50000"}
className={errors.discount_value ? "border-red-500 bg-white" : "bg-white"}
/>
{errors.discount_value && <p className="text-xs text-red-500 mt-1">{errors.discount_value}</p>}
</div>
)}
</div>
<div className="flex justify-between pt-4 border-t">
{mode === 'edit' && onDelete ? (
<Button type="button" variant="destructive" onClick={onDelete} disabled={isSubmitting}>
<Trash2 className="w-4 h-4 mr-2" /> Hapus
</Button>
) : <div></div>}
<div className="flex gap-2">
<Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>Batal</Button>
<Button type="button" onClick={handleSubmit} disabled={isSubmitting} className="bg-blue-600 text-white hover:bg-blue-700">
{isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
{mode === 'add' ? 'Simpan Recap' : 'Simpan Perubahan'}
</Button>
</div>
</div>

<ExtendPackageModal 
isOpen={showExtendModal} 
onClose={() => setShowExtendModal(false)}
packageInfo={packageInfo}
onExtend={handleExtendPackage}
/>
</div>
);
};

export default DailyRecapForm;
