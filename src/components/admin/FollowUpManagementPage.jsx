import React, { useState, useEffect, useCallback } from 'react';
import {
  getFollowUpQueue,
  markFollowUpAsSent,
  deleteFollowUp,
  interpolateTemplate
} from '@/lib/api';
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
  Stethoscope
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
  { value: 'reminder_therapist_h10', label: 'Jadwal Terapis Besok', shortLabel: 'Jadwal Besok', icon: Stethoscope, types: ['reminder_therapist_h10'] }
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
    : [...filteredItems].sort(byStatus);
const getCount = (types) => {
  return queueItems.filter(
    i =>
      i &&
      types.includes(i.follow_up_type) &&
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
  <div className="space-y-4 sm:space-y-6">

    {/* Hero Banner — desktop & PWA */}
    <div className="w-full rounded-2xl overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 shadow-xl border border-slate-700/50 relative">
      <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle, #d4af6a 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
      <div className={`relative flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${isPWA ? 'px-4 py-4' : 'px-5 py-5 sm:px-7 sm:py-6'}`}>
        <div className="flex items-center gap-4">
          <div className={`flex-shrink-0 ${isPWA ? 'w-10 h-10' : 'w-12 h-12'} rounded-xl bg-gradient-to-br from-amber-400/20 to-amber-600/10 backdrop-blur-sm border border-amber-300/30 flex items-center justify-center shadow-lg`}>
            <svg xmlns="http://www.w3.org/2000/svg" className={`${isPWA ? 'w-5 h-5' : 'w-6 h-6'} text-amber-300`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <div>
            <p className={`${isPWA ? 'text-[10px]' : 'text-xs'} font-bold tracking-widest text-amber-300/80 uppercase mb-1`}>{clinicName || ''}</p>
            <h2 className={`${isPWA ? 'text-base' : 'text-lg sm:text-xl'} font-bold text-white leading-tight`}>Follow Up Management</h2>
            <p className={`${isPWA ? 'text-xs' : 'text-sm'} text-slate-400 mt-0.5`}>Kelola antrian pesan WhatsApp otomatis</p>
          </div>
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
