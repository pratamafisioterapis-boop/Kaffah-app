import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { Loader2, Save, MessageCircle, Clock, History, Info, KeyRound, ShieldCheck, ShieldAlert, Eye, EyeOff } from 'lucide-react';
import { getWaApiSettings, upsertWaApiSettings } from '@/lib/api';

import WhatsAppMessagePreview from './WhatsAppMessagePreview';
import WhatsAppScheduleConfig from './WhatsAppScheduleConfig';
import WhatsAppLogs from './WhatsAppLogs';

const WaApiKeySection = () => {
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showKey, setShowKey] = useState(false);
    const [apiKey, setApiKey] = useState('');
    const [numberKey, setNumberKey] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [enabled, setEnabled] = useState(true);
    const [hasKey, setHasKey] = useState(false);

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        setLoading(true);
        const { data } = await getWaApiSettings();
        if (data) {
            setApiKey(data.api_key || '');
            setNumberKey(data.number_key || '');
            setPhoneNumber(data.phone_number || '');
            setEnabled(data.enabled ?? true);
            setHasKey(!!data.api_key);
        }
        setLoading(false);
    };

    const handleSave = async () => {
        setSaving(true);
        const { error } = await upsertWaApiSettings({ apiKey: apiKey.trim(), numberKey: numberKey.trim() || 'ALL', phoneNumber: phoneNumber.trim(), enabled });
        if (error) {
            toast({ variant: "destructive", title: "Gagal Menyimpan", description: error.message });
        } else {
            toast({ title: "API Key Tersimpan", description: "Konfigurasi Watzap klinik berhasil disimpan." });
            setHasKey(!!apiKey.trim());
        }
        setSaving(false);
    };

    return (
        <div className="bg-white p-4 rounded-lg border border-slate-200 mb-6">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <KeyRound className="w-5 h-5 text-indigo-600" />
                    <div>
                        <Label className="text-base">API Key Watzap Klinik</Label>
                        <p className="text-xs text-slate-500">Diperlukan agar fitur "Kirim Otomatis" via WhatsApp aktif untuk klinik ini.</p>
                    </div>
                </div>
                {!loading && (
                    hasKey ? (
                        <span className="flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                            <ShieldCheck className="w-3.5 h-3.5" /> Terhubung
                        </span>
                    ) : (
                        <span className="flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
                            <ShieldAlert className="w-3.5 h-3.5" /> Belum Diatur
                        </span>
                    )
                )}
            </div>

            {loading ? (
                <div className="p-4 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-slate-300" /></div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <Label className="text-xs text-slate-600">Watzap API Key</Label>
                        <div className="relative">
                            <Input
                                type={showKey ? 'text' : 'password'}
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                placeholder="Masukkan API Key dari dashboard Watzap"
                                className="pr-9"
                            />
                            <button
                                type="button"
                                onClick={() => setShowKey(v => !v)}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            >
                                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-xs text-slate-600">Watzap Number Key</Label>
                        <Input
                            value={numberKey}
                            onChange={(e) => setNumberKey(e.target.value)}
                            placeholder="Isi 'ALL' jika hanya punya 1 nomor terhubung"
                        />
                        <p className="text-[11px] text-slate-400">
                            Wajib diisi agar pesan WhatsApp benar-benar terkirim. Ambil dari menu WhatsApp → API → Number Key di dashboard Watzap, atau isi <code className="px-1 bg-slate-100 rounded">ALL</code> jika klinik hanya punya satu nomor terhubung.
                        </p>
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-xs text-slate-600">Nomor WhatsApp Pengirim (opsional)</Label>
                        <Input
                            value={phoneNumber}
                            onChange={(e) => setPhoneNumber(e.target.value)}
                            placeholder="Contoh: 08123456789"
                        />
                    </div>
                    <div className="md:col-span-2 flex items-center justify-between pt-2">
                        <div className="flex items-center gap-2">
                            <Switch checked={enabled} onCheckedChange={setEnabled} />
                            <span className="text-sm text-slate-600">Aktifkan integrasi WhatsApp untuk klinik ini</span>
                        </div>
                        <Button onClick={handleSave} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700">
                            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                            Simpan API Key
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
};

const CATEGORIES = [
  {
    id: 'booking_appointment',
    label: 'Booking Appt.',
    placeholders: [
      'sapaan',
      'nickname',   // ✅ tambahkan ini
      'nama',
      'tanggal',
      'jam',
      'hari_booking',
      'terapis',
      'layanan'
    ]
  },
  {
  id: 'booking_appointment_homecare',
  label: 'Booking Homecare',
  placeholders: [
    'sapaan',
    'nickname',
    'nama',
    'tanggal',
    'jam',
    'hari_booking',
    'terapis',
    'layanan'
  ]
},
  {
  id: 'reschedule_appointment',
  label: 'Reschedule',
  placeholders: [
    'sapaan',
    'nickname',
    'nama',
    'tanggal',
    'jam',
    'hari',
    'hari_booking',
    'tanggal_lama',
    'jam_lama',
    'hari_lama',
    'terapis',
    'layanan'
  ]
},
  {
    id: 'follow_up',
    label: 'Follow Up',
    placeholders: [
      'sapaan',
      'nickname',   // ✅ tambahkan
      'nama',
      'tanggal_appointment_terakhir',
      'jam'
    ]
  },
  {
  id: 'package_expiry',
  label: 'Expiry Paket',
  placeholders: [
    'sapaan',
    'nickname',
    'nama',
    'nama_pasien',
    'jenis_paket',
    'nama_paket',
    'sisa_sesi',
    'sessions_remaining',
    'days_left',
    'risk_level',
    'tanggal_habis',
    'hari_expiry',
    'tanggal_expiry'
  ]
},
  {
    id: 'therapy_reminder',
    label: 'Reminder Terapi',
    placeholders: [
      'sapaan',
      'nickname',   // ✅ tambahkan
      'nama',
      'jam',
      'hari_booking',
      'terapis',
      'lokasi'
    ]
  },
  {
    id: 'therapy_reminder_homecare',
    label: 'Reminder Homecare',
    placeholders: [
      'sapaan',
      'nickname',
      'nama',
      'jam',
      'hari_booking',
      'terapis',
      'lokasi'
    ]
  },
  {
    id: 'birthday',
    label: 'Ulang Tahun',
    placeholders: [
      'sapaan',
      'nickname',   // ✅ tambahkan
      'nama',
      'usia',
      'masa_berlaku',
      'hari',
      'tanggal_lahir'
    ]
  },
  {
    id: 'referral_reward',
    label: 'Reward Referral',
    placeholders: [
      'sapaan',
      'nickname',
      'nama',
      'nama_pasien_baru',
      'waktu'
    ]
  },
];

const getWaktuGreeting = () => {
  const hour = new Date().getHours();
  if (hour >= 4 && hour < 11) return 'Selamat Pagi';
  if (hour >= 11 && hour < 15) return 'Selamat Siang';
  if (hour >= 15 && hour < 18) return 'Selamat Sore';
  return 'Selamat Malam';
};

const SAMPLE_DATA = {
    sapaan: '',
    nama: 'Sakti Mandraguna',
    nama_pasien: 'Sakti Mandraguna',
    tanggal: '15 Januari 2024',
    jam: '09:00',
    hari_booking: 'Senin',
    terapis: 'Fisio Andi',
    layanan: 'Fisioterapi Umum',
    tanggal_appointment_terakhir: '12 Januari 2024',
    jenis_paket: 'Paket 10 Sesi',
    nama_paket: 'Paket 10 Sesi',
    sisa_sesi: '2',
    tanggal_habis: '20 Januari 2024',
    jam_terapi: '14:00', // Legacy support
    lokasi: 'Klinik Kaffah Care',
    umur_baru: '30', // Backward compatibility sample
    usia: '30',
    masa_berlaku: '15 Januari – 15 Februari',
    hari: 'Senin',
    tanggal_lahir: '15 Januari 1994',
    hari_expiry: 'Rabu',
    tanggal_expiry: '20 Januari 2024',
    tanggal_lama: '10 Januari 2024',
    jam_lama: '10:00',
    hari_lama: 'Rabu',
    nama_pasien_baru: 'Rina Wulandari',
    waktu: getWaktuGreeting()
};

const TemplateEditor = ({ categoryId, availablePlaceholders }) => {
    const { toast } = useToast();
    const [template, setTemplate] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [isEnabled, setIsEnabled] = useState(true);
    const [previewHasNickname, setPreviewHasNickname] = useState(true);

    useEffect(() => {
        fetchTemplate();
    }, [categoryId]);

    const fetchTemplate = async () => {
        setLoading(true);
        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData?.session?.user?.id;
        const { data: userRow } = await supabase.from('users').select('clinic_id').eq('id', userId).single();

        const { data } = await supabase.from('wa_templates').select('*').eq('category', categoryId).eq('clinic_id', userRow?.clinic_id).maybeSingle();
        if (data) {
            setTemplate(data.template_text);
            setIsEnabled(data.is_enabled);
        }
        setLoading(false);
    };

    const handleSave = async () => {
  setSaving(true);

  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData?.session?.user?.id;
  const { data: userRow } = await supabase.from('users').select('clinic_id').eq('id', userId).single();

  const payload = {
    category: categoryId,
    template_text: template,
    placeholders: availablePlaceholders,
    is_enabled: isEnabled,
    clinic_id: userRow?.clinic_id,
    updated_at: new Date().toISOString()
  };

  const { error } = await supabase
    .from('wa_templates')
    .upsert(payload, { onConflict: 'category,clinic_id' });

  if (error) {
    toast({
      variant: "destructive",
      title: "Gagal Menyimpan",
      description: error.message
    });
  } else {
    toast({
      title: "Template Tersimpan",
      description: "Perubahan template berhasil disimpan."
    });
  }

  setSaving(false);
};

    if (loading) return <div className="p-8 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-slate-300" /></div>;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
                <div className="bg-white p-4 rounded-lg border border-slate-200">
                    <div className="flex justify-between items-center mb-4">
                        <Label className="text-base">Editor Template</Label>
                        <div className="flex items-center gap-2">
                             <Label className="text-xs text-slate-500">Status Template</Label>
                             <Switch checked={isEnabled} onCheckedChange={setIsEnabled} />
                        </div>
                    </div>
                    <Textarea 
                        value={template} 
                        onChange={(e) => setTemplate(e.target.value)} 
                        className="h-40 font-mono text-sm"
                        placeholder="Tulis pesan WhatsApp Anda di sini..."
                    />
                    
                    {/* Variables Reference Section */}
                    <div className="mt-4 bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-3">
                        <div className="flex items-center gap-2 text-slate-800 font-semibold text-sm">
                            <Info className="w-4 h-4 text-blue-500" />
                            Daftar Variabel Tersedia
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3 text-xs">
                             <div className="space-y-1 col-span-2">
                                <div className="font-medium text-slate-700">[sapaan]</div>
                                <div className="text-slate-500 bg-slate-100 p-2 rounded mt-1 border border-slate-200">
                                    <p className="font-medium mb-1">Logika Sapaan:</p>
                                    <ul className="list-disc pl-4 space-y-1 text-slate-600">
                                        <li><strong>Nickname ada:</strong> Menggunakan Nickname (contoh: "Sakti" → "Sakti")</li>
                                        <li><strong>Hanya Nama Lengkap:</strong> "Ka" + Nama (contoh: "Budi Santoso" → "Ka Budi Santoso")</li>
                                        <li><strong>Tidak ada data:</strong> Default "Kak"</li>
                                    </ul>
                                </div>
                             </div>
                             <div className="space-y-1">
                                <div className="font-medium text-slate-700">[nama]</div>
                                <div className="text-slate-500">Nama lengkap pasien</div>
                             </div>
                             {availablePlaceholders.includes('jam') && (
                                <div className="space-y-1">
                                    <div className="font-medium text-slate-700">[jam]</div>
                                    <div className="text-slate-500">Jam appointment (HH:MM)</div>
                                </div>
                             )}
                             {availablePlaceholders.includes('hari_booking') && (
                                <div className="space-y-1">
                                    <div className="font-medium text-slate-700">[hari_booking]</div>
                                    <div className="text-slate-500">Nama hari dari tanggal appointment</div>
                                </div>
                             )}
                             {availablePlaceholders.includes('hari_expiry') && (
                                <div className="space-y-1">
                                    <div className="font-medium text-slate-700">[hari_expiry]</div>
                                    <div className="text-slate-500">Nama hari dari tanggal expiry paket</div>
                                </div>
                             )}
                             {availablePlaceholders.includes('tanggal_expiry') && (
                                <div className="space-y-1">
                                    <div className="font-medium text-slate-700">[tanggal_expiry]</div>
                                    <div className="text-slate-500">Tanggal expiry paket (DD Bulan YYYY)</div>
                                </div>
                             )}
                             {availablePlaceholders.includes('tanggal') && (
                                <div className="space-y-1">
                                    <div className="font-medium text-slate-700">[tanggal]</div>
                                    <div className="text-slate-500">Tanggal appointment</div>
                                </div>
                             )}
                             {availablePlaceholders.includes('usia') && (
                                 <div className="space-y-1">
                                    <div className="font-medium text-slate-700">[usia]</div>
                                    <div className="text-slate-500">Usia pasien (auto)</div>
                                 </div>
                             )}
                             {availablePlaceholders.includes('masa_berlaku') && (
                                 <div className="space-y-1">
                                    <div className="font-medium text-slate-700">[masa_berlaku]</div>
                                    <div className="text-slate-500">Tgl berlaku promo (1 bulan)</div>
                                 </div>
                             )}
                             {availablePlaceholders.includes('hari') && (
                                 <div className="space-y-1">
                                    <div className="font-medium text-slate-700">[hari]</div>
                                    <div className="text-slate-500">Nama hari ulang tahun tahun ini</div>
                                 </div>
                             )}
                             {availablePlaceholders.includes('tanggal_lahir') && (
                                 <div className="space-y-1">
                                    <div className="font-medium text-slate-700">[tanggal_lahir]</div>
                                    <div className="text-slate-500">Tanggal lahir pasien</div>
                                 </div>
                             )}
                             {availablePlaceholders.includes('nama_pasien_baru') && (
                                 <div className="space-y-1">
                                    <div className="font-medium text-slate-700">[nama_pasien_baru]</div>
                                    <div className="text-slate-500">Nama pasien baru yang direferensikan</div>
                                 </div>
                             )}
                             {availablePlaceholders.includes('waktu') && (
                                 <div className="space-y-1 col-span-2">
                                    <div className="font-medium text-slate-700">[waktu]</div>
                                    <div className="text-slate-500">Otomatis "Selamat Pagi/Siang/Sore/Malam" sesuai jam saat pesan dibuat</div>
                                 </div>
                             )}
                        </div>

                        <div className="pt-2 border-t border-slate-200">
                             <p className="font-semibold text-slate-700 mb-2 text-xs">Variabel Khusus Kategori Ini:</p>
                             <div className="flex flex-wrap gap-1">
                                {availablePlaceholders.filter(p => !['sapaan', 'nama', 'jam', 'hari_booking', 'hari_expiry', 'tanggal_expiry'].includes(p)).map(p => (
                                    <span key={p} className="bg-white border border-slate-200 px-2 py-1 rounded text-xs text-slate-600 cursor-pointer hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-colors" onClick={() => setTemplate(prev => prev + ` [${p}] `)}>
                                        [{p}]
                                    </span>
                                ))}
                             </div>
                        </div>
                    </div>

                    <Button onClick={handleSave} disabled={saving} className="mt-4 w-full bg-blue-600 hover:bg-blue-700">
                        {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                        Simpan Template
                    </Button>
                </div>
                
                {/* Schedule Configuration */}
{!['package_expiry', 'referral_reward'].includes(categoryId) && (
  <WhatsAppScheduleConfig category={categoryId} />
)}
            </div>

            <div className="space-y-4">
                 <div className="bg-white p-4 rounded-lg border border-slate-200 h-full flex flex-col items-center">
                    <Label className="self-start mb-4 text-slate-500">Live Preview</Label>
                     <div className="flex items-center gap-2 mb-3">
  <Switch
    checked={previewHasNickname}
    onCheckedChange={setPreviewHasNickname}
  />
  <span className="text-xs text-slate-500">
    Simulasi ada nickname
  </span>
</div>
                     <div className="flex-1 w-full flex items-center justify-center bg-slate-50 rounded-lg border border-slate-100 p-4">
                        {/* 
                            We pass a sample patient object to simulate behavior.
                            Passing nickname will trigger Priority 1 (Nickname only).
                            Remove nickname to test Priority 2 ("Ka" + Full Name).
                        */}
                        <WhatsAppMessagePreview 
                            template={template} 
                            placeholders={SAMPLE_DATA} 
                            patient={{ 
  nickname: previewHasNickname ? 'Sakti' : '',
  full_name: 'Sakti Mandraguna',
  date_of_birth: '1994-01-15'
}}
                        />
                     </div>
                     <p className="text-xs text-slate-400 mt-4 text-center px-4">
                        Preview menggunakan data contoh. Tampilan pesan asli akan menyesuaikan data pasien.
                     </p>
                 </div>
            </div>
        </div>
    );
};

const WhatsAppSettings = () => {
    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                    <MessageCircle className="w-6 h-6 text-green-600" />
                    WhatsApp Automation
                </h2>
                <p className="text-slate-500 mt-1">Kelola pesan otomatis dan notifikasi WhatsApp untuk pasien klinik.</p>
            </div>

            <WaApiKeySection />

            <Tabs defaultValue="booking_appointment" className="w-full">
                <TabsList className="bg-white border border-slate-200 p-1 rounded-xl h-auto flex flex-wrap gap-1 mb-6">
                    {CATEGORIES.map(cat => (
                        <TabsTrigger 
                            key={cat.id} 
                            value={cat.id}
                            className="data-[state=active]:bg-green-50 data-[state=active]:text-green-700 px-4 py-2 rounded-lg"
                        >
                            {cat.label}
                        </TabsTrigger>
                    ))}
                    <TabsTrigger value="logs" className="ml-auto data-[state=active]:bg-slate-100 gap-2">
                        <History className="w-3 h-3" /> Riwayat
                    </TabsTrigger>
                </TabsList>

                {CATEGORIES.map(cat => (
                    <TabsContent key={cat.id} value={cat.id}>
                        <TemplateEditor categoryId={cat.id} availablePlaceholders={cat.placeholders} />
                    </TabsContent>
                ))}

                <TabsContent value="logs">
                    <WhatsAppLogs />
                </TabsContent>
            </Tabs>
        </div>
    );
};

export default WhatsAppSettings;