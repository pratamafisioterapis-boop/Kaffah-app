import { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';

export const useMediaAssets = () => {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchAssets = async () => {
    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id;
      const { data: userRow } = await supabase.from('users').select('clinic_id').eq('id', userId).single();

      const { data, error } = await supabase
        .from('media_assets')
        .select('*')
        .eq('clinic_id', userRow?.clinic_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAssets(data || []);
    } catch (error) {
      console.error('Error fetching media assets:', error);
      toast({
        variant: "destructive",
        title: "Gagal Mengambil Data",
        description: error.message || "Gagal memuat aset media."
      });
    } finally {
      setLoading(false);
    }
  };

  const getLogoImage = async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id;
      const { data: userRow } = await supabase.from('users').select('clinic_id').eq('id', userId).single();

      // Priority 1: Check for 'logo' category
      let { data } = await supabase
        .from('media_assets')
        .select('file_url')
        .eq('clinic_id', userRow?.clinic_id)
        .ilike('category', 'logo')
        .limit(1)
        .maybeSingle();

      if (data?.file_url) return data.file_url;

      // Priority 2: Check for 'header' category
      ({ data } = await supabase
          .from('media_assets')
          .select('file_url')
          .ilike('category', 'header')
          .limit(1)
          .maybeSingle());
      
      if (data?.file_url) return data.file_url;
      
      // Fallback: Get the first available image
      ({ data } = await supabase
        .from('media_assets')
        .select('file_url')
        .limit(1)
        .maybeSingle());

      return data?.file_url || null;

    } catch (error) {
      console.error('Error fetching logo:', error);
      return null;
    }
  };

  const uploadAsset = async (file, category) => {
    setLoading(true);
    try {
      // 1. Upload to Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${category}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('clinic-assets')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // 2. Get Public URL
      const { data: publicUrlData } = supabase.storage
        .from('clinic-assets')
        .getPublicUrl(filePath);

      // 3. Save Metadata to DB
      const user = (await supabase.auth.getUser()).data.user;
      
      const { data: assetData, error: dbError } = await supabase
        .from('media_assets')
        .insert([{
          name: file.name,
          category,
          file_path: filePath,
          file_url: publicUrlData.publicUrl,
          file_size: file.size,
          mime_type: file.type,
          uploaded_by: user?.id
        }])
        .select()
        .single();

      if (dbError) {
        // Cleanup storage if DB insert fails
        await supabase.storage.from('clinic-assets').remove([filePath]);
        throw dbError;
      }

      setAssets(prev => [assetData, ...prev]);
      return { success: true, data: assetData };

    } catch (error) {
      console.error('Error uploading asset:', error);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  const deleteAsset = async (id, filePath) => {
    setLoading(true);
    try {
      // 1. Delete from Storage
      const { error: storageError } = await supabase.storage
        .from('clinic-assets')
        .remove([filePath]);

      if (storageError) throw storageError;

      // 2. Delete from DB
      const { error: dbError } = await supabase
        .from('media_assets')
        .delete()
        .eq('id', id);

      if (dbError) throw dbError;

      setAssets(prev => prev.filter(a => a.id !== id));
      return { success: true };
    } catch (error) {
      console.error('Error deleting asset:', error);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  return {
    assets,
    loading,
    fetchAssets,
    uploadAsset,
    deleteAsset,
    getLogoImage
  };
};