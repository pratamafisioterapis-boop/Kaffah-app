import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Database, Plus } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { normalizePatient } from '@/lib/patientHelpers';
import { useToast } from "@/components/ui/use-toast";
import CenteredPatientTable from '@/components/shared/CenteredPatientTable';
import PatientModal from '@/components/shared/PatientModal';

const DatabasePatients = () => {
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
        <div className="space-y-6 p-6 pb-20 bg-slate-50 min-h-screen">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                        <Database className="w-6 h-6 text-indigo-600" />
                        Database Pasien
                    </h1>
                    <p className="text-slate-500 mt-1">
                        Total {pagination.totalItems} pasien terdaftar dalam sistem.
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button onClick={handleRefresh} variant="outline" size="sm">
                        Refresh Data
                    </Button>
                    <Button onClick={handleAddClick} className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
                        <Plus className="w-4 h-4" /> Tambah Pasien
                    </Button>
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

export default DatabasePatients;