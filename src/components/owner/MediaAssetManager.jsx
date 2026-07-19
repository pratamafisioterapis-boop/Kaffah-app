import React, { useState, useRef } from 'react';
import { Upload, X, Image as ImageIcon, CheckCircle2, Loader2, FileType } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { uploadMediaAssetToDrive } from '@/lib/api';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];

const MediaAssetManager = ({ onUploadSuccess }) => {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [category, setCategory] = useState('umum');
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const { toast } = useToast();

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const validateFile = (file) => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast({
        variant: "destructive",
        title: "Format Tidak Didukung",
        description: "Hanya file gambar (JPG, PNG, WEBP, SVG) yang diperbolehkan."
      });
      return false;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast({
        variant: "destructive",
        title: "File Terlalu Besar",
        description: "Maksimal ukuran file adalah 5MB."
      });
      return false;
    }
    return true;
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (validateFile(file)) {
        setSelectedFile(file);
        setPreview(URL.createObjectURL(file));
      }
    }
  };

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (validateFile(file)) {
        setSelectedFile(file);
        setPreview(URL.createObjectURL(file));
      }
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setPreview(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setLoading(true);
    const { success, error } = await uploadMediaAssetToDrive(selectedFile, category);
    setLoading(false);

    if (success) {
      toast({
        title: "Upload Berhasil",
        description: "File telah berhasil diunggah ke Google Drive klinik."
      });
      handleRemoveFile();
      if (onUploadSuccess) onUploadSuccess();
    } else {
      toast({
        variant: "destructive",
        title: "Upload Gagal",
        description: error?.message || "Terjadi kesalahan saat mengunggah file."
      });
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-slate-900 mb-1">Upload Media Baru</h3>
        <p className="text-sm text-slate-500">Unggah gambar untuk logo klinik, header, footer, atau kebutuhan lainnya. File disimpan ke Google Drive klinik.</p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Kategori Gambar</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-full md:w-[280px]">
              <SelectValue placeholder="Pilih kategori" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="umum">Umum</SelectItem>
              <SelectItem value="logo">Logo & Identitas</SelectItem>
              <SelectItem value="header">Header Website</SelectItem>
              <SelectItem value="footer">Footer Website</SelectItem>
              <SelectItem value="invoice_template">Template Invoice</SelectItem>
              <SelectItem value="promo">Banner Promo</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div
          className={cn(
            "relative border-2 border-dashed rounded-xl p-8 transition-all duration-200 ease-in-out text-center cursor-pointer",
            dragActive ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:border-blue-400 hover:bg-slate-50",
            selectedFile ? "border-solid bg-slate-50 border-slate-300" : ""
          )}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => !selectedFile && inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            accept="image/*"
            onChange={handleChange}
            disabled={loading}
          />

          {selectedFile ? (
            <div className="flex flex-col items-center animate-in fade-in zoom-in duration-300">
              <div className="relative w-full max-w-md h-48 bg-slate-200 rounded-lg overflow-hidden mb-4 border border-slate-200 shadow-sm">
                <img src={preview} alt="Preview" className="w-full h-full object-contain" />
                <button
                  onClick={(e) => { e.stopPropagation(); handleRemoveFile(); }}
                  className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-red-500 text-white rounded-full transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-700 font-medium">
                <FileType className="w-4 h-4 text-blue-600" />
                {selectedFile.name}
                <span className="text-slate-400 font-normal">
                  ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                </span>
              </div>
              
              <div className="mt-6 flex gap-3 w-full max-w-xs">
                <Button 
                  onClick={(e) => { e.stopPropagation(); handleUpload(); }} 
                  disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Mengunggah...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Upload Sekarang
                    </>
                  )}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={(e) => { e.stopPropagation(); handleRemoveFile(); }}
                  disabled={loading}
                  className="w-full border-slate-200 text-slate-700 hover:bg-slate-100"
                >
                  Batal
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-4">
                <ImageIcon className="w-8 h-8" />
              </div>
              <h4 className="text-base font-semibold text-slate-900 mb-1">
                Drag & Drop gambar disini
              </h4>
              <p className="text-sm text-slate-500 mb-6 max-w-xs mx-auto">
                atau klik area ini untuk memilih file dari komputer Anda. (Max 5MB)
              </p>
              <Button variant="outline" className="text-blue-600 border-blue-200 hover:bg-blue-50">
                Pilih File
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MediaAssetManager;