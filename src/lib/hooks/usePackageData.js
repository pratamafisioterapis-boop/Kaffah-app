import { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';

/**
 * Hook to fetch package configuration from operational_options table.
 * @param {string} packageName - The name of the package to look up (label in DB).
 * @returns {object} - { packageData, loading, error }
 */
export const usePackageData = (packageName) => {
  const [packageData, setPackageData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchPackageData = async () => {
      if (!packageName) {
        setPackageData(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const cleanName = packageName.trim();
        
        // Query operational_options for matching label in package categories
        const { data, error } = await supabase
          .from('operational_options')
          .select('*')
          .in('category', ['tipe_paket', 'package_type'])
          .ilike('label', cleanName)
          .eq('is_active', true)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          setPackageData({
            id: data.id,
            name: data.label,
            sessionCount: data.session_count || 1, 
            validityDays: data.validity_days || 30, 
            category: data.category
          });
        } else {
          // Fallback parsing
          const match = cleanName.match(/(\d+)\s*(sesi|visit|x)/i);
          const parsedCount = match ? parseInt(match[1]) : 1;
          
          setPackageData({
            id: null,
            name: cleanName,
            sessionCount: parsedCount,
            validityDays: 30,
            isFallback: true
          });
        }
      } catch (err) {
        console.error("Error fetching package data:", err);
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    fetchPackageData();
  }, [packageName]);

  return { packageData, loading, error };
};

/**
 * Hook to fetch ALL package definitions at once for lists.
 * @returns {object} - { packageDefinitions, loading, error }
 */
export const useAllPackageDefinitions = () => {
    const [definitions, setDefinitions] = useState({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchAll = async () => {
            try {
                const { data, error } = await supabase
                    .from('operational_options')
                    .select('*')
                    .in('category', ['tipe_paket', 'package_type'])
                    .eq('is_active', true);
                
                if (error) throw error;

                const defMap = {};
                (data || []).forEach(opt => {
                    if (opt.label) {
                        defMap[opt.label.toLowerCase().trim()] = {
                            id: opt.id,
                            label: opt.label,
                            sessionCount: opt.session_count || 1,
                            validityDays: opt.validity_days || 30
                        };
                    }
                });
                setDefinitions(defMap);
            } catch (err) {
                console.error("Error fetching all package definitions:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchAll();
    }, []);

    return { definitions, loading };
};

// Task 6: Add hook to query package_tracking by ID
export const usePackageTracking = (packageId) => {
  const [packageData, setPackageData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!packageId) return;
    const fetch = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('package_tracking')
          .select('*, patient:patients(*)')
          .eq('id', packageId)
          .single();
        if (error) throw error;
        setPackageData(data);
      } catch (err) {
        setError(err);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [packageId]);

  return { packageData, loading, error };
};