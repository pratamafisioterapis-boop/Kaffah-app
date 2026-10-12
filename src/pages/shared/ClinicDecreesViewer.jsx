import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Loader2, Eye, Download, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import PdfPreviewModal from '@/components/shared/PdfPreviewModal';
import { KAFFAH_CLINIC_ID } from '@/lib/clinicIds';
import { getClinicDecrees, getCurrentClinic } from '@/lib/api';
import { generateDecreePDF, decreeFileName } from '@/lib/decreeGenerator';
import { markDecreesSeen } from '@/lib/decreeSeen';
import { downloadPdfDoc } from '@/lib/pdfDownload';

const fmtDate = (d) => {
  try { return format(new Date(d), 'd MMMM yyyy', { locale: idLocale }); } catch { return '-'; }
};

// Daftar SK Pimpinan yang sudah diterbitkan, untuk terapis/admin klinik.
const ClinicDecreesViewer = () => {
  const { user, userDetails } = useAuth();
  const { toast } = useToast();
  const [decrees, setDecrees] = useState([]);
  const [clinic, setClinic] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewDoc, setPreviewDoc] = useState(null);

  const allowed = userDetails?.clinic_id === KAFFAH_CLINIC_ID;

  useEffect(() => {
    if (!allowed) { setLoading(false); return; }
    (async () => {
      const [{ data: c }, { data, error }] = await Promise.all([getCurrentClinic(), getClinicDecrees()]);
      if (error) toast({ variant: 'destructive', title: 'Gagal memuat SK', description: error.message });
      const issued = (data || []).filter((d) => d.status === 'issued');
      setClinic(c || null);
      setDecrees(issued);
      markDecreesSeen(user?.id, issued.map((d) => d.id));
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowed]);

  if (!allowed) return <p className="text-sm text-app-muted">Fitur ini hanya tersedia untuk klinik Kaffah.</p>;

  const buildPdf = async (decree) => {
    const { data: signatureUrl } = await supabase.rpc('get_decree_signer_signature', { p_decree_id: decree.id });
    return generateDecreePDF({ ...decree, signature_url: signatureUrl || null }, clinic || {});
  };

  const run = async (decree, mode) => {
    setBusyId(decree.id);
    try {
      const doc = await buildPdf(decree);
      const name = decreeFileName(decree);
      if (mode === 'preview') {
        setPreviewDoc({ doc, name });
        setPreviewUrl(URL.createObjectURL(doc.output('blob')));
      } else {
        downloadPdfDoc(doc, name);
      }
    } catch (e) {
      toast({ variant: 'destructive', title: 'Gagal membuat PDF', description: e.message });
    }
    setBusyId(null);
  };

  return (
    <>
      <Helmet><title>SK Pimpinan - Kaffah System Care</title></Helmet>
      <div className="space-y-5">
        <div>
          <h1 className="text-xl font-bold text-app-ink">SK Pimpinan</h1>
          <p className="text-sm text-app-muted">Surat Keputusan resmi klinik yang berlaku untuk seluruh tim.</p>
        </div>
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin w-6 h-6 text-app-accent" /></div>
        ) : decrees.length === 0 ? (
          <p className="text-sm text-app-muted">Belum ada SK yang diterbitkan.</p>
        ) : (
          <div className="space-y-3">
            {decrees.map((d) => (
              <div key={d.id} className="bg-white border border-app-border rounded-app p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <FileText className="w-5 h-5 mt-0.5 shrink-0 text-app-accent" />
                  <div className="min-w-0">
                    <p className="font-semibold text-app-ink break-words">{d.decree_number}</p>
                    <p className="text-sm text-app-ink break-words">{d.title}</p>
                    <p className="text-xs text-app-muted mt-1">Ditetapkan {fmtDate(d.decree_date)}, {d.letter_city}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => run(d, 'preview')} disabled={busyId === d.id}>
                    {busyId === d.id ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Eye className="w-4 h-4 mr-1" />} Buka SK
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => run(d, 'download')} disabled={busyId === d.id}>
                    <Download className="w-4 h-4 mr-1" /> Unduh PDF
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <PdfPreviewModal
        open={!!previewUrl}
        onClose={() => { setPreviewUrl(null); setPreviewDoc(null); }}
        url={previewUrl}
        title="SK Pimpinan"
        footer={previewDoc && (
          <Button className="w-full" onClick={() => downloadPdfDoc(previewDoc.doc, previewDoc.name)}>
            <Download className="w-4 h-4 mr-1" /> Unduh PDF
          </Button>
        )}
      />
    </>
  );
};

export default ClinicDecreesViewer;
