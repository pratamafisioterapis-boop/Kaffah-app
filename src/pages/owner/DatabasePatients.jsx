import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Database, Plus } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { normalizePatient } from '@/lib/patientHelpers';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from "@/components/ui/use-toast";
import CenteredPatientTable from '@/components/shared/CenteredPatientTable';
import PatientModal from '@/components/shared/PatientModal';

const DatabasePatients = () => {
    const isPWA = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    const { toast } = useToast();
    const [patients, setPatients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    // Modal State
    const [modalOpen, setModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState('add');
    const [selectedPatient, setSelectedPatient] = useState(null);

    // State for Table
    const [pagination, setPagination] = useState({
        page: 1,
        itemsPerPage: 20,
        totalItems: 0,
        totalPages: 1
    });

    const [filters, setFilters] = useState({
        search: '',
        completeness: 'all',
        status: 'all'
    });

    useEffect(() => {
        fetchPatients();
    }, [pagination.page, pagination.itemsPerPage, filters, refreshTrigger]);

    const fetchPatients = async () => {
        setLoading(true);
        try {
            // Calculate range for pagination
            const from = (pagination.page - 1) * pagination.itemsPerPage;
            const to = from + pagination.itemsPerPage - 1;

            let query = supabase
                .from('patients')
                .select('*, patient_info_options(label)', { count: 'exact' });

            // Apply Status Filter (DB Side)
            if (filters.status !== 'all') {
                query = query.eq('status', filters.status);
            }

            // Apply Search (DB Side - ILIKE)
            if (filters.search) {
                query = query.or(`full_name.ilike.%${filters.search}%,medical_record_number.ilike.%${filters.search}%,phone.ilike.%${filters.search}%`);
            }

            // Fetch Data
            const { data, error, count } = await query
                .order('created_at', { ascending: false })
                .range(from, to);

            if (error) throw error;

            let normalizedData = (data || []).map(p => normalizePatient(p));

            if (filters.completeness !== 'all') {
                normalizedData = normalizedData.filter(p => 
                    filters.completeness === 'complete' ? p.isComplete : !p.isComplete
                );
            }

            setPatients(normalizedData);
            setPagination(prev => ({
                ...prev,
                totalItems: count || 0,
                totalPages: Math.ceil((count || 0) / prev.itemsPerPage)
            }));

        } catch (error) {
            console.error("Error fetching patients:", error);
            toast({
                variant: "destructive",
                title: "Error",
                description: "Gagal memuat data pasien."
            });
        } finally {
            setLoading(false);
        }
    };

    const handlePaginationChange = (newPagination) => {
        setPagination(newPagination);
    };

    const handleFilterChange = (newFilters) => {
        setFilters(newFilters);
        // Reset to page 1 on filter change
        setPagination(prev => ({ ...prev, page: 1 }));
    };

    const handleRefresh = () => {
        setRefreshTrigger(prev => prev + 1);
    };

    const handleAddClick = () => {
        setModalMode('add');
        setSelectedPatient(null);
        setModalOpen(true);
    };

    const handleRowClick = (patient) => {
        setModalMode('edit');
        setSelectedPatient(patient);
        setModalOpen(true);
    };

    return (
        <div className="space-y-6">
            {/* Hero Banner — sembunyikan di PWA */}
            {!isPWA && (
            <div className="w-full rounded-2xl overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 shadow-xl border border-slate-700/50 relative">
              <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle, #6366f1 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
              <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-5 py-5 sm:px-7 sm:py-6">
                <div className="flex items-center gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-indigo-600/80 flex items-center justify-center shadow-lg">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs font-bold tracking-widest text-indigo-300 uppercase mb-1">{useAuth().clinicName || 'Kaffah Physiotherapy'}</p>
                    <h2 className="text-lg sm:text-xl font-bold text-white leading-tight">Database Pasien</h2>
                    <p className="text-sm text-slate-400 mt-0.5">Total {pagination.totalItems} pasien terdaftar dalam sistem</p>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button onClick={handleRefresh} variant="outline" size="sm" className="bg-white/10 border-white/20 text-white hover:bg-white/20">
                    Refresh Data
                  </Button>
                  <Button onClick={handleAddClick} className="bg-indigo-600 hover:bg-indigo-500 border border-indigo-400/50 text-white gap-2">
                    <Plus className="w-4 h-4" /> Tambah Pasien
                  </Button>
                </div>
              </div>
            </div>
            )}

            {/* PWA Header */}
            {isPWA && (
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Database Pasien</h2>
                <p className="text-xs text-slate-500">{pagination.totalItems} pasien terdaftar</p>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleRefresh} variant="outline" size="sm" className="h-9">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </Button>
                <Button onClick={handleAddClick} className="bg-indigo-600 hover:bg-indigo-500 text-white gap-2 h-9">
                  <Plus className="w-4 h-4" /> Tambah
                </Button>
              </div>
            </div>
            )}

            {/* Patient Table Component */}
            <CenteredPatientTable 
                patients={patients}
                loading={loading}
                pagination={pagination}
                filters={filters}
                onPaginationChange={handlePaginationChange}
                onFilterChange={handleFilterChange}
                onRefresh={handleRefresh}
                onRowClick={handleRowClick}
            />
            
            {/* Modal */}
            <PatientModal 
                isOpen={modalOpen} 
                onClose={() => setModalOpen(false)} 
                mode={modalMode} 
                patient={selectedPatient}
                onSuccess={handleRefresh}
            />
        </div>
    );
};

export default DatabasePatients;