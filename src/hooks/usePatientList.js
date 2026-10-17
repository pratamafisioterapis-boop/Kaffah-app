import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { getCachedClinicId } from '@/lib/api';
import { normalizePatient } from '@/lib/patientHelpers';
import { getCachedData, setCachedData, clearCachedData } from '@/lib/dataCache';
import { useToast } from '@/components/ui/use-toast';

const ITEMS_PER_PAGE = 20;
const CACHE_PREFIX = 'patients:';
const DEFAULT_FILTERS = { search: '', completeness: 'all', status: 'all' };

const buildKey = (page, filters) => `${CACHE_PREFIX}${page}:${ITEMS_PER_PAGE}:${JSON.stringify(filters)}`;

// Strip characters that have meaning inside a PostgREST .or() filter string.
const sanitizeSearch = (value) => value.trim().replace(/[,()%*\\]/g, ' ');

/**
 * Shared data layer for the Database Pasien page (owner + admin).
 *
 * - Shows the last known result instantly (module-level cache) and revalidates
 *   in the background, so switching menus back doesn't blank the table.
 * - Keeps the previous rows on screen while a new search/page loads instead of
 *   replacing the table with a spinner.
 * - Ignores out-of-order responses, so fast typing can't show stale results.
 */
export const usePatientList = () => {
    const { toast } = useToast();
    const initial = getCachedData(buildKey(1, DEFAULT_FILTERS));

    const [patients, setPatients] = useState(initial?.patients || []);
    const [loading, setLoading] = useState(!initial);
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [filters, setFilters] = useState(DEFAULT_FILTERS);
    const [pagination, setPagination] = useState({
        page: 1,
        itemsPerPage: ITEMS_PER_PAGE,
        totalItems: initial?.totalItems || 0,
        totalPages: initial?.totalPages || 1
    });

    const requestId = useRef(0);
    const { page } = pagination;

    useEffect(() => {
        const id = ++requestId.current;
        const isCurrent = () => id === requestId.current;
        const cacheKey = buildKey(page, filters);

        const cached = refreshTrigger === 0 ? getCachedData(cacheKey) : null;
        if (cached) {
            setPatients(cached.patients);
            setPagination(prev => ({ ...prev, totalItems: cached.totalItems, totalPages: cached.totalPages }));
            setLoading(false);
        } else {
            setLoading(true);
        }

        const load = async () => {
            try {
                const from = (page - 1) * ITEMS_PER_PAGE;
                const to = from + ITEMS_PER_PAGE - 1;

                const { data: sessionData } = await supabase.auth.getSession();
                const clinicId = await getCachedClinicId(sessionData?.session?.user?.id);

                let query = supabase
                    .from('patients')
                    .select('*, patient_info_options(label)', { count: 'exact' })
                    .eq('clinic_id', clinicId);

                if (filters.status !== 'all') {
                    query = query.eq('status', filters.status);
                }

                const term = sanitizeSearch(filters.search);
                if (term) {
                    query = query.or(`full_name.ilike.%${term}%,medical_record_number.ilike.%${term}%,phone.ilike.%${term}%`);
                }

                const { data, error, count } = await query
                    .order('created_at', { ascending: false })
                    .range(from, to);

                if (error) throw error;
                if (!isCurrent()) return;

                let rows = (data || []).map(p => normalizePatient(p));
                if (filters.completeness !== 'all') {
                    rows = rows.filter(p => (filters.completeness === 'complete' ? p.isComplete : !p.isComplete));
                }

                const totalItems = count || 0;
                const totalPages = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE));

                setPatients(rows);
                setPagination(prev => ({ ...prev, totalItems, totalPages }));
                setCachedData(cacheKey, { patients: rows, totalItems, totalPages });
            } catch (error) {
                console.error('Error fetching patients:', error);
                if (isCurrent() && !cached) {
                    toast({
                        variant: 'destructive',
                        title: 'Error',
                        description: 'Gagal memuat data pasien.'
                    });
                }
            } finally {
                if (isCurrent()) setLoading(false);
            }
        };

        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, filters, refreshTrigger]);

    const handleFilterChange = useCallback((newFilters) => {
        setFilters(newFilters);
        setPagination(prev => ({ ...prev, page: 1 }));
    }, []);

    const refresh = useCallback(() => {
        clearCachedData(CACHE_PREFIX);
        setRefreshTrigger(prev => prev + 1);
    }, []);

    return {
        patients,
        loading,
        pagination,
        filters,
        setPagination,
        handleFilterChange,
        refresh
    };
};
