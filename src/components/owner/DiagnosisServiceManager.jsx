import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, Trash2, Edit2, Save, Loader2, AlertCircle, 
  ChevronRight, ChevronDown, Check, X, ClipboardPaste, 
  Search, FolderTree, FileText
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { 
  getOperationalOptions, 
  createOperationalOption, 
  updateOperationalOption, 
  deleteOperationalOption 
} from '@/lib/api';

const DiagnosisServiceManager = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState([]);
  const [diagnoses, setDiagnoses] = useState([]);
  const [expandedServices, setExpandedServices] = useState({});
  const [searchQuery, setSearchQuery] = useState("");

  // Dialog States
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [isDiagnosisModalOpen, setIsDiagnosisModalOpen] = useState(false);
  const [isBulkPasteOpen, setIsBulkPasteOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Form States
  const [editingItem, setEditingItem] = useState(null); // null = create mode
  const [formData, setFormData] = useState({ label: '', parent_id: null });
  const [pasteContent, setPasteContent] = useState("");
  const [targetServiceId, setTargetServiceId] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [servicesData, diagnosesData] = await Promise.all([
        getOperationalOptions('service'),
        getOperationalOptions('diagnosa')
      ]);

      if (servicesData.error) throw servicesData.error;
      if (diagnosesData.error) throw diagnosesData.error;

      setServices(servicesData.data || []);
      setDiagnoses(diagnosesData.data || []);
      
      // Default: semua service collapse
setExpandedServices({});

    } catch (error) {
      toast({
        variant: "destructive",
        title: "Gagal memuat data",
        description: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleService = (serviceId) => {
    setExpandedServices(prev => ({
      ...prev,
      [serviceId]: !prev[serviceId]
    }));
  };

  // --- Service Actions ---

  const handleOpenServiceModal = (service = null) => {
    setEditingItem(service);
    setFormData({ label: service ? service.label : '', parent_id: null });
    setIsServiceModalOpen(true);
  };

  const handleSaveService = async () => {
    if (!formData.label.trim()) {
      toast({ variant: "destructive", title: "Nama layanan wajib diisi" });
      return;
    }

    setIsProcessing(true);
    try {
      let result;
      if (editingItem) {
        result = await updateOperationalOption(editingItem.id, formData.label.trim());
      } else {
        result = await createOperationalOption('service', formData.label.trim());
      }

      if (result.error) throw result.error;

      toast({ title: editingItem ? "Layanan diperbarui" : "Layanan ditambahkan" });
      fetchData();
      setIsServiceModalOpen(false);
    } catch (error) {
      toast({ variant: "destructive", title: "Gagal menyimpan", description: error.message });
    } finally {
      setIsProcessing(false);
    }
  };

  // --- Diagnosis Actions ---

  const handleOpenDiagnosisModal = (serviceId, diagnosis = null) => {
    setEditingItem(diagnosis);
    setTargetServiceId(serviceId);
    setFormData({ label: diagnosis ? diagnosis.label : '', parent_id: serviceId });
    setIsDiagnosisModalOpen(true);
  };

  const handleSaveDiagnosis = async () => {
    if (!formData.label.trim()) {
      toast({ variant: "destructive", title: "Nama diagnosa wajib diisi" });
      return;
    }

    setIsProcessing(true);
    try {
      let result;
      const extraData = { parent_id: targetServiceId };

      if (editingItem) {
        result = await updateOperationalOption(editingItem.id, formData.label.trim(), extraData);
      } else {
        result = await createOperationalOption('diagnosa', formData.label.trim(), extraData);
      }

      if (result.error) throw result.error;

      toast({ title: editingItem ? "Diagnosa diperbarui" : "Diagnosa ditambahkan" });
      fetchData(); // Refresh to ensure parent relationships are correct
      setIsDiagnosisModalOpen(false);
    } catch (error) {
      toast({ variant: "destructive", title: "Gagal menyimpan", description: error.message });
    } finally {
      setIsProcessing(false);
    }
  };

  // --- Bulk Paste Actions ---

  const handleOpenBulkPaste = (serviceId) => {
    setTargetServiceId(serviceId);
    setPasteContent("");
    setIsBulkPasteOpen(true);
  };

  const handleBulkPaste = async () => {
    if (!pasteContent.trim()) {
      toast({ variant: "destructive", title: "Konten kosong" });
      return;
    }

    setIsProcessing(true);
    try {
      const lines = pasteContent.split(/\r?\n/).map(l => l.trim()).filter(l => l);
      const uniqueLines = [...new Set(lines)];

      // Filter duplicates against existing diagnoses for THIS service
      const existingLabels = diagnoses
        .filter(d => d.parent_id === targetServiceId)
        .map(d => d.label.toLowerCase());
      
      const newItems = uniqueLines.filter(l => !existingLabels.includes(l.toLowerCase()));

      if (newItems.length === 0) {
        toast({ title: "Info", description: "Semua diagnosa sudah ada." });
        setIsBulkPasteOpen(false);
        setIsProcessing(false);
        return;
      }

      // Create promises for parallel insertion
      const promises = newItems.map(label => 
        createOperationalOption('diagnosa', label, { parent_id: targetServiceId })
      );

      await Promise.all(promises);
      
      toast({ title: "Berhasil", description: `${newItems.length} diagnosa berhasil ditambahkan.` });
      fetchData();
      setIsBulkPasteOpen(false);
    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "Gagal memproses", description: "Terjadi kesalahan saat menyimpan data." });
    } finally {
      setIsProcessing(false);
    }
  };

  // --- Delete Actions ---

  const handleOpenDelete = (item, type) => {
    setEditingItem({ ...item, type }); // type: 'service' or 'diagnosis'
    setIsDeleteOpen(true);
  };

  const handleDelete = async () => {
    if (!editingItem) return;

    setIsProcessing(true);
    try {
      const result = await deleteOperationalOption(editingItem.id);
      if (result.error) throw result.error;

      toast({ title: "Terhapus", description: "Item berhasil dihapus." });
      
      // Optimistic update
      if (editingItem.type === 'service') {
        setServices(prev => prev.filter(s => s.id !== editingItem.id));
        setDiagnoses(prev => prev.filter(d => d.parent_id !== editingItem.id)); // Cascade logic visual only
      } else {
        setDiagnoses(prev => prev.filter(d => d.id !== editingItem.id));
      }
      setIsDeleteOpen(false);
      // Ideally refetch to ensure server state matches (especially for cascade deletes if DB configured)
      fetchData();
    } catch (error) {
      toast({ variant: "destructive", title: "Gagal menghapus", description: error.message });
    } finally {
      setIsProcessing(false);
    }
  };

  // --- Rendering Helpers ---

  const filteredServices = services.filter(service => 
    service.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    diagnoses.some(d => d.parent_id === service.id && d.label.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mt-6">
      <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <FolderTree className="w-5 h-5 text-blue-600" />
            Manajemen Layanan & Diagnosa
          </h2>
          <p className="text-sm text-slate-500">Atur struktur layanan klinik dan diagnosa terkait.</p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              placeholder="Cari layanan atau diagnosa..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-white"
            />
          </div>
          <Button onClick={() => handleOpenServiceModal()} className="bg-blue-600 hover:bg-blue-700 whitespace-nowrap">
            <Plus className="w-4 h-4 mr-2" />
            Layanan Baru
          </Button>
        </div>
      </div>

      <div className="p-6 bg-slate-50/30 min-h-[500px]">
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
          </div>
        ) : filteredServices.length === 0 ? (
          <div className="text-center py-20 text-slate-400 border-2 border-dashed border-slate-200 rounded-xl bg-white">
            <p>Belum ada layanan yang ditemukan.</p>
            <Button variant="link" onClick={() => handleOpenServiceModal()} className="text-blue-600 mt-2">
              Tambah layanan pertama
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredServices.map(service => {
              const serviceDiagnoses = diagnoses.filter(d => d.parent_id === service.id);
              const isExpanded = expandedServices[service.id];
              const matchesSearch = searchQuery && serviceDiagnoses.some(d => d.label.toLowerCase().includes(searchQuery.toLowerCase()));
              
              // Auto expand if searching and matches found inside
              if (searchQuery && matchesSearch && !isExpanded) {
                // This is a render-side effect, safer to handle via state but for simple UI this works or user expands manually
              }

              return (
                <motion.div 
                  key={service.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm"
                >
                  <div className="flex items-center justify-between p-4 bg-white border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <div 
                      className="flex items-center gap-3 flex-1 cursor-pointer select-none"
                      onClick={() => toggleService(service.id)}
                    >
                      <div className={`p-1 rounded-md transition-transform duration-200 ${isExpanded ? 'rotate-90 bg-slate-100' : ''}`}>
                        <ChevronRight className="w-5 h-5 text-slate-400" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-800">{service.label}</h3>
                        <p className="text-xs text-slate-500 flex items-center gap-1">
                          <FileText className="w-3 h-3" />
                          {serviceDiagnoses.length} Diagnosa Terdaftar
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                       <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                               <span className="sr-only">Open menu</span>
                               <Edit2 className="h-4 w-4 text-slate-500" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                             <DropdownMenuItem onClick={() => handleOpenServiceModal(service)}>
                                <Edit2 className="mr-2 h-4 w-4" /> Edit Layanan
                             </DropdownMenuItem>
                             <DropdownMenuItem onClick={() => handleOpenBulkPaste(service.id)}>
                                <ClipboardPaste className="mr-2 h-4 w-4" /> Paste Diagnosa
                             </DropdownMenuItem>
                             <DropdownMenuItem 
                                className="text-red-600 focus:text-red-600 focus:bg-red-50"
                                onClick={() => handleOpenDelete(service, 'service')}
                             >
                                <Trash2 className="mr-2 h-4 w-4" /> Hapus Layanan
                             </DropdownMenuItem>
                          </DropdownMenuContent>
                       </DropdownMenu>
                       <Button size="sm" variant="outline" onClick={() => handleOpenDiagnosisModal(service.id)} className="hidden sm:flex ml-2">
                         <Plus className="w-3 h-3 mr-1" /> Diagnosa
                       </Button>
                    </div>
                  </div>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                         <div className="p-4 bg-slate-50/50">
                            {serviceDiagnoses.length === 0 ? (
                               <div className="text-center py-6 text-sm text-slate-400 italic">
                                  Belum ada diagnosa untuk layanan ini.
                                  <div className="mt-2 flex justify-center gap-2">
                                     <Button size="sm" variant="outline" onClick={() => handleOpenDiagnosisModal(service.id)}>
                                       <Plus className="w-3 h-3 mr-1" /> Tambah Manual
                                     </Button>
                                     <Button size="sm" variant="outline" onClick={() => handleOpenBulkPaste(service.id)}>
                                       <ClipboardPaste className="w-3 h-3 mr-1" /> Paste Banyak
                                     </Button>
                                  </div>
                               </div>
                            ) : (
                               <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                  {serviceDiagnoses.map(diagnosis => (
                                    <div key={diagnosis.id} className="group flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg hover:border-blue-300 hover:shadow-sm transition-all">
                                       <span className="text-sm text-slate-700 font-medium truncate pr-2" title={diagnosis.label}>
                                          {diagnosis.label}
                                       </span>
                                       <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                          <button 
                                            onClick={() => handleOpenDiagnosisModal(service.id, diagnosis)}
                                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                                          >
                                             <Edit2 className="w-3.5 h-3.5" />
                                          </button>
                                          <button 
                                            onClick={() => handleOpenDelete(diagnosis, 'diagnosis')}
                                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                          >
                                             <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                       </div>
                                    </div>
                                  ))}
                                  <button 
                                    onClick={() => handleOpenDiagnosisModal(service.id)}
                                    className="flex items-center justify-center p-3 border border-dashed border-slate-300 rounded-lg text-sm text-slate-500 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50 transition-all"
                                  >
                                     <Plus className="w-4 h-4 mr-2" /> Tambah Diagnosa
                                  </button>
                               </div>
                            )}
                         </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* --- Modals --- */}

      {/* Service Modal */}
      <Dialog open={isServiceModalOpen} onOpenChange={setIsServiceModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit Layanan' : 'Tambah Layanan Baru'}</DialogTitle>
            <DialogDescription>
              Buat kategori layanan baru untuk mengelompokkan diagnosa.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium text-slate-700 mb-2 block">Nama Layanan</label>
            <Input 
              value={formData.label}
              onChange={(e) => setFormData({...formData, label: e.target.value})}
              placeholder="Contoh: Fisioterapi Musculoskeletal"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsServiceModalOpen(false)}>Batal</Button>
            <Button onClick={handleSaveService} disabled={isProcessing} className="bg-blue-600">
              {isProcessing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diagnosis Modal */}
      <Dialog open={isDiagnosisModalOpen} onOpenChange={setIsDiagnosisModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit Diagnosa' : 'Tambah Diagnosa'}</DialogTitle>
            <DialogDescription>
              Tambahkan diagnosa spesifik untuk layanan ini.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium text-slate-700 mb-2 block">Nama Diagnosa</label>
            <Input 
              value={formData.label}
              onChange={(e) => setFormData({...formData, label: e.target.value})}
              placeholder="Contoh: Low Back Pain"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDiagnosisModalOpen(false)}>Batal</Button>
            <Button onClick={handleSaveDiagnosis} disabled={isProcessing} className="bg-blue-600">
              {isProcessing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Paste Modal */}
      <Dialog open={isBulkPasteOpen} onOpenChange={setIsBulkPasteOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Paste Banyak Diagnosa</DialogTitle>
            <DialogDescription>
              Masukkan daftar diagnosa (satu per baris). Duplikat akan diabaikan otomatis.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea 
              value={pasteContent}
              onChange={(e) => setPasteContent(e.target.value)}
              placeholder={`Frozen Shoulder\nTennis Elbow\nCarpal Tunnel Syndrome`}
              rows={10}
              className="font-mono text-sm"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBulkPasteOpen(false)}>Batal</Button>
            <Button onClick={handleBulkPaste} disabled={isProcessing} className="bg-blue-600">
              {isProcessing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Proses Paste
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              Konfirmasi Hapus
            </DialogTitle>
            <DialogDescription>
              Apakah Anda yakin ingin menghapus <strong>{editingItem?.label}</strong>?
              {editingItem?.type === 'service' && (
                <div className="mt-2 p-3 bg-red-50 text-red-700 rounded-md border border-red-200 text-xs font-medium">
                   Peringatan: Menghapus layanan ini juga akan menghapus semua diagnosa yang ada di dalamnya jika tidak dipindahkan.
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>Batal</Button>
            <Button onClick={handleDelete} disabled={isProcessing} className="bg-red-600 hover:bg-red-700">
              {isProcessing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Hapus Permanen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DiagnosisServiceManager;