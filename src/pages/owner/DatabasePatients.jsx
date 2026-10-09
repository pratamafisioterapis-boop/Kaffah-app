import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Database, Plus, Upload, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { normalizePatient } from '@/lib/patientHelpers';
import { useToast } from "@/components/ui/use-toast";
import CenteredPatientTable from '@/components/shared/CenteredPatientTable';
import PatientModal from '@/components/shared/PatientModal';
import ImportPatientExcelModal from '@/components/shared/ImportPatientExcelModal';
import { getCachedClinicId } from '@/lib/api';
import PageHero from '@/components/shared/PageHero';

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
    const [isImportOpen, setIsImportOpen] = useState(false);

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

            const { data: sessionData } = await supabase.auth.getSession();
            const userId = sessionData?.session?.user?.id;
            const userRow = { clinic_id: await getCachedClinicId(userId) };

            let query = supabase
                .from('patients')
                .select('*, patient_info_options(label)', { count: 'exact' })
                .eq('clinic_id', userRow?.clinic_id);

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
            {/* Hero Banner */}
            <PageHero image="/hero/clinara-patients-hero.webp" title="Database" highlight="Pasien" description={<>Total {pagination.totalItems} pasien terdaftar dalam sistem.</>} />

            {/* Toolbar */}
            <div className="flex flex-nowrap items-center justify-center gap-2 !mt-5 sm:!mt-6">
              <Button
                onClick={handleRefresh}
                variant="outline"
                className="h-9 px-3 rounded-app gap-1.5 text-xs sm:text-sm font-semibold shadow-none active:scale-[0.97] transition-[color,background-color,border-color,box-shadow,transform,opacity] [&_svg]:w-4 [&_svg]:h-4 [&_svg]:mr-0 [&_svg]:shrink-0 border border-[#DCE7F1] bg-[#F1F6FC] text-app-ink hover:bg-[#E4EFFA]"
              >
                <RefreshCw className="w-4 h-4 shrink-0" strokeWidth={2.1} />
                <span className="whitespace-nowrap"><span className="sm:hidden">Refresh</span><span className="hidden sm:inline">Refresh Data</span></span>
              </Button>
              <Button
                onClick={() => setIsImportOpen(true)}
                variant="outline"
                className="h-9 px-3 rounded-app gap-1.5 text-xs sm:text-sm font-semibold shadow-none active:scale-[0.97] transition-[color,background-color,border-color,box-shadow,transform,opacity] [&_svg]:w-4 [&_svg]:h-4 [&_svg]:mr-0 [&_svg]:shrink-0 border border-[#DCE6EF] bg-white text-app-ink hover:bg-[#F5F9FC]"
              >
                <Upload className="w-4 h-4 shrink-0" strokeWidth={2.1} />
                <span className="whitespace-nowrap"><span className="sm:hidden">Import</span><span className="hidden sm:inline">Import Excel</span></span>
              </Button>
              <Button
                onClick={handleAddClick}
                className="h-9 px-3 rounded-app gap-1.5 text-xs sm:text-sm font-semibold shadow-none active:scale-[0.97] transition-[color,background-color,border-color,box-shadow,transform,opacity] [&_svg]:w-4 [&_svg]:h-4 [&_svg]:mr-0 [&_svg]:shrink-0 bg-[#1683F4] hover:bg-app-accent-hover text-white shadow-sm shadow-app-accent/25"
              >
                <Plus className="w-4 h-4 shrink-0" strokeWidth={2.2} />
                <span className="whitespace-nowrap"><span className="sm:hidden">Tambah</span><span className="hidden sm:inline">Tambah Pasien</span></span>
              </Button>
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

            {/* Import Excel Modal */}
            <ImportPatientExcelModal
                isOpen={isImportOpen}
                onClose={() => setIsImportOpen(false)}
                onSuccess={handleRefresh}
            />
        </div>
    );
};

export default DatabasePatients;