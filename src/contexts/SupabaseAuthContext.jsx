import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import {
  registerPushNotifications,
  listenForegroundNotifications
} from '@/lib/pushNotifications';
import { useToast } from '@/components/ui/use-toast';

const AuthContext = createContext(undefined);

export const AuthProvider = ({ children }) => {
  const { toast } = useToast();
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [userDetails, setUserDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const isPWA = useMemo(() => {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator?.standalone === true
  );
}, []);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  // Ref to track if we are currently handling a session update to prevent loops
  const isHandlingSession = useRef(false);
  const retryCount = useRef(0);
  const MAX_RETRIES = 3;

  // Monitor online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

    // Also clear supabase specific keys
    const clearLocalState = useCallback(() => {
  setUser(null);
  setSession(null);
  setUserDetails(null);
  retryCount.current = 0;
}, []);


  // Fetch additional user details from public.users table
  const fetchUserDetails = useCallback(async (userId) => {
    try {
      if (!userId) return null;
      if (!navigator.onLine) return null;

      console.log(`[AuthContext] Fetching user details for: ${userId}`);
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (error) {
        if (error.message !== 'Failed to fetch' && !error.message.includes('Network request failed')) {
            console.warn('[AuthContext] User details fetch warning:', error.message);
        }
        return null;
      }
      return data;
    } catch (error) {
      console.error('[AuthContext] Unexpected error fetching user details:', error);
      return null;
    }
  }, []);

  // Centralized session handler
  const handleSession = useCallback(async (currentSession) => {
    if (isHandlingSession.current) return;
    isHandlingSession.current = true;

    try {
      if (!currentSession) {
          clearLocalState();
          return;
      }

      // Basic validation of session structure
      if (!currentSession.user || !currentSession.access_token) {
        console.warn("[AuthContext] Invalid session structure detected during handleSession");
        clearLocalState();
        return;
      }

      // Check if session is expired
      if (currentSession.expires_at && currentSession.expires_at * 1000 < Date.now()) {
         console.log("[AuthContext] Session expired, attempting refresh...");
         const { data, error } = await supabase.auth.refreshSession();
         if (error || !data.session) {
             throw new Error("Session refresh failed");
         }
         currentSession = data.session;
      }

      setSession(currentSession);
      const currentUser = currentSession.user;
      setUser(currentUser);

      // Verify auth.uid() availability implicitly by ensuring user exists
      if (currentUser && currentUser.id) {
        console.log("[AuthContext] Session handled successfully for user:", currentUser.id);
        const details = await fetchUserDetails(currentUser.id);
        setUserDetails(details);

      } else {
        console.error("[AuthContext] Critical: Session exists but user ID is missing");
        setUserDetails(null);
      }
      
      // Reset retry count on successful session handle
      retryCount.current = 0;
    } catch (err) {
      console.error("[AuthContext] Error handling session:", err);
      
      const isNetworkError = err.message === 'Failed to fetch' || err.message?.includes('Network request failed');
      
      if (isNetworkError && retryCount.current < MAX_RETRIES) {
        retryCount.current++;
        console.log(`[AuthContext] Retrying session handle (${retryCount.current}/${MAX_RETRIES})...`);
        setTimeout(() => {
            isHandlingSession.current = false;
            handleSession(currentSession);
        }, 1000 * retryCount.current);
        return; 
      } else {
        console.error("[AuthContext] Max retries reached or non-retryable error. Clearing state.");
        clearLocalState();
      }
    } finally {
      setLoading(false);
      isHandlingSession.current = false;
    }
  }, [fetchUserDetails, clearLocalState]);

  // Initialize Auth & Setup Listener
  useEffect(() => {
    let mounted = true;
    console.log("[AuthContext] Initializing...");
    
    const initializeAuth = async () => {
      try {
        // Attempt to recover session from local storage first (implicit in getSession)
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
           console.warn(`[AuthContext] Session initialization error:`, error.message);
           if (
  error.message.includes('refresh_token_not_found') ||
  error.message.includes('Invalid Refresh Token')
) {
  await supabase.auth.signOut();
  if (mounted) clearLocalState();
}
        }

        if (mounted) {
          if (data?.session) {
            await handleSession(data.session);
          } else {
            // Tidak ada session — tapi jika offline, jangan paksa logout
            // Biarkan user tetap di halaman, tunggu koneksi kembali
            if (!navigator.onLine) {
              console.log('[AuthContext] Offline on init, skipping clearLocalState');
            } else {
              clearLocalState();
            }
          }
        }
      } catch (error) {
        console.error('[AuthContext] Unexpected error checking auth session:', error);
        if (mounted) clearLocalState();
      } finally {
        if (mounted) setLoading(false);
      }
    };

    initializeAuth();

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        if (!mounted) return;
        console.log(`[AuthContext] Auth state changed: ${event}`);
        
        // Sync across tabs
        if (event === 'SIGNED_OUT' || event === 'USER_DELETED') {
            clearLocalState();
            setLoading(false);
        } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
            await handleSession(currentSession);
        } else if (event === 'TOKEN_REFRESH_ERROR') {
            console.error('[AuthContext] Token refresh error detected, attempting recovery...');
            // Jangan langsung logout — coba refresh manual dulu
            try {
              const { data: recovered, error: recoverErr } = await supabase.auth.refreshSession();
              if (!recoverErr && recovered?.session) {
                console.log('[AuthContext] Session recovered after TOKEN_REFRESH_ERROR');
                await handleSession(recovered.session);
                return;
              }
            } catch (e) {
              console.error('[AuthContext] Recovery attempt failed:', e);
            }
            // Hanya logout jika recovery benar-benar gagal
            await supabase.auth.signOut();
            clearLocalState();
            setLoading(false);
            toast({
              variant: "destructive",
              title: "Sesi Berakhir",
              description: "Silakan login kembali untuk melanjutkan.",
            });
        }
      }
    );

    // Saat kembali online, coba recover session
    const handleReconnect = async () => {
      console.log('[AuthContext] Back online, attempting session recovery...');
      const { data, error } = await supabase.auth.getSession();
      if (!error && data?.session && mounted) {
        await handleSession(data.session);
      }
    };
    window.addEventListener('online', handleReconnect);

    return () => {
      mounted = false;
      subscription.unsubscribe();
      window.removeEventListener('online', handleReconnect);
    };
  }, [handleSession, clearLocalState, toast]);

  const signUp = useCallback(async (email, password, options) => {
    if (!isOnline) {
        return { data: null, error: { message: "Tidak ada koneksi internet. Mohon periksa jaringan Anda." } };
    }
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options,
      });

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error("[AuthContext] Sign up error:", error);
      return { data: null, error };
    }
  }, [isOnline]);

  const signIn = useCallback(async (email, password) => {
    if (!isOnline) {
        return { data: null, error: { message: "Tidak ada koneksi internet. Mohon periksa jaringan Anda." } };
    }
    try {
      if (!email || !password) {
        throw new Error("Email and password are required.");
      }

      console.log(`[AuthContext] Attempting to sign in: ${email}`);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        if (error.message === 'Invalid login credentials') {
          throw new Error('Email atau password salah. Silakan coba lagi.');
        }
        throw error;
      }
      
      console.log(`[AuthContext] Sign in successful`);
      return { data, error: null };
    } catch (error) {
      console.error("[AuthContext] Sign in error:", error);
      return { data: null, error };
    }
  }, [isOnline]);

  const signOut = useCallback(async () => {
    try {
      console.log("[AuthContext] Signing out...");
      const { error } = await supabase.auth.signOut();
      clearLocalState();
      if (error) console.error("[AuthContext] Server sign out error:", error);
      return { error: null };
    } catch (error) {
      console.error("[AuthContext] Sign out exception:", error);
      clearLocalState();
      return { error };
    }
  }, [clearLocalState]);

  const refreshSession = useCallback(async () => {
    if (!isOnline) {
        return { data: null, error: { message: "Tidak ada koneksi internet." } };
    }
    try {
      const { data: currentSessionData } = await supabase.auth.getSession();
      
      if (!currentSessionData?.session?.refresh_token) {
         console.warn("[AuthContext] No refresh token available for manual refresh.");
         await signOut();
         return { data: null, error: new Error("No session to refresh") };
      }

      const { data, error } = await supabase.auth.refreshSession();
      
      if (error) {
        if (error.message.includes('refresh_token_not_found') || error.message.includes('Invalid Refresh Token')) {
            console.error("[AuthContext] Refresh token invalid during manual refresh. Signing out.");
            await signOut();
            toast({
                variant: "destructive",
                title: "Sesi Kadaluarsa",
                description: "Mohon login kembali."
            });
        }
        throw error;
      }
      
      if (data.session) {
        await handleSession(data.session);
      }
      return { data, error: null };
    } catch (error) {
      console.error("[AuthContext] Manual refresh session error:", error);
      return { data: null, error };
    }
  }, [handleSession, signOut, isOnline, toast]);

  const role = useMemo(() => {
    return userDetails?.role || user?.user_metadata?.role || 'guest';
  }, [userDetails, user]);
  useEffect(() => {
  listenForegroundNotifications();
}, []);
useEffect(() => {
  if (!user?.id) return;

  

  registerPushNotifications(user.id);

}, [user]);
  const value = useMemo(() => ({
    user,
    session,
    userDetails,
    role,
    loading,
    isOnline,
    signUp,
    signIn,
    signOut,
    refreshSession
  }), [user, session, userDetails, role, loading, isOnline, signUp, signIn, signOut, refreshSession]);
  
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};