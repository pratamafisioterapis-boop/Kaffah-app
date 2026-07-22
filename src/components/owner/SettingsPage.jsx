import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Plus, Trash2, Settings, Save, Loader2, Edit2, AlertCircle,
  Package, MessageCircle, Clock, Gift, CalendarCheck, UserCog,
  Check, ClipboardPaste, BookOpen, Image as ImageIcon,
  FileText, Upload, X, Tag, FolderTree, Building, HardDrive, FileSpreadsheet
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Switch } from "@/components/ui/switch";
import { 
  getPatientInfoOptions, 
  createPatientInfoOption, 
  updatePatientInfoOption, 
  deletePatientInfoOption,
  getOperationalOptions, 
  createOperationalOption, 
  updateOperationalOption, 
  deleteOperationalOption
} from '@/lib/api';
import { Palette, Wallet } from 'lucide-react';
import DesignStyleManager from '@/components/owner/DesignStyleManager';
import ServiceRateManager from '@/components/owner/ServiceRateManager';
import { supabase } from '@/lib/customSupabaseClient';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";

// Import Managers
import AccountingCategoryManager from '@/components/owner/AccountingCategoryManager';
import MediaAssetManager from '@/components/owner/MediaAssetManager';
import MediaAssetGallery from '@/components/owner/MediaAssetGallery';
import WhatsAppSettings from '@/components/owner/WhatsAppSettings';
import DiagnosisServiceManager from '@/components/owner/DiagnosisServiceManager';
import AccountClinicManager from '@/components/owner/AccountClinicManager';
import OwnerBankAccountManager from '@/components/owner/OwnerBankAccountManager';
import GoogleDriveSettings from '@/components/owner/GoogleDriveSettings';
import GoogleSheetsSettings from '@/components/owner/GoogleSheetsSettings';
import TherapistDriveUploadsManager from '@/components/owner/TherapistDriveUploadsManager';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { isFeatureBlockedByDependency } from '@/lib/featureCatalog';

// --- Dedicated Discount Type Manager ---
const DiscountTypeManager = () => {
  const { toast } = useToast();
  // State Initialization as requested
  const [discountTypes, setDiscountTypes] = useState([]);
  const [discountTypeForm, setDiscountTypeForm] = useState({ label: '' });
  const [editingDiscountType, setEditingDiscountType] = useState(null);
  const [showDiscountTypeModal, setShowDiscountTypeModal] = useState(false);
  
  const [loading, setLoading] = useState(true);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Fetch on mount
  useEffect(() => {
    fetchDiscountTypes();
  }, []);

  const fetchDiscountTypes = async () => {
    setLoading(true);
    console.log("🔄 Fetching discount types...");
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id;
      const { data: userRow } = await supabase.from('users').select('clinic_id').eq('id', userId).single();

      const { data, error } = await supabase
        .from('operational_options')
        .select('id, category, label, is_active, created_at')
        .eq('category', 'discount_type')
        .eq('clinic_id', userRow?.clinic_id)
        .order('created_at', { ascending: true });

      if (error) throw error;

      console.log(`✅ Fetched ${data?.length || 0} discount types`);
      setDiscountTypes(data || []);
    } catch (error) {
      console.error("❌ Error fetching discount types:", error);
      toast({ variant: "destructive", title: "Error", description: "Gagal memuat jenis diskon." });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDiscountType = async () => {
    const labelTrimmed = discountTypeForm.label.trim();
    if (!labelTrimmed) {
      toast({ variant: "destructive", title: "Validasi Gagal", description: "Nama label tidak boleh kosong." });
      return;
    }

    setIsProcessing(true);
    console.log(`💾 Saving discount type: "${labelTrimmed}"...`);

    const payload = {
      category: 'discount_type',
      label: labelTrimmed,
      is_active: true
    };

    try {
      if (editingDiscountType) {
        // UPDATE
        console.log("🔄 Operation: UPDATE", editingDiscountType.id);
        console.log("📦 Payload:", payload);
        
        const { data, error } = await supabase
          .from('operational_options')
          .update(payload)
          .eq('id', editingDiscountType.id)
          .select()
          .single();

        if (error) throw error;
        
        console.log("✅ Update success:", data);
        toast({ title: "Berhasil", description: "Jenis diskon diperbarui." });
        setDiscountTypes(prev => prev.map(item => item.id === editingDiscountType.id ? data : item));
      } else {
        // INSERT
        console.log("🔄 Operation: INSERT");
        console.log("📦 Payload:", payload);

        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData?.session?.user?.id;
        const { data: userRow } = await supabase.from('users').select('clinic_id').eq('id', userId).single();

        const { data, error } = await supabase
          .from('operational_options')
          .insert({ ...payload, clinic_id: userRow?.clinic_id })
          .select()
          .single();

        if (error) throw error;

        console.log("✅ Insert success:", data);
        toast({ title: "Berhasil", description: "Jenis diskon ditambahkan." });
        setDiscountTypes(prev => [...prev, data]);
      }
      setShowDiscountTypeModal(false);
      setDiscountTypeForm({ label: '' });
      setEditingDiscountType(null);
    } catch (error) {
      console.error("❌ Save failed:", error);
      toast({ variant: "destructive", title: "Gagal Menyimpan", description: error.message });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteDiscountType = async () => {
    if (!editingDiscountType) return;
    
    setIsProcessing(true);
    console.log("🗑️ Deleting discount type:", editingDiscountType.id);

    try {
      const { error } = await supabase
        .from('operational_options')
        .delete()
        .eq('id', editingDiscountType.id);

      if (error) throw error;

      console.log("✅ Delete success");
      toast({ title: "Terhapus", description: "Jenis diskon dihapus." });
      setDiscountTypes(prev => prev.filter(item => item.id !== editingDiscountType.id));
      setIsDeleteOpen(false);
      setEditingDiscountType(null);
    } catch (error) {
      console.error("❌ Delete failed:", error);
      toast({ variant: "destructive", title: "Gagal Menghapus", description: error.message });
    } finally {
      setIsProcessing(false);
    }
  };

  const openAdd = () => {
    setEditingDiscountType(null);
    setDiscountTypeForm({ label: '' });
    setShowDiscountTypeModal(true);
  };

  const openEdit = (item) => {
    setEditingDiscountType(item);
    setDiscountTypeForm({ label: item.label });
    setShowDiscountTypeModal(true);
  };

  const openDelete = (item) => {
    setEditingDiscountType(item);
    setIsDeleteOpen(true);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mt-6">
      <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Jenis Diskon</h2>
          <p className="text-sm text-slate-500">Kelola label diskon (Misal: Promo Merdeka, Diskon Teman).</p>
        </div>
        <Button onClick={openAdd} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-2" />
          Tambah Baru
        </Button>
      </div>

      <div className="p-6">
        <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-slate-300" /></div>
          ) : discountTypes.length === 0 ? (
            <div className="text-center py-12 text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-200">
              <p>Belum ada opsi diskon yang tersedia.</p>
              <Button variant="link" onClick={openAdd} className="text-blue-600 mt-2">Tambahkan opsi pertama</Button>
            </div>
          ) : (
            discountTypes.map((opt) => (
              <motion.div
                key={opt.id}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="group flex items-center justify-between p-4 rounded-lg border border-slate-100 bg-white hover:border-slate-300 hover:shadow-sm transition-all duration-200"
              >
                <div className="flex flex-col">
                  <span className="font-medium text-slate-700 ml-2">{opt.label}</span>
                </div>
                <div className="flex items-center gap-2 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(opt)} className="h-8 w-8 text-slate-500 hover:text-blue-600 hover:bg-blue-50">
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => openDelete(opt)} className="h-8 w-8 text-slate-500 hover:text-red-600 hover:bg-red-50">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      <Dialog open={showDiscountTypeModal} onOpenChange={setShowDiscountTypeModal}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader><DialogTitle>{editingDiscountType ? 'Edit' : 'Tambah'} Jenis Diskon</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-slate-700">Nama Label Diskon</label>
              <Input 
                value={discountTypeForm.label} 
                onChange={(e) => setDiscountTypeForm({ ...discountTypeForm, label: e.target.value })} 
                placeholder="Contoh: Promo Agustusan"
                autoFocus 
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDiscountTypeModal(false)}>Batal</Button>
            <Button onClick={handleSaveDiscountType} disabled={isProcessing} className="bg-blue-600 hover:bg-blue-700">
              {isProcessing && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Modal */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="w-5 h-5" />
              Konfirmasi Hapus
            </DialogTitle>
            <DialogDescription>
              Hapus opsi "{editingDiscountType?.label}"?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>Batal</Button>
            <Button onClick={handleDeleteDiscountType} disabled={isProcessing} className="bg-red-600 hover:bg-red-700">
              {isProcessing && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Hapus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// --- Generic Option Manager for other tabs ---
const OptionManager = ({ title, category, description, isLegacy = false }) => {
  const { toast } = useToast();
  const [options, setOptions] = useState([]);
  const [expandedIds, setExpandedIds] = useState([]);
  const toggleExpand = (id) => {
  setExpandedIds(prev =>
    prev.includes(id)
      ? prev.filter(item => item !== id)
      : [...prev, id]
  );
};
    const [loading, setLoading] = useState(true);
  const [parentOptions, setParentOptions] = useState([]);
  
  // Dialog States
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isPasteOpen, setIsPasteOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Selection State
  const [selectedOption, setSelectedOption] = useState(null);
  const [formData, setFormData] = useState({ 
    label: '',
    session_count: '',
    validity_days: ''
  });
  const [pasteContent, setPasteContent] = useState("");

  const isPackageType = category === 'tipe_paket';

  useEffect(() => {
    fetchOptions();
  }, [category]);
  useEffect(() => {
  if (category === 'diagnosa') {
    fetchParentServices();
  }
}, [category]);

  const fetchOptions = async () => {
    setLoading(true);
    let result;
    if (isLegacy) {
      result = await getPatientInfoOptions();
    } else {
      result = await getOperationalOptions(category);
    }
    
    if (result.data) {
      setOptions(result.data);
    } else {
      toast({ variant: "destructive", title: "Error Fetching Data", description: result.error?.message });
    }
    setLoading(false);
  };
  const fetchParentServices = async () => {
  const result = await getOperationalOptions('service');
  
  if (result.data) {
    setParentOptions(result.data);
  } else {
    toast({
      variant: "destructive",
      title: "Error",
      description: "Gagal memuat daftar Service."
    });
  }
};

  const openAddDialog = () => {
    setFormData({ label: '', session_count: '', validity_days: '' });
    setIsAddOpen(true);
  };

  const openEditDialog = (option) => {
    setSelectedOption(option);
    setFormData({ 
      label: option.label,
      session_count: option.session_count || '',
      validity_days: option.validity_days || ''
    });
    setIsEditOpen(true);
  };

  const openDeleteDialog = (option) => {
    setSelectedOption(option);
    setIsDeleteOpen(true);
  };

  const handleSave = async (isEdit = false) => {
    if (!formData.label.trim()) {
      toast({
        variant: "destructive",
        title: "Validasi Gagal",
        description: "Nama opsi tidak boleh kosong."
      });
      return;
    }

    if (category === 'diagnosa' && !formData.parent_id) {
      toast({
        variant: "destructive",
        title: "Validasi Gagal",
        description: "Parent Service wajib dipilih."
      });
      return;
    }

    setIsProcessing(true);
    let result;
    const extraData = {
      ...(isPackageType && {
        session_count: parseInt(formData.session_count),
        validity_days: parseInt(formData.validity_days)
      }),

      ...(category === 'diagnosa' && {
        parent_id: formData.parent_id || null
      })
    };

    try {
      if (isEdit) {
        if (isLegacy) {
          result = await updatePatientInfoOption(selectedOption.id, formData.label.trim());
        } else {
          result = await updateOperationalOption(selectedOption.id, formData.label.trim(), extraData);
        }
      } else {
        if (isLegacy) {
          result = await createPatientInfoOption(formData.label.trim());
        } else {
          result = await createOperationalOption(category, formData.label.trim(), extraData);
        }
      }

      if (result.error) throw result.error;

      toast({ title: isEdit ? "Berhasil Diperbarui" : "Berhasil Ditambahkan", description: `Opsi "${formData.label}" telah disimpan.` });

      if (isEdit) {
        setOptions(options.map(opt => opt.id === selectedOption.id ? result.data : opt));
        setIsEditOpen(false);
      } else {
        setOptions([...options, result.data]);
        setIsAddOpen(false);
      }
      setFormData({ label: '', session_count: '', validity_days: '' });

    } catch (error) {
      toast({ variant: "destructive", title: "Gagal Menyimpan", description: error.message || "Terjadi kesalahan sistem." });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedOption) return;
    setIsProcessing(true);
    let result;
    try {
      if (isLegacy) {
        result = await deletePatientInfoOption(selectedOption.id);
      } else {
        result = await deleteOperationalOption(selectedOption.id);
      }

      if (result.error) throw result.error;

      toast({ title: "Terhapus", description: "Opsi telah dihapus dari sistem." });
      setOptions(options.filter(opt => opt.id !== selectedOption.id));
      setIsDeleteOpen(false);
    } catch (error) {
      toast({ variant: "destructive", title: "Gagal Menghapus", description: "Mungkin opsi ini sedang digunakan pada data lain." });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkPaste = async () => {
    if (!pasteContent.trim()) {
      toast({ variant: "destructive", title: "Error", description: "Konten paste kosong." });
      return;
    }

    setIsProcessing(true);
    try {
      const lines = pasteContent.split(/\r?\n/).map(l => l.trim()).filter(l => l);
      const uniqueLines = [...new Set(lines)];
      const existingLabels = options.map(o => o.label.toLowerCase());
      const newItems = uniqueLines.filter(l => !existingLabels.includes(l.toLowerCase()));

      if (newItems.length === 0) {
        toast({ title: "Info", description: "Semua item sudah ada atau duplikat." });
        setIsProcessing(false);
        return;
      }

      const promises = newItems.map(label => {
         if (isLegacy) return createPatientInfoOption(label);
         return createOperationalOption(category, label, {});
      });

      await Promise.all(promises);
      await fetchOptions();
      
      toast({ title: "Berhasil", description: `${newItems.length} item berhasil ditambahkan.` });
      setPasteContent("");
      setIsPasteOpen(false);

    } catch (err) {
      toast({ variant: "destructive", title: "Gagal", description: "Gagal memproses data." });
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mt-6">
      <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
          <p className="text-sm text-slate-500">{description}</p>
        </div>
        <div className="flex gap-2">
          {!isPackageType && (
            <Button variant="outline" onClick={() => setIsPasteOpen(true)} className="text-slate-600 hover:text-blue-600">
              <ClipboardPaste className="w-4 h-4 mr-2" />
              Paste Banyak
            </Button>
          )}
          <Button onClick={openAddDialog} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-2" />
            Tambah Baru
          </Button>
        </div>
      </div>

      <div className="p-6">
        <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-slate-300" /></div>
          ) : options.length === 0 ? (
            <div className="text-center py-12 text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-200">
              <p>Belum ada opsi yang tersedia.</p>
              <Button variant="link" onClick={openAddDialog} className="text-blue-600 mt-2">Tambahkan opsi pertama</Button>
            </div>
          ) : category === 'diagnosa' ? (

  parentOptions.map((service) => {
    const diagnosaList = options.filter(
      (opt) => opt.parent_id === service.id
    );

    if (diagnosaList.length === 0) return null;

    const isExpanded = expandedIds.includes(service.id);

    return (
      <div key={service.id} className="border rounded-lg overflow-hidden">

        {/* HEADER SERVICE */}
        <div
          onClick={() => toggleExpand(service.id)}
          className="flex justify-between items-center p-4 bg-slate-100 cursor-pointer hover:bg-slate-200 transition"
        >
          <span className="font-semibold text-slate-800">
            {service.label}
          </span>
          <span className="text-sm text-slate-500">
            {isExpanded ? '▲' : '▼'}
          </span>
        </div>

        {/* LIST DIAGNOSA */}
        {isExpanded && (
          <div className="divide-y">
            {diagnosaList.map((opt) => (
              <motion.div
                key={opt.id}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-between p-3 bg-white hover:bg-slate-50"
              >
                <span className="text-slate-700 ml-4">
                  {opt.label}
                </span>

                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openEditDialog(opt)}
                    className="h-8 w-8 text-slate-500 hover:text-blue-600"
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openDeleteDialog(opt)}
                    className="h-8 w-8 text-slate-500 hover:text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    );
  })

) : (

  options.map((opt) => (
    <motion.div
      key={opt.id}
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      className="group flex items-center justify-between p-4 rounded-lg border border-slate-100 bg-white hover:border-slate-300 hover:shadow-sm transition-all duration-200"
    >
      <div className="flex flex-col">
        <span className="font-medium text-slate-700 ml-2">{opt.label}</span>
        {isPackageType && opt.session_count && (
          <span className="text-xs text-slate-500 ml-2 mt-1 flex items-center gap-2">
            <Package className="w-3 h-3" />
            {opt.session_count} Sesi &bull; {opt.validity_days} Hari Aktif
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => openEditDialog(opt)}
          className="h-8 w-8 text-slate-500 hover:text-blue-600 hover:bg-blue-50"
        >
          <Edit2 className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => openDeleteDialog(opt)}
          className="h-8 w-8 text-slate-500 hover:text-red-600 hover:bg-red-50"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </motion.div>
  ))

          )}
        </div>
      </div>
      
     {/* Add Dialog */}
<Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
  <DialogContent className="sm:max-w-[425px]">
    <DialogHeader>
      <DialogTitle>Tambah {title}</DialogTitle>
    </DialogHeader>

    <div className="grid gap-4 py-4">
      {/* Nama Label */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-slate-700">
          Nama Label
        </label>
        <input
          value={formData.label}
          onChange={(e) =>
            setFormData({ ...formData, label: e.target.value })
          }
          className="px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          autoFocus
        />
      </div>

      {/* Parent Service - HANYA UNTUK DIAGNOSA */}
      {category === 'diagnosa' && (
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-slate-700">
            Parent Service <span className="text-red-500">*</span>
          </label>
          <select
            value={formData.parent_id || ''}
            onChange={(e) =>
              setFormData({ ...formData, parent_id: e.target.value })
            }
            className="px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Pilih Service</option>
            {parentOptions.map((srv) => (
              <option key={srv.id} value={srv.id}>
                {srv.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Package Fields */}
      {isPackageType && (
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-slate-700">
              Jumlah Sesi
            </label>
            <input
              type="number"
              min="1"
              value={formData.session_count}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  session_count: e.target.value,
                })
              }
              className="px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-slate-700">
              Masa Aktif (Hari)
            </label>
            <input
              type="number"
              min="1"
              value={formData.validity_days}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  validity_days: e.target.value,
                })
              }
              className="px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
            />
          </div>
        </div>
      )}
    </div>

    <DialogFooter>
      <Button variant="outline" onClick={() => setIsAddOpen(false)}>
        Batal
      </Button>
      <Button
        onClick={() => handleSave(false)}
        disabled={isProcessing}
        className="bg-blue-600 hover:bg-blue-700"
      >
        Simpan
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>

     {/* Edit Dialog */}
<Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
  <DialogContent className="sm:max-w-[425px]">
    <DialogHeader>
      <DialogTitle>Edit {title}</DialogTitle>
    </DialogHeader>

    <div className="grid gap-4 py-4">
      {/* Nama Label */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-slate-700">
          Nama Label
        </label>
        <input
          value={formData.label}
          onChange={(e) =>
            setFormData({ ...formData, label: e.target.value })
          }
          className="px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Parent Service - HANYA UNTUK DIAGNOSA */}
      {category === 'diagnosa' && (
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-slate-700">
            Parent Service <span className="text-red-500">*</span>
          </label>
          <select
            value={formData.parent_id || ''}
            onChange={(e) =>
              setFormData({ ...formData, parent_id: e.target.value })
            }
            className="px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Pilih Service</option>
            {parentOptions.map((srv) => (
              <option key={srv.id} value={srv.id}>
                {srv.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Package Fields */}
      {isPackageType && (
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-slate-700">
              Jumlah Sesi
            </label>
            <input
              type="number"
              min="1"
              value={formData.session_count}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  session_count: e.target.value,
                })
              }
              className="px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-slate-700">
              Masa Aktif (Hari)
            </label>
            <input
              type="number"
              min="1"
              value={formData.validity_days}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  validity_days: e.target.value,
                })
              }
              className="px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
            />
          </div>
        </div>
      )}
    </div>

    <DialogFooter>
      <Button variant="outline" onClick={() => setIsEditOpen(false)}>
        Batal
      </Button>
      <Button
        onClick={() => handleSave(true)}
        disabled={isProcessing}
        className="bg-blue-600 hover:bg-blue-700"
      >
        Perbarui
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>

      {/* Delete Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="w-5 h-5" />
              Konfirmasi Hapus
            </DialogTitle>
            <DialogDescription>
              Hapus opsi "{selectedOption?.label}"?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>Batal</Button>
            <Button onClick={handleDelete} disabled={isProcessing} className="bg-red-600 hover:bg-red-700">Hapus</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Paste Dialog */}
      <Dialog open={isPasteOpen} onOpenChange={setIsPasteOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Paste Banyak Item</DialogTitle>
            <DialogDescription>
              Paste daftar item (satu per baris). Sistem akan otomatis melewati duplikat.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
             <Textarea 
               value={pasteContent} 
               onChange={(e) => setPasteContent(e.target.value)} 
               rows={10}
               placeholder={`Contoh:\nDiagnosa A\nDiagnosa B\nDiagnosa C`}
               className="font-mono text-sm"
             />
             <p className="text-xs text-slate-500">
               *Item yang sudah ada di database tidak akan ditambahkan lagi.
             </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPasteOpen(false)}>Batal</Button>
            <Button onClick={handleBulkPaste} disabled={isProcessing} className="bg-blue-600 hover:bg-blue-700">
              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Proses Paste
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const SETTINGS_TAB_GROUPS = [
  {
    label: 'Akun & Tim',
    items: [
      { value: 'account_clinic', icon: UserCog, label: 'Akun & Klinik' },
    ],
  },
  {
    label: 'Keuangan',
    items: [
      { value: 'bank_accounts', icon: Building, label: 'Akun Bank' },
      { value: 'accounting_cats', icon: BookOpen, label: 'Akunting' },
      { value: 'service_rates', icon: Wallet, label: 'Tarif Jasa' },
      { value: 'payment', icon: null, label: 'Pembayaran' },
      { value: 'discount', icon: Tag, label: 'Jenis Diskon' },
    ],
  },
  {
    label: 'Komunikasi & Integrasi',
    items: [
      { value: 'whatsapp_settings', icon: MessageCircle, label: 'WhatsApp' },
      { value: 'google_drive', icon: HardDrive, label: 'Google Drive' },
      { value: 'google_sheets', icon: FileSpreadsheet, label: 'Backup Google Sheets' },
    ],
  },
  {
    label: 'Data Master',
    items: [
      { value: 'diagnosis_service', icon: FolderTree, label: 'Diagnosa & Layanan' },
      { value: 'source', icon: null, label: 'Sumber' },
      { value: 'type', icon: null, label: 'Tipe Pasien' },
      { value: 'package', icon: null, label: 'Tipe Paket' },
    ],
  },
  {
    label: 'Tampilan & Media',
    items: [
      { value: 'design_style', icon: Palette, label: 'Tampilan' },
      { value: 'media_assets', icon: ImageIcon, label: 'Media' },
    ],
  },
];

const SettingsPage = () => {
  const { userDetails } = useAuth();
  const [reloadGallery, setReloadGallery] = useState(0);
  const [disabledFeatures, setDisabledFeatures] = useState([]);

  useEffect(() => {
    let active = true;
    const fetchDisabledFeatures = async () => {
      if (!userDetails?.clinic_id) return;
      const { data } = await supabase
        .from('clinics')
        .select('disabled_features_by_role')
        .eq('id', userDetails.clinic_id)
        .single();
      if (active) setDisabledFeatures(data?.disabled_features_by_role?.owner || []);
    };
    fetchDisabledFeatures();
    return () => { active = false; };
  }, [userDetails?.clinic_id]);

  const visibleTabGroups = useMemo(() => (
    SETTINGS_TAB_GROUPS
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => !isFeatureBlockedByDependency(item.value, disabledFeatures)),
      }))
      .filter((group) => group.items.length > 0)
  ), [disabledFeatures]);

  const requestedTab = new URLSearchParams(window.location.search).get('tab');
  const initialTab = requestedTab && !isFeatureBlockedByDependency(requestedTab, disabledFeatures)
    ? requestedTab
    : 'account_clinic';

  const handleUploadSuccess = () => {
    setReloadGallery(prev => prev + 1);
  };

  return (
    <div className="space-y-6 animate-in fade-in zoom-in duration-300">

      {/* Hero Banner */}
      <div className="w-full rounded-2xl overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 shadow-xl border border-slate-700/50 relative">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle, #d4af6a 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        <div className="relative flex items-center gap-4 px-5 py-5 sm:px-7 sm:py-6">
          <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400/20 to-amber-600/10 backdrop-blur-sm border border-amber-300/30 flex items-center justify-center shadow-lg">
            <Settings className="w-6 h-6 text-amber-300" />
          </div>
          <div>
            <p className="text-xs font-bold tracking-widest text-amber-300/80 uppercase mb-1">{useAuth().clinicName || ''}</p>
            <h2 className="text-lg sm:text-xl font-bold text-white leading-tight">Pengaturan Sistem</h2>
            <p className="text-sm text-slate-400 mt-0.5">Kelola konfigurasi, opsi dropdown, dan preferensi aplikasi</p>
          </div>
        </div>
      </div>

      <Tabs defaultValue={initialTab} className="w-full">
        <TabsList className="flex flex-col h-auto gap-3 bg-transparent p-0 border-none items-stretch w-full">
          {visibleTabGroups.map((group) => (
            <div key={group.label} className="bg-slate-100/70 rounded-2xl border border-slate-200 p-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 px-1 mb-2">{group.label}</p>
              <div className="flex flex-wrap gap-1.5">
                {group.items.map(({ value, icon: Icon, label }) => (
                  <TabsTrigger
                    key={value}
                    value={value}
                    className="data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm rounded-xl py-2 px-3 flex gap-1.5 items-center text-xs font-medium"
                  >
                    {Icon && <Icon className="w-3.5 h-3.5" />} {label}
                  </TabsTrigger>
                ))}
              </div>
            </div>
          ))}
        </TabsList>

        <div className="mt-6">
          <TabsContent value="account_clinic">
            <AccountClinicManager />
          </TabsContent>
          <TabsContent value="bank_accounts">
            <OwnerBankAccountManager />
          </TabsContent>
          <TabsContent value="whatsapp_settings">
            <WhatsAppSettings />
          </TabsContent>
          <TabsContent value="google_drive" className="space-y-6">
            <GoogleDriveSettings />
            <TherapistDriveUploadsManager />
          </TabsContent>
          <TabsContent value="google_sheets" className="space-y-6">
            <GoogleSheetsSettings />
          </TabsContent>
          <TabsContent value="accounting_cats">
            <AccountingCategoryManager />
          </TabsContent>
          <TabsContent value="media_assets" className="space-y-6">
            <MediaAssetManager onUploadSuccess={handleUploadSuccess} />
            <MediaAssetGallery key={reloadGallery} />
          </TabsContent>
          <TabsContent value="diagnosis_service">
            <DiagnosisServiceManager />
          </TabsContent>
          <TabsContent value="source">
            <OptionManager title="Sumber Pasien" description="Opsi Informasi Tambahan" isLegacy={true} />
          </TabsContent>
          <TabsContent value="type">
            <OptionManager title="Kategori Tipe Pasien" description="Kategori pasien (Normal, Homecare, dll)." category="patient_type" />
          </TabsContent>
          <TabsContent value="package">
            <OptionManager title="Tipe Paket" description="Jenis paket perawatan." category="tipe_paket" />
          </TabsContent>
          <TabsContent value="payment">
            <OptionManager title="Metode Pembayaran" description="Opsi pembayaran." category="payment_method" />
          </TabsContent>
          <TabsContent value="discount">
            <DiscountTypeManager />
          </TabsContent>
          <TabsContent value="design_style">
            <DesignStyleManager />
          </TabsContent>
          <TabsContent value="service_rates">
            <ServiceRateManager />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
};

export default SettingsPage;