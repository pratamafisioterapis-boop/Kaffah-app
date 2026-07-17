import React, { useState, useEffect, useCallback } from 'react';
import {
  getFollowUpQueue,
  markFollowUpAsSent,
  deleteFollowUp
} from '@/lib/api';
import { interpolateTemplate } from '@/lib/api';
import { supabase } from '@/lib/customSupabaseClient';
import FollowUpCard from '@/components/admin/FollowUpCard';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';

const FollowUpManagementPage = () => {

  const [queueItems, setQueueItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('booking_appointment');
  const [isBablastEnabled, setIsBablastEnabled] = useState(false);
  const [isChatAIEnabled, setIsChatAIEnabled] = useState(false);

  const { userDetails } = useAuth();
  const { toast } = useToast();

  // ===============================
  // Fetch Queue
  // ===============================
  const fetchQueue = useCallback(async () => {
    try {
      const { data, success } = await getFollowUpQueue(null);
      if (success) setQueueItems(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ===============================
  // Initial Load
  // ===============================
  useEffect(() => {
    fetchQueue();

    const fetchSettings = async () => {

      // Bablast
      if (userDetails?.clinic_id) {
        const { data: waSetting } = await supabase
          .from('wa_settings')
          .select('id, enabled')
          .eq('clinic_id', userDetails.clinic_id)
          .maybeSingle();

        if (waSetting) {
          setIsBablastEnabled(waSetting.enabled);
        }
      }

      // Chat AI
      const { data: aiSetting } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'chat_ai_enabled')
        .maybeSingle();

      if (aiSetting) {
        setIsChatAIEnabled(aiSetting.value === 'true');
      }
    };

    fetchSettings();

  }, [fetchQueue]);

  // ===============================
  // Handlers
  // ===============================

  const handleSendWA = async (item) => {

    if (!item.phone_number) return;

    let phone = item.phone_number.replace(/\D/g, '');
    if (phone.startsWith('0')) phone = '62' + phone.substring(1);
    else if (!phone.startsWith('62')) phone = '62' + phone;

    let finalMessage = interpolateTemplate(item.message_content, item);
    finalMessage = finalMessage.normalize('NFC');

    const url = `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(finalMessage)}`;
    window.open(url, '_blank');

    await markFollowUpAsSent(item.id);

    toast({
      title: 'Pesan Dibuka',
      description: 'Status diubah menjadi terkirim'
    });

    await fetchQueue();
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Yakin ingin menghapus item ini?')) return;

    const { error } = await deleteFollowUp(id);
    if (!error) {
      setQueueItems(prev => prev.filter(i => i.id !== id));
    }
  };
const handleGenerate = async (type) => {

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
        functionName = 'generate_therapy_reminder_today';
        break;

      case 'reminder_therapist_h10':
        functionName = 'send_reminder_therapist_h10';
        break;

      case 'birthday_greeting':
        functionName = 'generate_birthday_greetings';
        break;

      case 'booking_appointment':
        functionName = 'generate_appointment_reminders';
        break;

      default:
        throw new Error(`Unknown type: ${type}`);
    }

    const { error } = await supabase.rpc(functionName);

    if (error) throw error;

    toast({
      title: 'Berhasil',
      description: `${type} berhasil di-generate`
    });

    await fetchQueue();

  } catch (error) {

    console.error(error);

    toast({
      variant: 'destructive',
      title: 'Generate gagal',
      description: error.message
    });

  }
};
  const handleToggleBablast = async () => {

  if (!userDetails?.clinic_id) return;

  const { data: current } = await supabase
    .from('wa_settings')
    .select('id, enabled')
    .eq('clinic_id', userDetails.clinic_id)
    .maybeSingle();

  let data, error;

  if (current) {
    const newValue = !current.enabled;
    const payload = newValue
      ? {
          enabled: true,
          last_enabled_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      : {
          enabled: false,
          updated_at: new Date().toISOString()
        };

    ({ data, error } = await supabase
      .from('wa_settings')
      .update(payload)
      .eq('id', current.id)
      .select()
      .single());
  } else {
    ({ data, error } = await supabase
      .from('wa_settings')
      .insert({
        clinic_id: userDetails.clinic_id,
        enabled: true,
        last_enabled_at: new Date().toISOString()
      })
      .select()
      .single());
  }

  if (!error && data) {
    setIsBablastEnabled(data.enabled);
  }
};

  const handleToggleChatAI = async () => {

    const newValue = !isChatAIEnabled;

    const { data } = await supabase
      .from('system_settings')
      .update({ value: newValue.toString() })
      .eq('key', 'chat_ai_enabled')
      .select()
      .single();

    if (data) setIsChatAIEnabled(newValue);
  };

  // ===============================
  // Filter
  // ===============================
  const today = new Date().toLocaleDateString('en-CA', {
    timeZone: 'Asia/Makassar'
  });

  const statusRank = { pending: 0, failed: 1, sent: 2, completed: 2, cancelled: 3 };
const byStatus = (a, b) => (statusRank[a.status] ?? 9) - (statusRank[b.status] ?? 9);

const filteredItems = queueItems.filter(
  item =>
    item &&
    item.follow_up_type === activeTab &&
    item.scheduled_date?.split('T')[0] === today
);
const displayItems =
  activeTab === 'package_expiry'
    ? [...filteredItems].sort((a, b) => {

        const daysA =
          a.message_content?.match(/(\d+)\s*hari/i)?.[1] || 9999;

        const daysB =
          b.message_content?.match(/(\d+)\s*hari/i)?.[1] || 9999;

        if (Number(daysA) !== Number(daysB)) {
          return Number(daysA) - Number(daysB);
        }

        const sessionsA =
          a.message_content?.match(/(\d+)\s*sesi/i)?.[1] || 0;

        const sessionsB =
          b.message_content?.match(/(\d+)\s*sesi/i)?.[1] || 0;

        return Number(sessionsB) - Number(sessionsA);

      })
    : [...filteredItems].sort(byStatus);
const getCount = (type) => {
  return queueItems.filter(
    i =>
      i &&
      i.follow_up_type === type &&
      i.scheduled_date?.split('T')[0] === today
  ).length;
};
const isPWA =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true ||
    document.referrer.includes('android-app://');
  // ===============================
  // UI
  // ===============================
  return (
  <div className="space-y-6">

    {/* Hero Banner — desktop & PWA */}
    <div className="w-full rounded-2xl overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 shadow-xl border border-slate-700/50 relative">
      <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle, #6366f1 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
      <div className={`relative flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${isPWA ? 'px-4 py-4' : 'px-5 py-5 sm:px-7 sm:py-6'}`}>
        <div className="flex items-center gap-4">
          <div className={`flex-shrink-0 ${isPWA ? 'w-10 h-10' : 'w-12 h-12'} rounded-xl bg-indigo-600/80 flex items-center justify-center shadow-lg`}>
            <svg xmlns="http://www.w3.org/2000/svg" className={`${isPWA ? 'w-5 h-5' : 'w-6 h-6'} text-white`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <div>
            <p className={`${isPWA ? 'text-[10px]' : 'text-xs'} font-bold tracking-widest text-indigo-300 uppercase mb-1`}>Kaffah Physiotherapy</p>
            <h2 className={`${isPWA ? 'text-base' : 'text-lg sm:text-xl'} font-bold text-white leading-tight`}>Follow Up Management</h2>
            <p className={`${isPWA ? 'text-xs' : 'text-sm'} text-slate-400 mt-0.5`}>Kelola antrian pesan WhatsApp otomatis</p>
          </div>
        </div>
        <div className={`flex items-center ${isPWA ? 'gap-4' : 'gap-8'}`}>

        {/* Bablast */}
        <div className="flex items-center gap-3">
          <span className={`${isPWA ? 'text-xs' : 'text-sm'} font-medium text-white`}>
            Bablast
          </span>

          <button
            onClick={handleToggleBablast}
            className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors duration-300 ${
              isBablastEnabled ? 'bg-green-500' : 'bg-gray-300'
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform duration-300 ${
                isBablastEnabled ? 'translate-x-7' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* Divider */}
        <div className="h-6 w-px bg-white/20" />

        {/* Chat AI */}
        <div className="flex items-center gap-3">
          <span className={`${isPWA ? 'text-xs' : 'text-sm'} font-medium text-white`}>
            Chat AI
          </span>

          <button
            onClick={handleToggleChatAI}
            className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors duration-300 ${
              isChatAIEnabled ? 'bg-blue-500' : 'bg-gray-300'
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform duration-300 ${
                isChatAIEnabled ? 'translate-x-7' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

      </div>
      </div>
    </div>

    {/* ================= TABS SECTION ================= */}
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">

      <Tabs
        defaultValue="booking_appointment"
        value={activeTab}
        onValueChange={setActiveTab}
        className="w-full"
      >

        <TabsList className="bg-slate-50 border border-slate-200 rounded-xl p-1 flex overflow-x-auto">
          
          <TabsTrigger value="booking_appointment" className="flex-1 min-w-[120px]">
            Booking ({getCount('booking_appointment')})
          </TabsTrigger>

          <TabsTrigger value="follow_up" className="flex-1 min-w-[120px]">
            Follow Up ({getCount('follow_up')})
          </TabsTrigger>

          <TabsTrigger value="package_expiry" className="flex-1 min-w-[120px]">
            Paket ({getCount('package_expiry')})
          </TabsTrigger>

          <TabsTrigger value="therapy_reminder" className="flex-1 min-w-[120px]">
            Pengingat Terapi ({getCount('therapy_reminder')})
          </TabsTrigger>

          <TabsTrigger value="birthday_greeting" className="flex-1 min-w-[120px]">
            Ultah ({getCount('birthday_greeting')})
          </TabsTrigger>
          <TabsTrigger value="reminder_therapist_h10" className="flex-1 min-w-[160px]">
  Jadwal Terapis Besok ({getCount('reminder_therapist_h10')})
</TabsTrigger>
        </TabsList>



        <TabsContent value={activeTab} className="mt-6">
<div className="flex justify-end gap-2 mb-4 mt-4">

  <button
    onClick={() => handleGenerate(activeTab)}
    className="px-4 py-2 rounded-xl border border-blue-200 text-blue-600 hover:bg-blue-50 text-sm font-medium"
  >
    Generate Section
  </button>

  <button
    onClick={async () => {
      if (!window.confirm('Hapus semua data section ini?')) return;

      const ids = filteredItems.map(i => i.id);

      for (const id of ids) {
        await deleteFollowUp(id);
      }

      fetchQueue();

      toast({
        title: 'Berhasil',
        description: 'Semua data section dihapus'
      });
    }}
    className="px-4 py-2 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 text-sm font-medium"
  >
    Delete Section
  </button>

</div>
          {isLoading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 bg-slate-50 rounded-2xl border border-slate-200">
              <CheckCircle2 className="w-12 h-12 text-slate-300 mb-3" />
              <h3 className="text-lg font-medium text-slate-900">
                Tidak ada antrian
              </h3>
              <p className="text-slate-500 text-sm mt-1">
                Semua follow up untuk kategori ini sudah selesai.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {displayItems.map(item => (
                <FollowUpCard
                  key={item.id}
                  item={item}
                  onSend={() => handleSendWA(item)}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}

        </TabsContent>

      </Tabs>
    </div>

  </div>
);
};

export default FollowUpManagementPage;