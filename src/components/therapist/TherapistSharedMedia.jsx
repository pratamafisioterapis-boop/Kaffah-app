import React, { useEffect, useState } from 'react';
import { Download, Image as ImageIcon, Calendar, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/customSupabaseClient';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

const TherapistSharedMedia = ({ therapist }) => {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSharedMedia();
  }, [therapist?.id]);

  const fetchSharedMedia = async () => {
    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id;
      if (!userId) return;

      const { data: userRow } = await supabase
        .from('users')
        .select('clinic_id')
        .eq('id', userId)
        .single();

      if (!userRow?.clinic_id) return;

      let query = supabase
        .from('media_assets')
        .select('*')
        .eq('clinic_id', userRow.clinic_id)
        .order('created_at', { ascending: false });

      // Filter by access: show if allowed_therapist_ids is null OR contains this therapist's id
      if (therapist?.id) {
        query = query.or(
          `allowed_therapist_ids.is.null,allowed_therapist_ids.cs.{${therapist.id}}`
        );
      } else {
        query = query.is('allowed_therapist_ids', null);
      }

      const { data, error } = await query;
      if (error) throw error;
      setAssets(data || []);
    } catch (err) {
      console.error('fetchSharedMedia error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <ImageIcon className="w-6 h-6 text-blue-600" />
          Sharing Media
        </h2>
        <p className="text-slate-500 mt-1">
          Media, banner, dan materi yang dibagikan Owner untuk klinik. Anda dapat melihat dan mengunduhnya di sini.
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-40 w-full rounded-lg" />)}
        </div>
      ) : assets.length === 0 ? (
        <div className="text-center py-16 bg-slate-50 rounded-xl border border-dashed border-slate-200">
          <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-4">
            <ImageIcon className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-medium text-slate-900">Belum ada media dibagikan</h3>
          <p className="text-sm text-slate-500 max-w-sm mx-auto mt-1">
            Owner belum membagikan media apa pun untuk Anda.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {assets.map((asset) => (
            <div key={asset.id} className="group bg-white border border-slate-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow duration-200 flex flex-col h-full">
              <div className="relative aspect-video bg-slate-100 border-b border-slate-100 overflow-hidden">
                <img src={asset.file_url} alt={asset.name} className="w-full h-full object-contain p-2" loading="lazy" />
                <div className="absolute top-2 left-2">
                  <span className="px-2 py-1 bg-white/90 backdrop-blur-sm rounded text-[10px] font-semibold text-slate-700 shadow-sm border border-slate-200 uppercase tracking-wide">
                    {asset.category}
                  </span>
                </div>
              </div>
              <div className="p-4 flex flex-col flex-grow">
                <h4 className="font-medium text-slate-900 text-sm truncate mb-2" title={asset.name}>{asset.name}</h4>
                <div className="flex items-center text-xs text-slate-500 gap-2 mb-3">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>{asset.created_at ? format(new Date(asset.created_at), 'dd MMM yyyy', { locale: idLocale }) : '-'}</span>
                </div>
                <Button variant="outline" size="sm" className="mt-auto gap-2" onClick={() => window.open(asset.file_url, '_blank')}>
                  <Download className="w-3.5 h-3.5" /> Download
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TherapistSharedMedia;
