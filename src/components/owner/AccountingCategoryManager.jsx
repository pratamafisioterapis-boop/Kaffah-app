import React, { useState, useEffect } from 'react';
import {
  Plus, Edit2, Trash2, Loader2, ChevronRight, ChevronDown, Folder, GitMerge
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from "@/components/ui/dialog";
import SearchableSelect from '@/components/ui/searchable-select';
import {
  getAccountingCategories, createAccountingCategory, updateAccountingCategory, deleteAccountingCategory,
  getAccountingSubcategories, createAccountingSubcategory, updateAccountingSubcategory, deleteAccountingSubcategory,
  mergeAccountingSubcategory
} from '@/lib/api';

const AccountingCategoryManager = () => {
  const { toast } = useToast();
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedCategories, setExpandedCategories] = useState({});

  // Dialog States
  const [isCatDialogOpen, setIsCatDialogOpen] = useState(false);
  const [isSubCatDialogOpen, setIsSubCatDialogOpen] = useState(false);
  const [isDeleteCatOpen, setIsDeleteCatOpen] = useState(false);
  const [isDeleteSubCatOpen, setIsDeleteSubCatOpen] = useState(false);
  const [isMergeSubCatOpen, setIsMergeSubCatOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Selection/Form Data
  const [selectedCat, setSelectedCat] = useState(null);
  const [selectedSubCat, setSelectedSubCat] = useState(null);
  const [catForm, setCatForm] = useState({ name: '', type: 'expense' });
  const [subCatForm, setSubCatForm] = useState({ categoryId: '', name: '' });
  const [mergeTargetId, setMergeTargetId] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [catRes, subRes] = await Promise.all([
      getAccountingCategories(),
      getAccountingSubcategories()
    ]);

    if (catRes.data) setCategories(catRes.data);
    if (subRes.data) setSubcategories(subRes.data);
    setLoading(false);
  };

  const toggleExpand = (catId) => {
    setExpandedCategories(prev => ({ ...prev, [catId]: !prev[catId] }));
  };

  // --- Category Handlers ---
  const handleOpenAddCat = (type = 'expense') => {
    setSelectedCat(null);
    setCatForm({ name: '', type });
    setIsCatDialogOpen(true);
  };

  const handleOpenEditCat = (cat) => {
    setSelectedCat(cat);
    setCatForm({ name: cat.category_name, type: cat.type || 'expense' });
    setIsCatDialogOpen(true);
  };

  const handleSaveCat = async () => {
    if (!catForm.name.trim()) return toast({ variant: "destructive", title: "Validasi Gagal", description: "Nama kategori harus diisi." });

    setIsProcessing(true);
    let result;
    if (selectedCat) {
       result = await updateAccountingCategory(selectedCat.id, catForm.name, catForm.type);
    } else {
       result = await createAccountingCategory(catForm.name, catForm.type);
    }

    if (!result.error) {
      toast({ title: "Berhasil", description: selectedCat ? "Kategori diperbarui." : "Kategori ditambahkan." });
      fetchData();
      setIsCatDialogOpen(false);
    } else {
      toast({ variant: "destructive", title: "Gagal", description: result.error.message });
    }
    setIsProcessing(false);
  };

  const handleDeleteCat = async () => {
    setIsProcessing(true);
    const result = await deleteAccountingCategory(selectedCat.id);
    if (!result.error) {
      toast({ title: "Terhapus", description: "Kategori dan sub-kategori terkait telah dihapus." });
      fetchData();
      setIsDeleteCatOpen(false);
    } else {
      toast({ variant: "destructive", title: "Gagal", description: result.error.message });
    }
    setIsProcessing(false);
  };

  // --- Subcategory Handlers ---
  const handleOpenAddSubCat = (catId) => {
    setSelectedSubCat(null);
    setSubCatForm({ categoryId: catId, name: '' });
    setIsSubCatDialogOpen(true);
  };

  const handleOpenEditSubCat = (sub) => {
    setSelectedSubCat(sub);
    setSubCatForm({ categoryId: sub.category_id, name: sub.subcategory_name });
    setIsSubCatDialogOpen(true);
  };

  const handleSaveSubCat = async () => {
    if (!subCatForm.name.trim()) return toast({ variant: "destructive", title: "Validasi Gagal", description: "Nama sub-kategori harus diisi." });

    setIsProcessing(true);
    let result;
    if (selectedSubCat) {
      result = await updateAccountingSubcategory(selectedSubCat.id, subCatForm.name);
    } else {
      result = await createAccountingSubcategory(subCatForm.name, subCatForm.categoryId);
    }

    if (!result.error) {
      toast({ title: "Berhasil", description: selectedSubCat ? "Sub-kategori diperbarui." : "Sub-kategori ditambahkan." });
      fetchData();
      setIsSubCatDialogOpen(false);
      // Auto expand parent
      if (!selectedSubCat) {
        setExpandedCategories(prev => ({ ...prev, [subCatForm.categoryId]: true }));
      }
    } else {
      toast({ variant: "destructive", title: "Gagal", description: result.error.message });
    }
    setIsProcessing(false);
  };

  const handleDeleteSubCat = async () => {
    setIsProcessing(true);
    const result = await deleteAccountingSubcategory(selectedSubCat.id);
    if (!result.error) {
      toast({ title: "Terhapus", description: "Sub-kategori telah dihapus." });
      fetchData();
      setIsDeleteSubCatOpen(false);
    } else {
      toast({ variant: "destructive", title: "Gagal", description: result.error.message });
    }
    setIsProcessing(false);
  };

  const handleOpenMergeSubCat = (sub) => {
    setSelectedSubCat(sub);
    setMergeTargetId('');
    setIsMergeSubCatOpen(true);
  };

  const handleMergeSubCat = async () => {
    if (!mergeTargetId) return toast({ variant: "destructive", title: "Validasi Gagal", description: "Pilih sub-kategori tujuan." });

    setIsProcessing(true);
    const result = await mergeAccountingSubcategory(selectedSubCat.id, mergeTargetId);
    if (!result.error) {
      const { owner_expenditures_updated = 0, admin_expenses_updated = 0, inventory_items_updated = 0 } = result.data || {};
      toast({
        title: "Berhasil digabungkan",
        description: `${selectedSubCat.subcategory_name} dipindahkan (${owner_expenditures_updated + admin_expenses_updated} transaksi, ${inventory_items_updated} barang) dan dihapus.`
      });
      fetchData();
      setIsMergeSubCatOpen(false);
    } else {
      toast({ variant: "destructive", title: "Gagal menggabungkan", description: result.error.message });
    }
    setIsProcessing(false);
  };

  const subcategoryOptions = subcategories
    .filter(sub => !selectedSubCat || sub.id !== selectedSubCat.id)
    .map(sub => ({
      label: sub.subcategory_name,
      value: sub.id,
      description: `Kategori: ${sub.parent_category?.category_name || 'N/A'}`
    }));

  const renderCategoryList = (list) => (
    <div className="space-y-3">
      {list.map(cat => {
        const catSubs = subcategories.filter(sub => sub.category_id === cat.id);
        const isExpanded = expandedCategories[cat.id];

        return (
          <div key={cat.id} className="border border-slate-200 rounded-lg overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 bg-slate-50 hover:bg-slate-100 transition-colors">
              <div className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer" onClick={() => toggleExpand(cat.id)}>
                {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />}
                <span className="font-medium text-slate-700 truncate">{cat.category_name}</span>
                <span className="text-xs bg-slate-200 text-slate-500 px-2 py-0.5 rounded-full shrink-0">{catSubs.length} Sub</span>
              </div>
              <div className="flex items-center gap-2 shrink-0 pl-7 sm:pl-0">
                <Button variant="ghost" size="sm" onClick={() => handleOpenAddSubCat(cat.id)} className="h-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50">
                  <Plus className="w-3 h-3 mr-1" /> Sub
                </Button>
                <Button variant="ghost" size="icon" onClick={() => handleOpenEditCat(cat)} className="h-8 w-8 text-slate-500">
                  <Edit2 className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => { setSelectedCat(cat); setIsDeleteCatOpen(true); }} className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {isExpanded && (
              <div className="bg-white p-2 space-y-1 border-t border-slate-100">
                {catSubs.length === 0 ? (
                  <p className="text-xs text-slate-400 pl-9 py-2 italic">Belum ada sub-kategori.</p>
                ) : (
                  catSubs.map(sub => (
                    <div key={sub.id} className="flex items-center justify-between gap-2 pl-9 pr-2 py-2 rounded hover:bg-slate-50 group">
                      <div className="flex items-center gap-2 min-w-0">
                        <Folder className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                        <span className="text-sm text-slate-600 truncate">{sub.subcategory_name}</span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" onClick={() => handleOpenMergeSubCat(sub)} className="h-6 w-6 text-slate-400 hover:text-purple-600" title="Pindahkan ke sub-kategori lain">
                          <GitMerge className="w-3 h-3" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleOpenEditSubCat(sub)} className="h-6 w-6 text-slate-400 hover:text-blue-600">
                          <Edit2 className="w-3 h-3" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => { setSelectedSubCat(sub); setIsDeleteSubCatOpen(true); }} className="h-6 w-6 text-slate-400 hover:text-red-600">
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  const incomeCats = categories.filter(cat => cat.type === 'income');
  const expenseCats = categories.filter(cat => cat.type !== 'income');

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mt-6">
      <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Manajemen Kategori Akuntansi</h2>
          <p className="text-sm text-slate-500">Atur kategori pemasukan dan pengeluaran.</p>
        </div>
        <Button onClick={() => handleOpenAddCat('expense')} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-2" /> Kategori Baru
        </Button>
      </div>

      <div className="p-6">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin text-slate-300" /></div>
        ) : categories.length === 0 ? (
          <div className="text-center py-12 text-slate-400">Belum ada kategori.</div>
        ) : (
          <div className="space-y-8">
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-emerald-700 uppercase tracking-wide">Kategori Pemasukan</h3>
                <Button variant="outline" size="sm" onClick={() => handleOpenAddCat('income')} className="h-7 text-xs text-emerald-700 border-emerald-200 hover:bg-emerald-50">
                  <Plus className="w-3 h-3 mr-1" /> Tambah
                </Button>
              </div>
              {incomeCats.length === 0 ? (
                <p className="text-sm text-slate-400 italic">Belum ada kategori pemasukan.</p>
              ) : renderCategoryList(incomeCats)}
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-red-700 uppercase tracking-wide">Kategori Pengeluaran</h3>
                <Button variant="outline" size="sm" onClick={() => handleOpenAddCat('expense')} className="h-7 text-xs text-red-700 border-red-200 hover:bg-red-50">
                  <Plus className="w-3 h-3 mr-1" /> Tambah
                </Button>
              </div>
              {expenseCats.length === 0 ? (
                <p className="text-sm text-slate-400 italic">Belum ada kategori pengeluaran.</p>
              ) : renderCategoryList(expenseCats)}
            </div>
          </div>
        )}
      </div>

      {/* --- DIALOGS --- */}

      {/* Category Dialog */}
      <Dialog open={isCatDialogOpen} onOpenChange={setIsCatDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader><DialogTitle>{selectedCat ? 'Edit Kategori' : 'Tambah Kategori'}</DialogTitle></DialogHeader>
          <div className="py-4 space-y-4">
             <div>
               <label className="text-sm font-medium mb-2 block">Nama Kategori</label>
               <Input value={catForm.name} onChange={(e) => setCatForm({...catForm, name: e.target.value})} placeholder="Contoh: Operasional" />
             </div>
             <div>
               <label className="text-sm font-medium mb-2 block">Jenis Kategori</label>
               <div className="flex gap-2">
                 <button
                   type="button"
                   onClick={() => setCatForm({...catForm, type: 'income'})}
                   className={`flex-1 h-9 rounded-md text-sm font-medium border transition-colors ${catForm.type === 'income' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                 >
                   Pemasukan
                 </button>
                 <button
                   type="button"
                   onClick={() => setCatForm({...catForm, type: 'expense'})}
                   className={`flex-1 h-9 rounded-md text-sm font-medium border transition-colors ${catForm.type === 'expense' ? 'bg-red-600 text-white border-red-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                 >
                   Pengeluaran
                 </button>
               </div>
             </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCatDialogOpen(false)}>Batal</Button>
            <Button onClick={handleSaveCat} disabled={isProcessing}>{isProcessing && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Subcategory Dialog */}
      <Dialog open={isSubCatDialogOpen} onOpenChange={setIsSubCatDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader><DialogTitle>{selectedSubCat ? 'Edit Sub-Kategori' : 'Tambah Sub-Kategori'}</DialogTitle></DialogHeader>
          <div className="py-4">
             <label className="text-sm font-medium mb-2 block">Nama Sub-Kategori</label>
             <Input value={subCatForm.name} onChange={(e) => setSubCatForm({...subCatForm, name: e.target.value})} placeholder="Contoh: Listrik" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSubCatDialogOpen(false)}>Batal</Button>
            <Button onClick={handleSaveSubCat} disabled={isProcessing}>{isProcessing && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Category Confirmation */}
      <Dialog open={isDeleteCatOpen} onOpenChange={setIsDeleteCatOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Hapus Kategori?</DialogTitle>
            <DialogDescription>
              Tindakan ini juga akan menghapus semua sub-kategori di dalamnya. Data keuangan yang sudah tersimpan tidak akan hilang, tapi referensi kategorinya mungkin terputus.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteCatOpen(false)}>Batal</Button>
            <Button variant="destructive" onClick={handleDeleteCat} disabled={isProcessing}>{isProcessing && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Hapus</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Subcategory Confirmation */}
      <Dialog open={isDeleteSubCatOpen} onOpenChange={setIsDeleteSubCatOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Hapus Sub-Kategori?</DialogTitle>
            <DialogDescription>Anda yakin ingin menghapus sub-kategori ini?</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteSubCatOpen(false)}>Batal</Button>
            <Button variant="destructive" onClick={handleDeleteSubCat} disabled={isProcessing}>{isProcessing && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Hapus</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Merge Subcategory Dialog */}
      <Dialog open={isMergeSubCatOpen} onOpenChange={setIsMergeSubCatOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Pindahkan Sub-Kategori</DialogTitle>
            <DialogDescription>
              Semua transaksi dan barang yang memakai <span className="font-semibold">{selectedSubCat?.subcategory_name}</span> akan dipindahkan ke sub-kategori tujuan, lalu <span className="font-semibold">{selectedSubCat?.subcategory_name}</span> akan otomatis terhapus.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <label className="text-sm font-medium mb-2 block">Pindahkan ke Sub-Kategori</label>
            <SearchableSelect
              options={subcategoryOptions}
              value={mergeTargetId}
              onChange={setMergeTargetId}
              placeholder="Pilih sub-kategori tujuan..."
              allowCreate={false}
              notFoundText="Sub-kategori tidak ditemukan."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsMergeSubCatOpen(false)}>Batal</Button>
            <Button onClick={handleMergeSubCat} disabled={isProcessing} className="bg-purple-600 hover:bg-purple-700">
              {isProcessing && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Pindahkan & Hapus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AccountingCategoryManager;