import React, { useState } from 'react';
import { Stethoscope, Loader2, BookOpen, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { getSoapAssessmentAdvice } from '@/lib/api';

// Menampilkan tanda [Ref N] pada teks saran sebagai badge kecil, supaya
// terapis bisa langsung lihat saran mana yang berasal dari referensi mana.
const renderWithRefs = (text) => {
  if (!text) return null;
  const parts = text.split(/(\[Ref \d+\])/g);
  return parts.map((part, i) => {
    const match = part.match(/^\[Ref (\d+)\]$/);
    if (match) {
      return (
        <sup key={i} className="inline-flex items-center justify-center ml-0.5 px-1 text-[10px] font-semibold text-violet-700 bg-violet-100 rounded">
          {match[1]}
        </sup>
      );
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
};

// Kebalikan dari ClinicalAdviceAssistant: dipakai SEBELUM Assessment diisi,
// cukup modal Subjective + Objective, untuk bantu terapis merumuskan
// kemungkinan diagnosa dan pemeriksaan lanjutan — bukan menggantikan
// clinical judgement.
const AssessmentAdviceAssistant = ({ formData }) => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null); // { advice, references } | { no_reference_found } | { errorMessage }
  const [showRefs, setShowRefs] = useState(false);
  const { toast } = useToast();

  const handleRequestAdvice = async () => {
    if (!formData.subjective?.trim() && !formData.objective?.trim()) {
      toast({ variant: 'destructive', title: 'Isi Subjective/Objective Dulu', description: 'Saran assessment butuh minimal isian Subjective atau Objective.' });
      return;
    }
    setLoading(true);
    setResult(null);
    const { data, error } = await getSoapAssessmentAdvice({
      subjective: formData.subjective,
      objective: formData.objective,
    });
    setLoading(false);

    if (error) {
      setResult({ errorMessage: error.message || 'Gagal memuat saran assessment.' });
      return;
    }
    if (data?.no_reference_found) {
      setResult({ no_reference_found: true, message: data.message });
      return;
    }
    setResult({ advice: data.advice, references: data.references || [] });
  };

  return (
    <div className="px-6 py-5 bg-gradient-to-br from-violet-50/60 to-white border-t border-b border-violet-100">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Stethoscope className="w-4 h-4 text-violet-600" />
          <span className="text-sm font-semibold text-slate-800">Saran Assessment AI</span>
          <span className="text-xs text-slate-400">(bantu merumuskan diagnosa, bukan pengganti clinical judgement)</span>
        </div>
        <Button type="button" size="sm" variant="outline" className="border-violet-300 text-violet-700 hover:bg-violet-50" onClick={handleRequestAdvice} disabled={loading}>
          {loading ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Menganalisis...</> : <><Stethoscope className="w-3.5 h-3.5 mr-1.5" /> Minta Saran</>}
        </Button>
      </div>

      {result?.errorMessage && (
        <div className="mt-3 flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          {result.errorMessage}
        </div>
      )}

      {result?.no_reference_found && (
        <div className="mt-3 flex items-start gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          {result.message}
        </div>
      )}

      {result?.advice && (
        <div className="mt-3 space-y-3">
          <div className="bg-white border border-violet-100 rounded-xl p-4 space-y-3 text-sm text-slate-700">
            <div>
              <p className="font-semibold text-violet-800 mb-1">Kemungkinan Diagnosa</p>
              <p className="leading-relaxed">{renderWithRefs(result.advice.kemungkinan_diagnosa)}</p>
            </div>
            <div>
              <p className="font-semibold text-violet-800 mb-1">Pemeriksaan Spesifik Disarankan</p>
              <p className="leading-relaxed">{renderWithRefs(result.advice.pemeriksaan_spesifik_disarankan)}</p>
            </div>
            <div>
              <p className="font-semibold text-violet-800 mb-1">Yang Perlu Dievaluasi</p>
              <p className="leading-relaxed">{renderWithRefs(result.advice.yang_perlu_dievaluasi)}</p>
            </div>
            {result.advice.catatan && (
              <div className="text-xs text-slate-500 border-t pt-2">{result.advice.catatan}</div>
            )}
          </div>

          {result.references?.length > 0 && (
            <div className="text-xs">
              <button type="button" className="flex items-center gap-1 text-slate-500 hover:text-slate-700" onClick={() => setShowRefs(!showRefs)}>
                <BookOpen className="w-3.5 h-3.5" />
                {result.references.length} referensi dipakai
                {showRefs ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
              {showRefs && (
                <ul className="mt-2 space-y-1 pl-1">
                  {result.references.map((ref) => (
                    <li key={ref.ref_number} className="text-slate-500">
                      <span className="font-medium text-slate-700">[{ref.ref_number}]</span> {ref.title}
                      {ref.author ? ` — ${ref.author}` : ''}{ref.publication_year ? ` (${ref.publication_year})` : ''}
                      {ref.page_number ? `, hal. ${ref.page_number}` : ''}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AssessmentAdviceAssistant;
