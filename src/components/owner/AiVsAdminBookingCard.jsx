import React, { useEffect, useState } from 'react';
import { Bot, UserCog } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/lib/customSupabaseClient';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

const PAGE = 1000;

// Perbandingan jadwal yang dibuat admin vs AI WhatsApp, dihitung sejak booking AI pertama.
const AiVsAdminBookingCard = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: first } = await supabase
          .from('appointments')
          .select('created_at')
          .eq('booking_source', 'ai_whatsapp')
          .order('created_at', { ascending: true })
          .limit(1);
        const since = first?.[0]?.created_at;
        if (!since) {
          if (!cancelled) setData({ since: null });
          return;
        }
        const rows = [];
        for (let from = 0; ; from += PAGE) {
          const { data: page, error } = await supabase
            .from('appointments')
            .select('booking_source,status')
            .gte('created_at', since)
            .in('booking_source', ['admin', 'ai_whatsapp'])
            .range(from, from + PAGE - 1);
          if (error) throw error;
          rows.push(...(page || []));
          if (!page || page.length < PAGE) break;
        }
        const calc = (src) => {
          const r = rows.filter((x) => x.booking_source === src);
          const cancelled = r.filter((x) => ['cancelled', 'no-show'].includes(x.status)).length;
          const done = r.filter((x) => x.status === 'completed').length;
          return { total: r.length, cancelled, done };
        };
        if (!cancelled) setData({ since, admin: calc('admin'), ai: calc('ai_whatsapp') });
      } catch (e) {
        console.error('AiVsAdminBookingCard', e);
        if (!cancelled) setData({ since: null, error: true });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const total = data?.since ? data.admin.total + data.ai.total : 0;
  const pct = (n) => (total > 0 ? Math.round((n / total) * 100) : 0);

  const Row = ({ icon: Icon, label, stat, color, bar }) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 font-medium text-slate-800">
          <Icon className={`w-4 h-4 ${color}`} /> {label}
        </div>
        <div className="text-sm text-slate-600">
          <span className="text-2xl font-bold text-slate-900">{stat.total}</span> jadwal ({pct(stat.total)}%)
        </div>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full ${bar}`} style={{ width: `${pct(stat.total)}%` }} />
      </div>
      <p className="text-xs text-slate-500">Selesai {stat.done} · Batal/no-show {stat.cancelled}</p>
    </div>
  );

  return (
    <Card className="shadow-sm border-slate-200">
      <CardHeader>
        <CardTitle>Jadwal: Admin vs AI</CardTitle>
        {data?.since && (
          <p className="text-xs text-slate-500">
            Sejak AI aktif ({format(new Date(data.since), 'd MMM yyyy', { locale: idLocale })})
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-5">
        {loading ? (
          <div className="h-24 bg-slate-100 animate-pulse rounded" />
        ) : !data?.since ? (
          <p className="text-sm text-slate-500">{data?.error ? 'Gagal memuat data.' : 'Belum ada jadwal yang dibuat AI.'}</p>
        ) : (
          <>
            <Row icon={UserCog} label="Dibuat Admin" stat={data.admin} color="text-slate-600" bar="bg-slate-500" />
            <Row icon={Bot} label="Dibuat AI WhatsApp" stat={data.ai} color="text-emerald-600" bar="bg-emerald-500" />
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default AiVsAdminBookingCard;
