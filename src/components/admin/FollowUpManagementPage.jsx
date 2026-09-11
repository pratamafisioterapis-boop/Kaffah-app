import React, { useState, useEffect, useCallback } from 'react';
import {
  getFollowUpQueue,
  markFollowUpAsSent,
  markFollowUpAsCompleted,
  deleteFollowUp,
  interpolateTemplate
} from '@/lib/api';
import { supabase } from '@/lib/customSupabaseClient';
import FollowUpCard from '@/components/admin/FollowUpCard';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import {
  Loader2,
  CheckCircle2,
  CalendarCheck,
  MessageCircle,
  Package,
  Clock,
  Cake,
  Stethoscope,
  Gift
} from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';

// Setiap tab bisa mewakili lebih dari satu follow_up_type — mis. "Pengingat
// Terapi" juga harus menghitung reminder homecare (therapy_reminder_homecare),
// yang sebelumnya tidak muncul di tab manapun karena tipenya berbeda dari
// yang dicocokkan tab ini.
const TAB_CONFIG = [
  { value: 'booking_appointment', label: 'Booking', shortLabel: 'Booking', icon: CalendarCheck, types: ['booking_appointment'] },
  { value: 'follow_up', label: 'Follow Up', shortLabel: 'Follow Up', icon: MessageCircle, types: ['follow_up'] },
  { value: 'package_expiry', label: 'Paket', shortLabel: 'Paket', icon: Package, types: ['package_expiry'] },
  { value: 'therapy_reminder', label: 'Pengingat Terapi', shortLabel: 'Reminder', icon: Clock, types: ['therapy_reminder', 'therapy_reminder_homecare'] },
  { value: 'birthday_greeting', label: 'Ultah', shortLabel: 'Ultah', icon: Cake, types: ['birthday_greeting'] },
  { value: 'reminder_therapist_h10', label: 'Jadwal Terapis Besok', shortLabel: 'Jadwal Besok', icon: Stethoscope, types: ['reminder_therapist_h10'] },
  { value: 'referral_reward', label: 'Reward Referral', shortLabel: 'Reward', icon: Gift, types: ['referral_reward'] }
];

const FollowUpManagementPage = () => {

  const [queueItems, setQueueItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('booking_appointment');

  const { clinicName } = useAuth();
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
  }, [fetchQueue]);

  // ===============================
  // Handlers
  // ===============================

  // "Follow Up Rutin" tidak lagi dikirim otomatis oleh cron — admin memilih
  // sendiri pesan mana yang dikirim, lalu mengirimnya langsung via Watzap.
  const handleSendFollowUpRutin = async (item) => {
    const { data, error } = await supabase.rpc('send_follow_up_whatsapp', {
      p_queue_id: item.id
    });

    if (error || !data?.success) {
      toast({
        variant: 'destructive',
        title: 'Gagal Mengirim',
        description: error?.message || data?.message || 'Terjadi kesalahan saat mengirim pesan'
      });
      return;
    }

    toast({
      title: 'Terkirim',
      description: 'Pesan berhasil dikirim via WhatsApp'
    });

    await fetchQueue();
  };

  const handleSendWA = async (item) => {

    if (item.follow_up_type === 'follow_up') {
      await handleSendFollowUpRutin(item);
      return;
    }

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

  const handleComplete = async (id) => {
    const { error } = await markFollowUpAsCompleted(id);

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Gagal',
        description: 'Gagal menandai item sebagai selesai'
      });
      return;
    }

    toast({
      title: 'Ditandai Selesai',
      description: 'Pesan tidak akan dikirim'
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
  // ===============================
  // Filter
  // ===============================
  const today = new Date().toLocaleDateString('en-CA', {
    timeZone: 'Asia/Makassar'
  });

  const activeTabConfig = TAB_CONFIG.find(tab => tab.value === activeTab) || TAB_CONFIG[0];

  const statusRank = { pending: 0, failed: 1, sent: 2, completed: 2, cancelled: 3 };
const byStatus = (a, b) => (statusRank[a.status] ?? 9) - (statusRank[b.status] ?? 9);

const filteredItems = queueItems.filter(
  item =>
    item &&
    activeTabConfig.types.includes(item.follow_up_type) &&
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
    : activeTab === 'follow_up'
    ? [...filteredItems].sort((a, b) => {
        // Pasien baru & pasien lama (>30 hari tidak terapi) wajib
        // diprioritaskan di atas; pasien rutin (kunjungan rutin bulanan)
        // sifatnya opsional jadi ditaruh di bawah.
        const categoryPriority = { new: 0, lapsed: 0, routine: 1 };
        const priorityA = categoryPriority[a.patient_category] ?? 1;
        const priorityB = categoryPriority[b.patient_category] ?? 1;

        if (priorityA !== priorityB) return priorityA - priorityB;

        return byStatus(a, b);
      })
    : [...filteredItems].sort(byStatus);
const getCount = (types) => {
  return queueItems.filter(
    i =>
      i &&
      types.includes(i.follow_up_type) &&
      i.scheduled_date?.split('T')[0] === today
  ).length;
};
  // ===============================
  // UI
  // ===============================
  return (
  <div className="space-y-4 sm:space-y-6">

    {/* Hero Banner */}
    <div className="relative overflow-hidden rounded-[18px] sm:rounded-[22px] border border-[#DCE8F2] shadow-sm h-44 sm:h-52 md:h-60 lg:h-72">
      <img
        src="/hero/clinara-followup-hero.webp"
        alt="Kaffah Physiotherapy"
        className="absolute inset-0 w-full h-full object-cover object-[38%_center]"
      />
      <div className="absolute inset-0 flex flex-col justify-center px-4 sm:px-6 md:px-10 lg:px-14">
        <div className="max-w-[74%] sm:max-w-[62%] md:max-w-sm">
          <p className="text-[#5B6B7D] text-xs sm:text-sm font-medium mb-1">{clinicName || ''}</p>
          <h1
            style={{ fontFamily: "'Caveat', cursive" }}
            className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-[#102F52] leading-[0.85]"
          >
            Follow Up<br />
            <span className="text-[#2F8CFF] underline decoration-wavy decoration-2 md:decoration-[3px] underline-offset-4 md:underline-offset-8">
              Management
            </span>
          </h1>
          <p className="text-[#5B6B7D] text-[10px] sm:text-xs md:text-sm mt-1.5 md:mt-3 leading-snug md:leading-relaxed">
            Kelola antrian pesan WhatsApp otomatis.
          </p>
        </div>
      </div>
    </div>

    {/* ================= TABS SECTION ================= */}
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-3 sm:p-6">

      <Tabs
        defaultValue="booking_appointment"
        value={activeTab}
        onValueChange={setActiveTab}
        className="w-full"
      >

        <TabsList className="w-full h-auto flex-nowrap justify-start gap-1.5 overflow-x-auto scrollbar-hide snap-x snap-mandatory bg-slate-50 border border-slate-200 rounded-xl p-1.5 -mx-1 px-1 sm:mx-0 sm:px-1.5">
          {TAB_CONFIG.map(tab => {
            const Icon = tab.icon;
            const count = getCount(tab.types);
            return (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="shrink-0 snap-start gap-1.5 rounded-lg px-3 py-2 text-xs sm:text-sm font-semibold whitespace-nowrap data-[state=active]:shadow-sm"
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span className="sm:hidden">{tab.shortLabel}</span>
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="text-[10px] sm:text-xs font-bold opacity-60">({count})</span>
              </TabsTrigger>
            );
          })}
        </TabsList>



        <TabsContent value={activeTab} className="mt-4 sm:mt-6">
          {isLoading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 sm:py-20 bg-slate-50 rounded-2xl border border-slate-200 px-4 text-center">
              <CheckCircle2 className="w-12 h-12 text-slate-300 mb-3" />
              <h3 className="text-lg font-medium text-slate-900">
                Tidak ada antrian
              </h3>
              <p className="text-slate-500 text-sm mt-1">
                Semua follow up untuk kategori ini sudah selesai.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
              {displayItems.map(item => (
                <FollowUpCard
                  key={item.id}
                  item={item}
                  onSend={() => handleSendWA(item)}
                  onComplete={['follow_up', 'referral_reward'].includes(item.follow_up_type) ? handleComplete : undefined}
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
