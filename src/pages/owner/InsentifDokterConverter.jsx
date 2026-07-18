import React, { useState, useRef } from 'react';
import { Upload, FileSpreadsheet, Loader2, CheckCircle2, AlertTriangle, Trash2, FileText } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { parseInsentifDokterPdf, generateInsentifDokterExcel } from '@/utils/insentifDokterParser';

const InsentifDokterConverter = () => {
  const { toast } = useToast();
  const fileInputRef = useRef(null);
  const isPWA =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true ||
    document.referrer.includes('android-app://');

  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState([]); // array of { format, fileName, rows, summary, verification }
  const [periodeLabel, setPeriodeLabel] = useState('');

  const handleFiles = async (fileList) => {
    const files = Array.from(fileList).filter((f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
    if (!files.length) {
      toast({ variant: 'destructive', title: 'File tidak valid', description: 'Hanya file PDF yang didukung.' });
      return;
    }

    setProcessing(true);
    const newResults = [];
    for (const file of files) {
      try {
        const res = await parseInsentifDokterPdf(file);
        newResults.push(res);
      } catch (err) {
        toast({
          variant: 'destructive',
          title: `Gagal memproses ${file.name}`,
          description: err.message || 'Terjadi kesalahan saat membaca PDF.',
        });
      }
    }
    setResults((prev) => [...prev, ...newResults]);
    setProcessing(false);

    newResults.forEach((res) => {
      if (!res.verification.isVerified && !res.verification.isMinorRounding) {
        toast({
          variant: 'destructive',
          title: `⚠️ Total tidak cocok: ${res.fileName}`,
          description: `Selisih Rp ${new Intl.NumberFormat('id-ID').format(Math.abs(res.verification.selisih))}. Mohon periksa manual sebelum digunakan.`,
        });
      } else if (res.verification.isMinorRounding) {
        toast({
          title: `ℹ️ Selisih pembulatan kecil: ${res.fileName}`,
          description: `Selisih Rp ${new Intl.NumberFormat('id-ID').format(Math.abs(res.verification.selisih))} — ini pembulatan internal dari PDF sumber (bukan kesalahan ekstraksi), data baris tetap akurat.`,
        });
      }
    });

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemove = (idx) => {
    setResults((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleExport = () => {
    if (!results.length) return;
    try {
      const fileName = generateInsentifDokterExcel(results, periodeLabel);
      toast({ title: 'Excel berhasil dibuat', description: fileName });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Gagal membuat Excel', description: err.message });
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Hero Banner — desktop & PWA */}
      <div className="w-full rounded-2xl overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 shadow-xl border border-slate-700/50 relative">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle, #6366f1 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        <div className={`relative flex items-center gap-4 ${isPWA ? 'px-4 py-4' : 'px-5 py-5 sm:px-7 sm:py-6'}`}>
          <div className={`flex-shrink-0 ${isPWA ? 'w-10 h-10' : 'w-12 h-12'} rounded-xl bg-indigo-600/80 flex items-center justify-center shadow-lg`}>
            <FileSpreadsheet className={`${isPWA ? 'w-5 h-5' : 'w-6 h-6'} text-white`} />
          </div>
          <div>
            <p className={`${isPWA ? 'text-[10px]' : 'text-xs'} font-bold tracking-widest text-indigo-300 uppercase mb-1`}>{useAuth().clinicName || ''}</p>
            <h2 className={`${isPWA ? 'text-base' : 'text-lg sm:text-xl'} font-bold text-white leading-tight`}>Konversi PDF Insentif Dokter ke Excel</h2>
            <p className={`${isPWA ? 'text-xs' : 'text-sm'} text-slate-400 mt-0.5`}>
              Upload PDF "Perincian Insentif Dokter" (PWTT/PWT atau BPJS Individu) untuk dikonversi ke Excel
            </p>
          </div>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
            <label className="text-sm font-medium text-slate-600 whitespace-nowrap">
              Label Periode (opsional):
            </label>
            <input
              type="text"
              value={periodeLabel}
              onChange={(e) => setPeriodeLabel(e.target.value)}
              placeholder="contoh: April 2026"
              className="h-9 px-3 rounded-md border border-input bg-white text-sm outline-none flex-1 max-w-xs"
            />
          </div>

          <div
            className="border-2 border-dashed border-slate-300 rounded-xl p-10 flex flex-col items-center justify-center text-center bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
            }}
          >
            {processing ? (
              <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mb-3" />
            ) : (
              <Upload className="w-10 h-10 text-slate-400 mb-3" />
            )}
            <h3 className="font-semibold text-slate-700">
              {processing ? 'Memproses PDF...' : 'Klik atau drag & drop PDF di sini'}
            </h3>
            <p className="text-slate-500 text-sm mt-1">
              Bisa upload banyak file sekaligus, boleh campur kedua format (PWTT/PWT & BPJS Individu)
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              multiple
              className="hidden"
              onChange={(e) => e.target.files?.length && handleFiles(e.target.files)}
              disabled={processing}
            />
          </div>
        </CardContent>
      </Card>

      {results.length > 0 && (
        <div className="space-y-4">
          {results.map((res, idx) => (
            <Card
              key={idx}
              className={
                res.verification.isVerified ? 'border-green-200' :
                res.verification.isMinorRounding ? 'border-amber-300' : 'border-red-300'
              }
            >
              <CardContent className="pt-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <FileText className="w-5 h-5 text-slate-400 mt-0.5" />
                    <div>
                      <p className="font-medium text-slate-800">{res.fileName}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Format: {res.format === 'A' ? 'PWTT/PWT (Pasien Jaminan)' : 'BPJS Individu'}
                        {' '}&middot; {res.rows.length} baris data
                      </p>
                      <div className="flex items-center gap-1.5 mt-2 text-sm">
                        {res.verification.isVerified ? (
                          <>
                            <CheckCircle2 className="w-4 h-4 text-green-600" />
                            <span className="text-green-700 font-medium">
                              Total cocok dengan PDF (Rp {new Intl.NumberFormat('id-ID').format(res.verification.printedTotal)})
                            </span>
                          </>
                        ) : res.verification.isMinorRounding ? (
                          <>
                            <AlertTriangle className="w-4 h-4 text-amber-600" />
                            <span className="text-amber-700 font-medium">
                              Selisih pembulatan kecil Rp {new Intl.NumberFormat('id-ID').format(Math.abs(res.verification.selisih))}
                              {' '}(dari PDF sumber, bukan kesalahan ekstraksi — data baris tetap akurat).
                            </span>
                          </>
                        ) : (
                          <>
                            <AlertTriangle className="w-4 h-4 text-red-600" />
                            <span className="text-red-700 font-medium">
                              Total tidak cocok — selisih Rp {new Intl.NumberFormat('id-ID').format(Math.abs(res.verification.selisih))}.
                              Mohon periksa manual.
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => handleRemove(idx)} className="text-red-500 hover:text-red-700 hover:bg-red-50">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}

          <div className="flex justify-end">
            <Button onClick={handleExport} className="bg-green-600 hover:bg-green-700 text-white gap-2">
              <FileSpreadsheet className="w-4 h-4" />
              Download Excel ({results.length} file)
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default InsentifDokterConverter;
