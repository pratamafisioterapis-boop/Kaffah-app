import { createClient } from '@supabase/supabase-js';
import { lightLoadFetch, configureLightLoadMode } from '@/lib/lightLoadMode';

const supabaseUrl = 'https://dqkejdamagvlhqvxaqej.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRxa2VqZGFtYWd2bGhxdnhhcWVqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3MjU1NjYsImV4cCI6MjA4MTMwMTU2Nn0.Fcp8V1AKY9ugjChUZC_b1zPpVw4BJTlMYCD3N16sXH8';

const customSupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: window.localStorage,
    storageKey: 'kaffah-auth-token', // key tetap, tidak berubah-ubah
  },
  // Lets the admin-only "Mode Beban Ringan" trim appointment / recap /
  // package reads. A pure passthrough unless that mode is on.
  global: { fetch: lightLoadFetch },
})

configureLightLoadMode({
  authProvider: async () => {
    const { data } = await customSupabaseClient.auth.getSession();
    const accessToken = data?.session?.access_token;
    return accessToken ? { accessToken, apikey: supabaseAnonKey, baseUrl: supabaseUrl } : null;
  },
});

export default customSupabaseClient;

export {
    customSupabaseClient,
    customSupabaseClient as supabase,
    supabaseUrl,
    supabaseAnonKey,
};
