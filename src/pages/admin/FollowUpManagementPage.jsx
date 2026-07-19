import React, { useState, useEffect, useCallback } from 'react';
import { 
    getFollowUpQueue, 
    markFollowUpAsSent, 
    markFollowUpAsCompleted, 
    deleteFollowUp,
    generateFollowUps
} from '@/lib/api';
import FollowUpCard from '@/components/admin/FollowUpCard';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { RefreshCw, CheckCircle2, AlertCircle, Loader2, Info, MessageCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAuth } from '@/contexts/SupabaseAuthContext';

const FollowUpManagementPage = () => {
    const [queueItems, setQueueItems] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('booking_appointment');
    const [generating, setGenerating] = useState(null);
    const { toast } = useToast();

    // Fetch data
    const fetchQueue = useCallback(async () => {
        setError(null);
        try {
            const { data, success, error: apiError } = await getFollowUpQueue(null);
            
            if (success) {
                setQueueItems(data || []);
            } else {
                throw new Error(apiError || 'Failed to fetch queue');
            }
        } catch (err) {
            console.error("Fetch Queue Error:", err);
            setError(err.message);
            setQueueItems([]); 
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Initial load & Auto-refresh
    useEffect(() => {
        fetchQueue();
        const interval = setInterval(fetchQueue, 30000); // 30s auto-refresh
        return () => clearInterval(interval);
    }, [fetchQueue]);

    const handleRefresh = () => {
        setIsLoading(true);
        fetchQueue();
    };

  const handleGenerate = async (type) => {
    setGenerating(type);
    const { error } = await generateFollowUps(type);

    if (error) {
      toast({
          title: "Error",
          description: error.message,
          variant: "destructive"
      });
    } else {
      toast({
          title: "Success",
          description: "Data berhasil di-generate!",
      });
      fetchQueue();
    }
    setGenerating(null);
  };

    // Handlers
    const handleSendWA = (item) => {
        if (!item.phone_number) {
            toast({
                title: "Error",
                description: "Nomor telepon tidak valid",
                variant: "destructive"
            });
            return;
        }

        let phone = item.phone_number.replace(/\D/g, '');
        if (phone.startsWith('0')) phone = '62' + phone.substring(1);
        else if (!phone.startsWith('62')) phone = '62' + phone;

        // Message is already interpolated by FollowUpCard
        const url = `https://wa.me/${phone}?text=${encodeURIComponent(item.message_content || '')}`;
        window.open(url, '_blank');

        markFollowUpAsSent(item.id);
        setQueueItems(prev => prev.filter(i => i.id !== item.id));
    };

    const handleComplete = async (id) => {
        const { success } = await markFollowUpAsCompleted(id);
        if (success) {
            toast({
                title: "Berhasil",
                description: "Follow up ditandai selesai",
                className: "bg-green-50 border-green-200 text-green-800"
            });
            setQueueItems(prev => prev.filter(i => i.id !== id));
        } else {
            toast({
                title: "Gagal",
                description: "Gagal update status",
                variant: "destructive"
            });
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Yakin ingin menghapus item ini?")) return;
        
        const { success } = await deleteFollowUp(id);
        if (success) {
            toast({
                title: "Terhapus",
                description: "Item dihapus dari antrian",
            });
            setQueueItems(prev => prev.filter(i => i.id !== id));
        } else {
            toast({
                title: "Gagal",
                description: "Gagal menghapus item",
                variant: "destructive"
            });
        }
    };

    // Filter logic
    const filteredItems = Array.isArray(queueItems) 
        ? queueItems.filter(item => item && item.follow_up_type === activeTab)
        : [];

    // Helper counts for debug box
    const getCount = (type) => queueItems.filter(i => i.follow_up_type === type).length;

    return (
        <div className="p-6 space-y-6 max-w-7xl mx-auto">
            {/* Hero Banner */}
            <div className="w-full rounded-2xl overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 shadow-xl border border-slate-700/50 relative">
              <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle, #6366f1 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
              <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-5 py-5 sm:px-7 sm:py-6">
                <div className="flex items-center gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-indigo-600/80 flex items-center justify-center shadow-lg">
                    <MessageCircle className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-xs font-bold tracking-widest text-indigo-300 uppercase mb-1">{useAuth().clinicName || ''}</p>
                    <h2 className="text-lg sm:text-xl font-bold text-white leading-tight">Follow Up Management</h2>
                    <p className="text-sm text-slate-400 mt-0.5">Kelola antrian pesan WhatsApp otomatis hari ini</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="outline" size="sm"
                    onClick={() => handleGenerate('therapy_reminder')}
                    disabled={generating === 'therapy_reminder'}
                    className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                  >
                    {generating === 'therapy_reminder' && <Loader2 className="w-3 h-3 animate-spin mr-1"/>}
                    Gen. Reminder
                  </Button>
                  <Button
                    variant="outline" size="sm"
                    onClick={handleRefresh}
                    disabled={isLoading}
                    className="gap-2 bg-white/10 border-white/20 text-white hover:bg-white/20"
                  >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    Refresh
                  </Button>
                </div>
              </div>
            </div>

            <Alert className="bg-blue-50 border-blue-200 text-blue-800">
                <Info className="h-4 w-4 text-blue-600" />
                <AlertTitle className="text-blue-900 font-semibold">Automated Follow Up System</AlertTitle>
                <AlertDescription className="text-xs mt-1 space-y-1">
                    <p>• <strong>Auto-Triggers:</strong> Booking confirmations and daily recap follow-ups are created automatically.</p>
                    <p>• <strong>Scheduled Tasks:</strong> Therapy reminders (H-0), Package Expiry (H-7,3,1), and Birthdays are auto-generated daily at 00:00 via cron.</p>
                    <p>• <strong>Manual Generation:</strong> Use the buttons below to manually trigger generation if auto-scheduler fails.</p>
                </AlertDescription>
            </Alert>

            {error && (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>
                        {error}
                        <Button variant="link" className="px-2 h-auto text-red-200 underline" onClick={handleRefresh}>Coba lagi</Button>
                    </AlertDescription>
                </Alert>
            )}

            <Tabs defaultValue="booking_appointment" value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="bg-white border border-slate-200 p-1 mb-6 w-full flex overflow-x-auto justify-start md:justify-center">
                    <TabsTrigger value="booking_appointment" className="flex-1 min-w-[100px]">Booking ({getCount('booking_appointment')})</TabsTrigger>
                    <TabsTrigger value="follow_up" className="flex-1 min-w-[100px]">Follow Up ({getCount('follow_up')})</TabsTrigger>
                    <TabsTrigger value="expiry_package" className="flex-1 min-w-[100px]">Paket ({getCount('expiry_package')})</TabsTrigger>
                    <TabsTrigger value="therapy_reminder" className="flex-1 min-w-[100px]">Jadwal ({getCount('therapy_reminder')})</TabsTrigger>
                    <TabsTrigger value="birthday_greeting" className="flex-1 min-w-[100px]">Ultah ({getCount('birthday_greeting')})</TabsTrigger>
                </TabsList>
                <TabsContent value={activeTab} className="mt-0">
                    {isLoading ? (
                        <div className="flex justify-center py-20">
                            <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
                        </div>
                    ) : filteredItems.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
                            <CheckCircle2 className="w-12 h-12 text-slate-300 mb-3" />
                            <h3 className="text-lg font-medium text-slate-900">Tidak ada antrian</h3>
                            <p className="text-slate-500 mb-4">Semua follow up untuk kategori ini sudah selesai!</p>
                             {activeTab === 'expiry_package' && (
                                <Button variant="outline" size="sm" onClick={() => handleGenerate('expiry_package')}>
                                    {generating === 'expiry_package' && <Loader2 className="w-3 h-3 animate-spin mr-1"/>}
                                    Generate Manual Expiry
                                </Button>
                             )}
                             {activeTab === 'birthday_greeting' && (
                                <Button variant="outline" size="sm" onClick={() => handleGenerate('birthday_greeting')}>
                                     {generating === 'birthday_greeting' && <Loader2 className="w-3 h-3 animate-spin mr-1"/>}
                                    Generate Manual Birthday
                                </Button>
                             )}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filteredItems.map(item => (
                                <FollowUpCard 
                                    key={item.id} 
                                    item={item} 
                                    onSend={() => handleSendWA(item)}
                                    onComplete={handleComplete}
                                    onDelete={handleDelete}
                                />
                            ))}
                        </div>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
};

export default FollowUpManagementPage;