import React, { useEffect, useState } from 'react';
import { getAllPhysiotherapists } from '@/lib/api';
import { getTherapistMonthlyReportData, getDefaultReportPeriod } from '@/lib/therapistMonthlyReportData';
import { generateTherapistMonthlyReportPDF, therapistMonthlyReportFileName } from '@/lib/therapistMonthlyReportPdf';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { FileBarChart2, Loader2, Download } from 'lucide-react';

const TherapistMonthlyReportManager = () => {
  const { toast } = useToast();
  const [therapists, setTherapists] = useState([]);
  const [loadingTherapists, setLoadingTherapists] = useState(true);
  const [therapistId, setTherapistId] = useState('');
  const [period, setPeriod] = useState(getDefaultReportPeriod());
  const [notes, setNotes] = useState('');
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    (async () => {
      setLoadingTherapists(true);
      const { data } = await getAllPhysiotherapists();
      setTherapists(data || []);
      setLoadingTherapists(false);
    })();
  }, []);

  const handleGenerate = async () => {
    if (!therapistId) {
      toast({ variant: 'destructive', title: 'Pilih Terapis', description: 'Silakan pilih terapis terlebih dahulu.' });
      return;
    }
    if (!period.startDate || !period.endDate) {
      toast({ variant: 'destructive', title: 'Periode Belum Lengkap', description: 'Isi tanggal mulai dan akhir periode.' });
      return;
    }
    setGenerating(true);
    try {
      const data = await getTherapistMonthlyReportData({
        therapistId,
        periodStart: period.startDate,
        periodEnd: period.endDate,
      });
      const doc = generateTherapistMonthlyReportPDF(data, notes);
      doc.save(therapistMonthlyReportFileName(data));
      toast({ title: 'Laporan Berhasil Dibuat', description: 'PDF laporan evaluasi bulanan telah diunduh.' });
    } catch (err) {
      console.error('generate therapist monthly report error:', err);
      toast({ variant: 'destructive', title: 'Gagal Membuat Laporan', description: err.message || 'Terjadi kesalahan.' });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileBarChart2 className="w-5 h-5 text-indigo-600" />
          Laporan Evaluasi Bulanan Terapis
        </CardTitle>
        <CardDescription>
          Buat PDF laporan kinerja &amp; evaluasi bulanan per terapis: kunjungan, diagnosa, target, kepatuhan SOAP, KPI, dan catatan pengembangan.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid sm:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Terapis</Label>
            <Select value={therapistId} onValueChange={setTherapistId} disabled={loadingTherapists}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih Terapis" />
              </SelectTrigger>
              <SelectContent>
                {therapists.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Periode Mulai</Label>
            <Input
              type="date"
              value={period.startDate}
              onChange={(e) => setPeriod((p) => ({ ...p, startDate: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Periode Akhir</Label>
            <Input
              type="date"
              value={period.endDate}
              onChange={(e) => setPeriod((p) => ({ ...p, endDate: e.target.value }))}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Catatan &amp; Rekomendasi Pengembangan (opsional)</Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Kekuatan, area yang perlu diperbaiki, dan action plan untuk bulan depan..."
            rows={4}
          />
          <p className="text-xs text-slate-500">Catatan ini akan dicetak di bagian akhir laporan sebelum tanda tangan.</p>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleGenerate} disabled={generating} className="bg-indigo-600 hover:bg-indigo-700 text-white">
            {generating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
            Generate PDF
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default TherapistMonthlyReportManager;
