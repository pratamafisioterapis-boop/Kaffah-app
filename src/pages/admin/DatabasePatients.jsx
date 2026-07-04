import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Database, Plus } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { normalizePatient } from '@/lib/patientHelpers';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from "@/components/ui/use-toast";
import CenteredPatientTable from '@/components/shared/CenteredPatientTable';
import PatientModal from '@/components/shared/PatientModal';

const AdminDatabasePatients = () => {
   
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
            {/* Hero Banner */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white p-5 md:p-7 shadow-xl">
              <div className="absolute -top-8 -right-8 w-40 h-40 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -bottom-6 -left-6 w-32 h-32 bg-blue-500/15 rounded-full blur-2xl pointer-events-none" />
              <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="flex-shrink-0 w-11 h-11 md:w-12 md:h-12 rounded-xl bg-indigo-600/80 flex items-center justify-center shadow-lg">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 md:w-6 md:h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-indigo-300 text-xs font-semibold uppercase tracking-widest mb-1">{useAuth().clinicName || 'Kaffah Physiotherapy'}</p>
                    <h1 className="text-lg md:text-2xl font-bold tracking-tight">Database Pasien</h1>
                    <p className="text-slate-400 text-xs mt-1">Total {pagination.totalItems} pasien terdaftar dalam sistem.</p>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0 w-full sm:w-auto">
                  <Button onClick={handleRefresh} variant="outline" size="sm" className="bg-white/10 border-white/20 text-white hover:bg-white/20">
                    Refresh Data
                  </Button>
                  <Button onClick={handleAddClick} className="bg-indigo-600 hover:bg-indigo-500 border border-indigo-400/50 text-white gap-2">
                    <Plus className="w-4 h-4" /> Tambah Pasien
                  </Button>
                </div>
              </div>
            </div>

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

export default AdminDatabasePatients;