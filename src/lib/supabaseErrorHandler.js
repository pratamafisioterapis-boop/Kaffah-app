import { supabase } from '@/lib/customSupabaseClient';

/**
 * Standardized error handler for Supabase/API errors
 * @param {Error|Object} error - The error object
 * @param {string} context - The function or context where error occurred
 * @returns {Object} Standardized error response { success: false, error: { message, code, ... } }
 */
export const handleSupabaseError = (error, context = 'Unknown Context') => {
  // Safely access error properties
  const errorMessage = error?.message || 'An unexpected error occurred';
  const errorCode = error?.code || 'UNKNOWN_ERROR';
  const errorDetails = error?.details || null;
  const errorHint = error?.hint || null;

  // Detect specific error types
  const isNetworkError = 
    errorMessage === 'Failed to fetch' || 
    errorMessage.includes('Network request failed') ||
    errorMessage.includes('connection') ||
    errorMessage.includes('upstream') ||
    errorMessage.includes('timeout');

  const isAuthError = 
    errorCode === '401' || 
    errorCode === 'PGRST301' || 
    errorMessage.toLowerCase().includes('jwt') ||
    errorMessage.toLowerCase().includes('unauthorized');

  const isCorsError = errorMessage.toLowerCase().includes('cors') || errorMessage.toLowerCase().includes('access-control');

  // Log detailed error for debugging
  console.error(`[Supabase Error] in ${context}:`, {
    message: errorMessage,
    code: errorCode,
    details: errorDetails,
    hint: errorHint,
    isNetworkError,
    isAuthError,
    originalError: error
  });

  // Construct user-friendly message
  let userMessage = errorMessage;
  if (isNetworkError) {
    userMessage = 'Masalah koneksi internet. Silakan periksa koneksi Anda.';
  } else if (isCorsError) {
    userMessage = 'Terjadi kesalahan akses (CORS). Silakan coba lagi.';
  } else if (isAuthError) {
    userMessage = 'Sesi Anda telah berakhir. Silakan login kembali.';
  }

  return { 
    success: false,
    data: null,
    error: { 
      message: userMessage, 
      originalError: error, 
      code: errorCode,
      context,
      isNetworkError,
      isAuthError
    }
  };
};

/**
 * Retry mechanism with exponential backoff
 * @param {Function} operation - Async function to retry
 * @param {number} maxRetries - Maximum number of retries
 * @param {string} context - Context for logging
 */
export const retryWithBackoff = async (operation, maxRetries = 3, context = 'operation') => {
  let lastError;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      const errorMessage = error?.message || '';
      
      // Determine if error is retryable (Network errors or 5xx server errors)
      const isNetworkError = 
        errorMessage === 'Failed to fetch' || 
        errorMessage.includes('Network request failed') ||
        errorMessage.includes('connection') || 
        errorMessage.includes('timeout');
        
      const isServerError = error?.code && (error.code.startsWith('5') || error.code === 'PGRST000'); 
      
      // Don't retry if it's definitely a client error (unless it's a timeout/fetch error)
      if (!isNetworkError && !isServerError) {
        throw error; 
      }

      if (i === maxRetries - 1) break;

      // Exponential backoff: 1s, 2s, 4s...
      const delay = 1000 * Math.pow(2, i);
      console.warn(`[Retry] ${context} (${i + 1}/${maxRetries}) in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
};

/**
 * Wrapper for Supabase queries to handle errors, retries, and timeouts automatically
 * @param {Function} queryFn - Async function performing the query
 * @param {string} context - Name of the function for logging
 * @param {Object} options - { retry: boolean, timeout: number }
 */
export const safeQuery = async (queryFn, context, options = { retry: false, timeout: 30000 }) => {
  try {
    const execute = async () => {
      // Check online status first (browser only)
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        throw new Error('Network request failed: Offline'); 
      }

      // Create a timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Network timeout: Request took too long')), options.timeout || 30000);
      });

      // Race the query against the timeout
      const result = await Promise.race([
        queryFn(),
        timeoutPromise
      ]);
      
      // Supabase returns { error } object, it doesn't throw by default
      if (result && result.error) {
        throw result.error;
      }
      
      return result;
    };

    if (options.retry) {
      return await retryWithBackoff(execute, 3, context);
    } else {
      return await execute();
    }
  } catch (error) {
    return handleSupabaseError(error, context);
  }
};

/**
 * Validates the Supabase connection on app startup
 * @returns {Promise<boolean>}
 */
export const validateSupabaseConnection = async () => {
  try {
    console.log('[Supabase] Validating connection...');
    
    // Check if env vars are present
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!url || !key) {
      console.error('[Supabase] Missing environment variables!');
      return false;
    }

    // Simple lightweight query to check connection
    // We check 'operational_options' as it's a public read table usually, or check auth session
    const { error } = await supabase.from('operational_options').select('count', { count: 'exact', head: true }).limit(1);
    
    if (error) {
      // If table doesn't exist or permission denied, that's still a connection (just 404 or 403)
      // We only care about network errors here
      if (error.message && (error.message.includes('fetch') || error.message.includes('connection'))) {
         console.error('[Supabase] Connection validation failed:', error);
         return false;
      }
    }
    
    console.log('[Supabase] Connection verified successfully.');
    return true;
  } catch (err) {
    console.error('[Supabase] Unexpected error during validation:', err);
    return false;
  }
};