import React, { useState, useEffect } from 'react';
import { 
  Tabs, TabsContent, TabsList, TabsTrigger 
} from "@/components/ui/tabs";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  RefreshCcw, Calendar, MessageCircle, Package, Clock, Gift, 
  Send, Trash2, CheckCircle, AlertTriangle, Loader2, PlusCircle,
  XCircle, RotateCcw
} from 'lucide-react';
import { 
  getFollowUpQueue, 
  sendFollowUpWhatsApp, 
  markFollowUpAsCompleted,
  deleteFollowUpQueue,
  deleteFollowUpQueueBulk,
  generateFollowUpQueue,
} from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';
import { format, isBefore, startOfDay } from 'date-fns';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';


const FollowUpManagement = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [queueData, setQueueData] = useState([]);
  const [activeTab, setActiveTab] = useState('booking_confirmation');
  const [processingId, setProcessingId] = useState(null);
  
  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Debug logging
  useEffect(() => {
    if (queueData.length > 0) {
        console.log('🔍 [FollowUpManagement] queueData updated:', queueData);
    }
  }, [queueData]);

  // Initial Fetch & Subscription
  useEffect(() => {
    fetchQueue();

    // Real-time subscription to follow_up_queue
    const channel = supabase
      .channel('follow_up_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'follow_up_queue' },
        (payload) => {
          console.log('📡 [Realtime] Change received:', payload);
          if (payload.eventType === 'INSERT') {
             toast({ title: "New Item", description: `New ${payload.new.follow_up_type} queue added.` });
             fetchQueue(); 
          } else if (payload.eventType === 'UPDATE') {
             if (payload.new.status === 'cancelled') {
                 toast({ title: "Status Updated", description: `Item cancelled: ${payload.new.failed_reason || 'Unknown reason'}` });
             }
             fetchQueue();
          } else if (payload.eventType === 'DELETE') {
             setQueueData(prev => prev.filter(item => item.id !== payload.old.id));
             setSelectedIds(prev => {
                const newSet = new Set(prev);
                newSet.delete(payload.old.id);
                return newSet;
             });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const filterExpiredData = (data) => {
    const today = startOfDay(new Date());
    // Auto-expire logic: Remove any queue data with scheduled_date < today
    return data.filter(item => {
      if (item.scheduled_date) {
        const scheduled = startOfDay(new Date(item.scheduled_date));
        if (isBefore(scheduled, today)) {
          return false;
        }
      }
      return true;
    });
  };

  const fetchQueue = async () => {
    setLoading(true);
    try {
      const { data, error } = await getFollowUpQueue(); 
      console.log('FETCH RESULT:', { data, error });
      if (error) throw error;
      
      const filtered = (data || []);
      console.log(`✅ [Fetch] Loaded ${filtered.length} valid items after auto-expire`);
      
      console.log(
  'FAILED ITEMS:',
  filtered.filter(i => i.status === 'failed')
);
      setQueueData(filtered);
    } catch (error) {
      console.error("❌ Error fetching queue:", error);
      toast({ 
        variant: "destructive", 
        title: "Error fetching data", 
        description: error.message 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async (type) => {
    setGenerating(true);

    try {
        let functionName = '';

        switch (type) {
            case 'follow_up':
                functionName = 'generate_follow_up_daily';
                break;

            case 'package_expiry':
                functionName = 'generate_smart_package_expiry';
                break;

            case 'therapy_reminder':
            case 'reminder_therapist_h10':
                functionName = 'generate_therapy_reminder_today';
                break;

            case 'birthday_greeting':
                functionName = 'generate_birthday_greetings';
                break;

            case 'booking_appointment':
            case 'booking_appointment_therapist':
                functionName = 'generate_appointment_reminders';
                break;

            default:
                throw new Error(`Unknown follow up type: ${type}`);
        }

        console.log('🚀 GENERATE FUNCTION:', functionName);

        const { error } = await supabase.rpc(functionName);

        if (error) throw error;

        toast({
            title: 'Berhasil',
            description: `${functionName} berhasil dijalankan`
        });

        await fetchQueue();

    } catch (error) {
        console.error('❌ Generate Error:', error);

        toast({
            variant: 'destructive',
            title: 'Generate gagal',
            description: error.message
        });
    } finally {
        setGenerating(false);
    }
};
  const handleSend = async (id) => {
      setProcessingId(id);
      try {
          const { error } = await sendFollowUpWhatsApp(id);
          if (error) throw error;
          toast({ title: "Sent", description: "Message sent via WhatsApp." });
      } catch (error) {
          toast({ variant: "destructive", title: "Failed", description: error.message });
      } finally {
          setProcessingId(null);
      }
  };

  const handleMarkSent = async (id) => {
      setProcessingId(id);
      try {
          const { error } = await markFollowUpAsCompleted(id);
          if (error) throw error;
          toast({ title: "Marked Sent", description: "Status updated manually." });
      } catch (error) {
          toast({ variant: "destructive", title: "Failed", description: error.message });
      } finally {
          setProcessingId(null);
      }
  };
  
  const handleCancel = async (id) => {
      setProcessingId(id);
      try {
          const { error } = await supabase.from('follow_up_queue')
            .update({ status: 'cancelled', failed_reason: 'Manually cancelled' })
            .eq('id', id);
          if (error) throw error;
          toast({ title: "Cancelled", description: "Queue item cancelled." });
          fetchQueue();
      } catch (error) {
          toast({ variant: "destructive", title: "Failed", description: error.message });
      } finally {
          setProcessingId(null);
      }
  };

  const handleRetry = async (id) => {
      setProcessingId(id);
      try {
          const { error } = await supabase.from('follow_up_queue')
            .update({ status: 'pending', failed_reason: null })
            .eq('id', id);
          if (error) throw error;
          toast({ title: "Retrying", description: "Item reset to pending." });
          fetchQueue();
      } catch (error) {
          toast({ variant: "destructive", title: "Failed", description: error.message });
      } finally {
          setProcessingId(null);
      }
  };

  const handleDelete = async (id) => {
      if (!confirm("Are you sure you want to delete this item?")) return;
      setProcessingId(id);
      try {
          const { error } = await deleteFollowUpQueue(id);
          if (error) throw error;
          toast({ title: "Deleted", description: "Queue item removed." });
          setQueueData(prev => prev.filter(item => item.id !== id));
          // Remove from selected if present
          setSelectedIds(prev => {
              const newSet = new Set(prev);
              newSet.delete(id);
              return newSet;
          });
      } catch (error) {
          toast({ variant: "destructive", title: "Failed", description: error.message });
      } finally {
          setProcessingId(null);
      }
  };

  // Bulk Actions
  const toggleSelect = (id) => {
      setSelectedIds(prev => {
          const newSet = new Set(prev);
          if (newSet.has(id)) {
              newSet.delete(id);
          } else {
              newSet.add(id);
          }
          return newSet;
      });
  };

  const toggleSelectAll = (items) => {
      const allSelected = items.every(item => selectedIds.has(item.id));
      if (allSelected) {
          // Deselect all current items
          setSelectedIds(prev => {
              const newSet = new Set(prev);
              items.forEach(item => newSet.delete(item.id));
              return newSet;
          });
      } else {
          // Select all current items
          setSelectedIds(prev => {
              const newSet = new Set(prev);
              items.forEach(item => newSet.add(item.id));
              return newSet;
          });
      }
  };

  const handleBulkDelete = async (sectionItems = []) => {

    const sectionIds = sectionItems.map(item => item.id);

    const idsToDelete = Array.from(selectedIds)
        .filter(id => sectionIds.includes(id));

    if (idsToDelete.length === 0) {
        toast({
            variant: 'destructive',
            title: 'Tidak ada data',
            description: 'Tidak ada data di section ini yang dipilih'
        });
        return;
    }

    if (!confirm(`Yakin ingin menghapus ${idsToDelete.length} data pada section ini?`)) {
        return;
    }

    setLoading(true);

    try {

        const { error } = await supabase
            .from('follow_up_queue')
            .delete()
            .in('id', idsToDelete);

        if (error) throw error;

        toast({
            title: 'Berhasil',
            description: `${idsToDelete.length} data berhasil dihapus`
        });

        setQueueData(prev =>
            prev.filter(item => !idsToDelete.includes(item.id))
        );

        setSelectedIds(prev => {
            const newSet = new Set(prev);

            idsToDelete.forEach(id => {
                newSet.delete(id);
            });

            return newSet;
        });

    } catch (error) {

        console.error('BULK DELETE ERROR:', error);

        toast({
            variant: 'destructive',
            title: 'Gagal menghapus',
            description: error.message
        });

    } finally {
        setLoading(false);
    }
};

  // Filter queues based on new categories
  // Urutan tampil: pending & failed dulu, lalu sent/completed, cancelled paling bawah
const statusRank = { pending: 0, failed: 1, sent: 2, completed: 2, cancelled: 3 };
const byStatus = (a, b) => (statusRank[a.status] ?? 9) - (statusRank[b.status] ?? 9);

const bookingQueue = queueData
  .filter(q => ['booking_appointment', 'booking_appointment_therapist'].includes(q.follow_up_type))
  .sort(byStatus);

const postTreatmentQueue = queueData
  .filter(q => q.follow_up_type === 'follow_up')
  .sort(byStatus);

const expiryQueue = queueData
  .filter(q => q.follow_up_type === 'package_expiry')
  .sort(byStatus);

const reminderQueue = queueData
  .filter(q => ['therapy_reminder', 'reminder_therapist_h10'].includes(q.follow_up_type))
  .sort(byStatus);

const birthdayQueue = queueData
  .filter(q => q.follow_up_type === 'birthday_greeting')
  .sort(byStatus);

  // Render Grid Card Component
  const QueueCard = ({ item }) => {
      const isSelected = selectedIds.has(item.id);

      const getStatusColor = (status) => {
          switch(status) {
              case 'sent': return 'bg-green-100 text-green-700 hover:bg-green-200 border-green-200';
              case 'completed': return 'bg-green-100 text-green-700 hover:bg-green-200 border-green-200';
              case 'failed': return 'bg-red-100 text-red-700 hover:bg-red-200 border-red-200';
              case 'cancelled': return 'bg-slate-100 text-slate-500 hover:bg-slate-200 border-slate-200';
              case 'pending': return 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200 border-yellow-200';
              default: return 'bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200';
          }
      };
console.log({
  booking: bookingQueue.length,
  followup: postTreatmentQueue.length,
  expiry: expiryQueue.length,
  reminder: reminderQueue.length,
  birthday: birthdayQueue.length,
});
      return (
          <div className={`border rounded-xl p-5 hover:shadow-lg transition-all flex flex-col h-full relative overflow-hidden group ${isSelected ? 'bg-blue-50 border-blue-200 shadow-md' : 'bg-white border-slate-200'}`}>
              <div className={`absolute top-0 left-0 w-1 h-full ${
                  item.status === 'sent' ? 'bg-green-500' : 
                  item.status === 'failed' ? 'bg-red-500' : 
                  item.status === 'cancelled' ? 'bg-slate-300' : 
                  'bg-yellow-500'
              }`} />

              <div className="absolute top-3 left-3 z-10">
                  <Checkbox 
                      checked={isSelected}
                      onCheckedChange={() => toggleSelect(item.id)}
                      className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600 border-slate-300 bg-white"
                      aria-label="Select item"
                  />
              </div>
              
              <div className="flex justify-between items-start mb-3 pl-6">
                  <div>
                      <h4 className="font-bold text-slate-800 text-base">{item.patient?.full_name || 'Unknown Patient'}</h4>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-slate-500 font-mono bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
                            {item.phone_number}
                        </span>
                      </div>
                  </div>
                  <Badge className={`${getStatusColor(item.status)} border px-2 py-0.5 capitalize shadow-none`}>
                      {item.status}
                  </Badge>
              </div>
              
              <div className="bg-slate-50/50 p-3 rounded-lg text-sm text-slate-600 mb-4 border border-slate-100 font-normal leading-relaxed flex-grow">
                  {item.message_content}
              </div>
              
              <div className="flex items-center gap-4 text-xs text-slate-400 mb-4 pl-2 border-t border-slate-50 pt-3">
                 <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-300" />
                    <span>{item.scheduled_date ? format(new Date(item.scheduled_date), 'dd MMM yyyy') : '-'}</span>
                 </div>
                 <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-300" />
                    <span>{item.scheduled_time || '--:--'}</span>
                 </div>
              </div>

              {item.failed_reason && (
                 <div className="mb-4 pl-2 text-xs text-red-500 bg-red-50 p-2 rounded border border-red-100 flex items-start gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>{item.failed_reason}</span>
                 </div>
              )}

              <div className="flex gap-2 pl-2 mt-auto">
                  {item.status === 'pending' ? (
                      <>
                          <Button size="sm" className="h-9 text-xs flex-1 bg-green-600 hover:bg-green-700 shadow-sm" onClick={() => handleSend(item.id)} disabled={processingId === item.id}>
                              {processingId === item.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5 mr-1.5" />} 
                              Kirim
                          </Button>
                          <Button size="sm" variant="outline" className="h-9 text-xs px-3 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => handleCancel(item.id)} disabled={processingId === item.id}>
                              <XCircle className="w-3.5 h-3.5 mr-1.5" /> 
                              Batalkan
                          </Button>
                      </>
                  ) : item.status === 'failed' ? (
                      <Button size="sm" variant="outline" className="h-9 text-xs flex-1 border-yellow-200 text-yellow-700 hover:bg-yellow-50" onClick={() => handleRetry(item.id)} disabled={processingId === item.id}>
                          <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Retry
                      </Button>
                  ) : item.status === 'cancelled' ? (
                      <Button size="sm" variant="outline" className="h-9 text-xs flex-1 border-blue-200 text-blue-600 hover:bg-blue-50" onClick={() => handleRetry(item.id)} disabled={processingId === item.id}>
                          <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Aktifkan Ulang
                      </Button>
                  ) : (
                      <div className="flex-1 text-center text-xs text-green-600 py-2 font-medium bg-green-50 rounded border border-green-100 flex items-center justify-center gap-1.5">
                          <CheckCircle className="w-3.5 h-3.5" />
                          Terikirim {item.sent_at ? format(new Date(item.sent_at), 'HH:mm') : ''}
                      </div>
                  )}
                  
                  <div className="flex gap-1">
  <Button
    size="sm"
    variant="outline"
    className="h-9 px-3 border-blue-200 text-blue-600 hover:bg-blue-50"
    onClick={() => handleGenerate(
  item.follow_up_type === 'reminder_therapist_h10'
    ? 'reminder_therapist_h10'
    : item.follow_up_type
)}
    disabled={generating}
  >
    <PlusCircle className="w-4 h-4 mr-1" />
    Generate
  </Button>

  <Button
    size="sm"
    variant="ghost"
    className="h-9 w-9 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
    onClick={() => handleDelete(item.id)}
    disabled={processingId === item.id}
  >
    <Trash2 className="w-4 h-4" />
  </Button>
</div>
              </div>
          </div>
      );
  };

  const QueueSection = ({ data, title, typeForGen, description }) => {
      const allSelected = data.length > 0 && data.every(item => selectedIds.has(item.id));
      
      return (
      <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50 p-4 rounded-lg border border-slate-100">
              <div>
                  <h3 className="font-semibold text-lg text-slate-800 flex items-center gap-2">
                    {title} 
                    <Badge variant="secondary" className="ml-2 bg-white">{data.length}</Badge>
                  </h3>
                  {description && <p className="text-sm text-slate-500 mt-1">{description}</p>}
              </div>
              <div className="flex items-center gap-3">
                  {data.length > 0 && (
                      <div className="flex items-center gap-2 mr-2">
                          <Checkbox 
                              checked={allSelected}
                              onCheckedChange={() => toggleSelectAll(data)}
                              id={`select-all-${title}`}
                              className="border-slate-300"
                          />
                          <label 
                              htmlFor={`select-all-${title}`} 
                              className="text-sm font-medium text-slate-700 cursor-pointer"
                          >
                              Select All
                          </label>
                      </div>
                  )}
                  {typeForGen && (
                      <Button variant="default" size="sm" onClick={() => handleGenerate(typeForGen)} disabled={generating} className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm">
                          {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <PlusCircle className="w-3.5 h-3.5 mr-1.5" />}
                          Generate New
                      </Button>
                  )}
              </div>
          </div>
          
          {loading ? (
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                 {[1,2,3].map(i => <div key={i} className="h-48 bg-slate-100 animate-pulse rounded-xl" />)}
             </div>
          ) : data.length === 0 ? (
             <div className="text-center py-16 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50 flex flex-col items-center justify-center">
                 <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                    <MessageCircle className="w-8 h-8 text-slate-300" />
                 </div>
                 <h3 className="text-lg font-medium text-slate-700">Tidak ada data antrian</h3>
                 <p className="text-sm text-slate-400 mt-1 max-w-sm mx-auto">Data yang sudah kedaluwarsa atau tidak ada dalam jadwal hari ini tidak ditampilkan.</p>
                 {typeForGen && (
                    <Button variant="link" onClick={() => handleGenerate(typeForGen)} className="mt-4 text-blue-600">
                        Generate Data Sekarang
                    </Button>
                 )}
             </div>
          ) : (
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6">
                 {data.map(item => <QueueCard key={item.id} item={item} />)}
             </div>
          )}
      </div>
      );
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-500 p-6 max-w-[1600px] mx-auto">
      {/* Hero Banner */}
      <div className="w-full rounded-2xl overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 shadow-xl border border-slate-700/50 relative">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle, #d4af6a 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-5 py-5 sm:px-7 sm:py-6">
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400/20 to-amber-600/10 backdrop-blur-sm border border-amber-300/30 flex items-center justify-center shadow-lg">
              <MessageCircle className="w-6 h-6 text-amber-300" />
            </div>
            <div>
              <p className="text-xs font-bold tracking-widest text-amber-300/80 uppercase mb-1">{useAuth().clinicName || ''}</p>
              <h2 className="text-lg sm:text-xl font-bold text-white leading-tight flex items-center gap-2">
                Follow Up Management
                <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse" title="Live Updates Active" />
              </h2>
              <p className="text-sm text-slate-400 mt-0.5">Kelola antrian pesan otomatis, pengingat jadwal, dan notifikasi paket</p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
        {selectedIds.size > 0 && (
                <Button 
                    variant="destructive" 
                    onClick={() => {
    switch (activeTab) {

        case 'booking_confirmation':
            handleBulkDelete(bookingQueue);
            break;

        case 'post_treatment_follow_up':
            handleBulkDelete(postTreatmentQueue);
            break;

        case 'expiry_package':
            handleBulkDelete(expiryQueue);
            break;

        case 'appointment_reminder':
            handleBulkDelete(reminderQueue);
            break;

        case 'birthday_greeting':
            handleBulkDelete(birthdayQueue);
            break;

        default:
            handleBulkDelete([]);
    }
}}
                    disabled={loading}
                    className="gap-2 bg-red-600 hover:bg-red-700"
                >
                    <Trash2 className="w-4 h-4" />
                    Hapus Terpilih ({selectedIds.size})
                </Button>
            )}
            <Badge variant="outline" className="hidden md:flex py-1.5 px-3 border-slate-200 bg-slate-50 text-slate-600">
                Auto-Expire: {format(startOfDay(new Date()), 'dd MMM yyyy')}
            </Badge>
            <Button variant="outline" onClick={fetchQueue} disabled={loading} className="gap-2 bg-white/10 border-white/20 text-white hover:bg-white/20">
                <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
            </Button>
          </div>
        </div>
      </div>

      <Tabs
  key={`${bookingQueue.length}-${postTreatmentQueue.length}-${expiryQueue.length}-${reminderQueue.length}-${birthdayQueue.length}`}
  defaultValue="booking_confirmation"
  value={activeTab}
  onValueChange={setActiveTab}
  className="w-full space-y-6"
>
        <TabsList className="bg-white p-1.5 border border-slate-200 rounded-xl shadow-sm grid grid-cols-2 lg:grid-cols-5 h-auto gap-1">
          <TabsTrigger value="booking_confirmation" className="py-3 rounded-lg data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 data-[state=active]:font-medium transition-all gap-2">
            <Calendar className="w-4 h-4" /> <span className="hidden sm:inline">Booking ({bookingQueue.length})</span>
          </TabsTrigger>
          <TabsTrigger value="post_treatment_follow_up" className="py-3 rounded-lg data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 data-[state=active]:font-medium transition-all gap-2">
            <MessageCircle className="w-4 h-4" /> <span className="hidden sm:inline">Follow Up ({postTreatmentQueue.length})</span>
          </TabsTrigger>
          <TabsTrigger value="expiry_package" className="py-3 rounded-lg data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 data-[state=active]:font-medium transition-all gap-2">
            <Package className="w-4 h-4" /> <span className="hidden sm:inline">Paket ({expiryQueue.length})</span>
          </TabsTrigger>
          <TabsTrigger value="appointment_reminder" className="py-3 rounded-lg data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 data-[state=active]:font-medium transition-all gap-2">
            <Clock className="w-4 h-4" /> <span className="hidden sm:inline">Jadwal ({reminderQueue.length})</span>
          </TabsTrigger>
          <TabsTrigger value="birthday_greeting" className="py-3 rounded-lg data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 data-[state=active]:font-medium transition-all gap-2">
            <Gift className="w-4 h-4" /> <span className="hidden sm:inline">Ultah ({birthdayQueue.length})</span>
          </TabsTrigger>
        </TabsList>

        <div className="min-h-[500px]">
            <TabsContent value="booking_confirmation" className="mt-0 focus-visible:outline-none animate-in fade-in slide-in-from-bottom-2 duration-300">
                <QueueSection 
                    data={bookingQueue} 
                    title="Booking Confirmation" 
                    typeForGen={null} 
                    description="Konfirmasi booking appointment yang baru dibuat."
                />
            </TabsContent>
            <TabsContent value="post_treatment_follow_up" className="mt-0 focus-visible:outline-none animate-in fade-in slide-in-from-bottom-2 duration-300">
                <QueueSection 
                    data={postTreatmentQueue} 
                    title="Post Treatment & Recap" 
                    typeForGen="follow_up"
                    description="Follow up H+1/H+3 setelah terapi untuk menanyakan kondisi pasien."
                />
            </TabsContent>
            <TabsContent value="expiry_package" className="mt-0 focus-visible:outline-none animate-in fade-in slide-in-from-bottom-2 duration-300">
                <QueueSection 
                    data={expiryQueue} 
                    title="Package Expiry" 
                    typeForGen="package_expiry"
                    description="Pengingat paket yang akan segera kadaluarsa (H-7, H-3, H-1)."
                />
            </TabsContent>
            <TabsContent value="appointment_reminder" className="mt-0 focus-visible:outline-none animate-in fade-in slide-in-from-bottom-2 duration-300">
                <QueueSection 
                    data={reminderQueue} 
                    title="Today's Therapy Schedule" 
                    typeForGen="therapy_reminder"
                    description="Pengingat jadwal terapi untuk hari ini."
                />
            </TabsContent>
            <TabsContent value="birthday_greeting" className="mt-0 focus-visible:outline-none animate-in fade-in slide-in-from-bottom-2 duration-300">
                <QueueSection 
                    data={birthdayQueue} 
                    title="Birthday Greetings" 
                   typeForGen="birthday_greeting"
                    description="Ucapan ulang tahun otomatis untuk pasien yang berulang tahun hari ini."
                />
            </TabsContent>
        </div>
      </Tabs>
    </div>
  );
};

export default FollowUpManagement;