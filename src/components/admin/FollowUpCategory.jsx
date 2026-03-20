import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { RefreshCcw, AlertCircle } from 'lucide-react';
import { 
  getFollowUpPatients, 
  getPackageExpiryPatients, 
  getTodayTherapyPatients, 
  getBirthdayPatients,
  sendFollowUpWhatsApp,
  interpolateTemplate
} from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import FollowUpMessagePreview from './FollowUpMessagePreview';
import FollowUpCard from './FollowUpCard';

const FollowUpCategory = ({ category }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [previewMessage, setPreviewMessage] = useState('');
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchData();
  }, [category]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      let response;
      
      // Map category to API calls which now use follow_up_queue
      switch (category) {
        case 'follow_up':
          response = await getFollowUpPatients();
          break;
        case 'package_expiry':
          response = await getPackageExpiryPatients();
          break;
        case 'therapy_reminder':
          response = await getTodayTherapyPatients();
          break;
        case 'birthday':
          response = await getBirthdayPatients();
          break;
        default:
          response = { data: [] };
      }

      if (response.error) throw response.error;
      
      // Data is now queue items directly
      setData(response.data || []);
    } catch (err) {
      console.error("Error fetching category data:", err);
      setError("Gagal memuat data. Silakan coba lagi.");
      toast({ variant: "destructive", title: "Gagal Memuat Data", description: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handlePreview = async (item) => {
    setSelectedPatient(item);
    // Use interpolateTemplate from API which handles the new structure
    const msg = interpolateTemplate(item.message_content, item);
    setPreviewMessage(msg);
    setIsPreviewOpen(true);
  };

  const handleSendFromPreview = async () => {
    if (!selectedPatient) return;
    setSending(true);
    
    const patientObj = selectedPatient.patient || selectedPatient;
    const phone = patientObj.phone || selectedPatient.phone_number;
    
    if (!phone) {
      toast({ variant: "destructive", title: "Gagal", description: "Nomor HP pasien tidak tersedia." });
      setSending(false);
      return;
    }

    const result = await sendFollowUpWhatsApp(selectedPatient.id);

    if (!result.error) {
      const waUrl = `https://wa.me/${phone.replace(/\D/g, '').replace(/^0/, '62')}?text=${encodeURIComponent(previewMessage)}`;
      window.open(waUrl, '_blank');
      
      // Optimistic update
      setData(prev => prev.filter(p => p.id !== selectedPatient.id));
      
      toast({ title: "Berhasil", description: "Pesan disiapkan dan status diperbarui." });
      setIsPreviewOpen(false);
    } else {
      toast({ variant: "destructive", title: "Error", description: "Gagal mencatat log pengiriman." });
    }
    setSending(false);
  };

  const handleDismiss = (item) => {
    if (confirm("Hapus item ini dari daftar?")) {
      // In a real app, call delete API here
      const remainingData = data.filter(p => p.id !== item.id);
      setData(remainingData);
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-48 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription className="flex items-center gap-2">
          {error}
          <Button variant="outline" size="sm" onClick={fetchData} className="ml-auto h-8">
            <RefreshCcw className="w-3 h-3 mr-1" /> Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-16 bg-white rounded-xl border border-dashed border-slate-200 flex flex-col items-center justify-center">
        <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center mb-4">
          <RefreshCcw className="w-6 h-6 text-slate-400" />
        </div>
        <h3 className="text-lg font-medium text-slate-900">Tidak ada data</h3>
        <p className="text-slate-500 max-w-sm mx-auto mt-1 mb-6">
          Tidak ada antrian untuk kategori ini.
        </p>
        <Button onClick={fetchData} variant="outline" className="gap-2">
          <RefreshCcw className="w-4 h-4" /> Refresh Data
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-in fade-in duration-500">
        {data.map((item, idx) => (
            <FollowUpCard 
              key={item.id || idx}
              item={item}
              onSend={() => handlePreview(item)}
              onComplete={() => handleDismiss(item)} // Placeholder for complete
              onDelete={() => handleDismiss(item)}
            />
        ))}
      </div>

      <FollowUpMessagePreview 
        isOpen={isPreviewOpen} 
        onClose={() => setIsPreviewOpen(false)} 
        message={previewMessage} 
        onSend={handleSendFromPreview}
        sending={sending}
        phoneNumber={(selectedPatient?.patient || selectedPatient)?.phone}
      />
    </>
  );
};

export default FollowUpCategory;