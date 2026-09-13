import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/use-toast';
import { Loader2, Bell } from 'lucide-react';

// Katalog jenis push notifikasi per role. Key harus sama persis dengan nama
// kolom boolean di tabel `fcm_tokens` (lihat migrasi
// 20260913000000_owner_admin_notification_preferences.sql).
export const NOTIFICATION_CATALOG = {
  owner: [
    {
      key: 'notif_owner_soap_progress_enabled',
      icon: '📋',
      title: 'Progress SOAP Terapis',
      desc: 'Notifikasi saat SOAP seorang terapis sudah lengkap, atau masih ada yang belum diisi untuk periode berjalan.',
    },
    {
      key: 'notif_owner_soap_lock_enabled',
      icon: '🔒',
      title: 'Jadwal Terapis Terkunci/Terbuka',
      desc: 'Notifikasi saat jadwal booking seorang terapis terkunci karena SOAP menumpuk, atau terbuka kembali.',
    },
  ],
  admin: [
    {
      key: 'notif_owner_soap_progress_enabled',
      icon: '📋',
      title: 'Progress SOAP Terapis',
      desc: 'Notifikasi saat SOAP seorang terapis sudah lengkap, atau masih ada yang belum diisi untuk periode berjalan.',
    },
    {
      key: 'notif_owner_soap_lock_enabled',
      icon: '🔒',
      title: 'Jadwal Terapis Terkunci/Terbuka',
      desc: 'Notifikasi saat jadwal booking seorang terapis terkunci karena SOAP menumpuk, atau terbuka kembali.',
    },
  ],
  therapist: [
    {
      key: 'notif_soap_enabled',
      icon: '📋',
      title: 'SOAP Belum Terisi',
      desc: 'Notifikasi setiap malam jam 21:30 jika masih ada kunjungan yang belum diisi SOAP-nya di periode ini.',
    },
    {
      key: 'notif_guest_enabled',
      icon: '👤',
      title: 'Pasien Belum Terdaftar',
      desc: 'Notifikasi setiap malam jam 21:30 jika ada pasien hari ini yang masih berstatus guest di Daily Recap.',
    },
  ],
};

// Kartu preferensi push notifikasi yang bisa dipakai ulang di setup akun
// owner, admin, maupun terapis. Baca & simpan langsung ke kolom boolean
// `fcm_tokens.<key>` milik user yang sedang login.
const NotificationPreferencesCard = ({ userId, items }) => {
  const [prefs, setPrefs] = useState(() =>
    Object.fromEntries(items.map((item) => [item.key, true]))
  );
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState(null);

  useEffect(() => {
    let active = true;
    const fetchPrefs = async () => {
      if (!userId) { setLoading(false); return; }
      const columns = items.map((item) => item.key).join(', ');
      const { data } = await supabase
        .from('fcm_tokens')
        .select(columns)
        .eq('user_id', userId)
        .maybeSingle();
      if (active && data) {
        setPrefs((p) => ({
          ...p,
          ...Object.fromEntries(items.map((item) => [item.key, data[item.key] !== false])),
        }));
      }
      if (active) setLoading(false);
    };
    fetchPrefs();
    return () => { active = false; };
  }, [userId, items]);

  const handleToggle = async (key) => {
    const newVal = !prefs[key];
    setPrefs((p) => ({ ...p, [key]: newVal }));
    setSavingKey(key);
    const { error } = await supabase
      .from('fcm_tokens')
      .update({ [key]: newVal })
      .eq('user_id', userId);
    setSavingKey(null);
    if (error) {
      setPrefs((p) => ({ ...p, [key]: !newVal }));
      toast({ variant: 'destructive', title: 'Gagal menyimpan preferensi', description: error.message });
    } else {
      toast({ title: 'Preferensi notifikasi disimpan' });
    }
  };

  if (loading) {
    return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.key} className="flex items-start gap-3 p-4 rounded-xl border border-slate-100 bg-slate-50">
          <span className="text-xl mt-0.5">{item.icon}</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-800">{item.title}</p>
            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{item.desc}</p>
          </div>
          <Switch
            checked={prefs[item.key]}
            onCheckedChange={() => handleToggle(item.key)}
            disabled={savingKey === item.key}
            className="shrink-0 mt-0.5"
          />
        </div>
      ))}
      <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 flex items-start gap-2">
        <Bell className="w-3.5 h-3.5 text-amber-600 mt-0.5 shrink-0" />
        <p className="text-xs text-amber-700">Notifikasi hanya terkirim ke perangkat yang sudah mengaktifkan izin notifikasi di browser/PWA.</p>
      </div>
    </div>
  );
};

export default NotificationPreferencesCard;
