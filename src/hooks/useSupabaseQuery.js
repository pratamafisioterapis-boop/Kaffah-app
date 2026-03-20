import { useState, useEffect, useCallback } from 'react';

/**
 * Custom hook for safe Supabase queries with error handling and loading states
 * @param {Function} queryFn - Async function that returns { data, error }
 * @param {Array} deps - Dependency array for useEffect
 * @param {Object} options - { enabled: boolean, onSuccess: function, onError: function }
 */
export const useSupabaseQuery = (queryFn, deps = [], options = {}) => {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refetchIndex, setRefetchIndex] = useState(0);

  const { enabled = true, onSuccess, onError } = options;

  const fetchData = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await queryFn();
      
      if (result.error) {
        setError(result.error);
        if (onError) onError(result.error);
      } else {
        setData(result.data);
        if (onSuccess) onSuccess(result.data);
      }
    } catch (err) {
      // This catch block handles unexpected errors that safeQuery didn't catch (unlikely)
      const unexpectedError = { 
        message: err.message || 'Unexpected error in hook', 
        originalError: err 
      };
      setError(unexpectedError);
      if (onError) onError(unexpectedError);
    } finally {
      setLoading(false);
    }
  }, [enabled, refetchIndex, ...deps]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const refetch = () => {
    setRefetchIndex(prev => prev + 1);
  };

  return { data, error, loading, refetch, setData };
};