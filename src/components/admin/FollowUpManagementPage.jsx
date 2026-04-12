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

const FollowUpManagementPage = () => {

  const [queueItems, setQueueItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('booking_appointment');
  const [isBablastEnabled, setIsBablastEnabled] = useState(false);
  const [isChatAIEnabled, setIsChatAIEnabled] = useState(false);

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
      const { data: waSetting } = await supabase
        .from('wa_settings')
        .select('id, enabled')
        .single();

      if (waSetting) {
        setIsBablastEnabled(waSetting.enabled);
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

  const handleToggleBablast = async () => {

  const { data: current } = await supabase
    .from('wa_settings')
    .select('id, enabled')
    .single();

  if (!current) return;

  const newValue = !current.enabled;

  const payload = newValue
    ? {
        enabled: true,
        last_enabled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(), // 🔥 TAMBAH INI
      }
    : {
        enabled: false,
        updated_at: new Date().toISOString(), // 🔥 TAMBAH INI
      };

  const { data, error } = await supabase
    .from('wa_settings')
    .update(payload)
    .eq('id', current.id)
    .select()
    .single();

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

  const filteredItems = queueItems.filter(
    item =>
      item &&
      item.follow_up_type === activeTab &&
      item.status === 'pending' &&
      item.scheduled_date?.split('T')[0] === today
  );

  const getCount = (type) => {
    return queueItems.filter(
      i =>
        i &&
        i.follow_up_type === type &&
        i.status === 'pending' &&
        i.scheduled_date?.split('T')[0] === today
    ).length;
  };

  // ===============================
  // UI
  // ===============================
  return (
  <div className="p-8 max-w-7xl mx-auto space-y-8">

    {/* ================= HEADER ================= */}
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex justify-between items-center">

      <div>
        <h1 className="text-2xl font-semibold text-slate-900">
          Follow Up Management
        </h1>
        <p className="text-slate-500 mt-1 text-sm">
          Kelola antrian pesan WhatsApp otomatis
        </p>
      </div>

      <div className="flex items-center gap-8">

        {/* Bablast */}
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-slate-600">
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
        <div className="h-6 w-px bg-slate-200" />

        {/* Chat AI */}
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-slate-600">
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
            Jadwal ({getCount('therapy_reminder')})
          </TabsTrigger>

          <TabsTrigger value="birthday_greeting" className="flex-1 min-w-[120px]">
            Ultah ({getCount('birthday_greeting')})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">

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
              {filteredItems.map(item => (
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