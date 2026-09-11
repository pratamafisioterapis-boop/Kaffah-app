import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Database, Plus, Upload, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { normalizePatient } from '@/lib/patientHelpers';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from "@/components/ui/use-toast";
import CenteredPatientTable from '@/components/shared/CenteredPatientTable';
import PatientModal from '@/components/shared/PatientModal';
import ImportPatientExcelModal from '@/components/shared/ImportPatientExcelModal';

const AdminDatabasePatients = () => {

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
            const { data: userRow } = await supabase.from('users').select('clinic_id').eq('id', userId).single();

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
            <div className="relative overflow-hidden rounded-[18px] sm:rounded-[22px] border border-[#DCE8F2] shadow-sm h-44 sm:h-52 md:h-60 lg:h-72">
              <img
                src="/hero/clinara-patients-hero.webp"
                alt="Kaffah Physiotherapy"
                className="absolute inset-0 w-full h-full object-cover object-[38%_center]"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-white via-white/85 via-50% to-transparent to-80% pointer-events-none" aria-hidden="true" />
              <div className="absolute inset-0 flex flex-col justify-center px-4 sm:px-6 md:px-10 lg:px-14">
                <div className="max-w-[74%] sm:max-w-[62%] md:max-w-sm">
                  <p className="text-[#5B6B7D] text-xs sm:text-sm font-medium mb-1">{useAuth().clinicName || ''}</p>
                  <h1
                    style={{ fontFamily: "'Caveat', cursive" }}
                    className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-[#102F52] leading-[0.85]"
                  >
                    Database<br />
                    <span className="text-[#2F8CFF] underline decoration-wavy decoration-2 md:decoration-[3px] underline-offset-4 md:underline-offset-8">
                      Pasien
                    </span>
                  </h1>
                  <p className="text-[#5B6B7D] text-[10px] sm:text-xs md:text-sm mt-1.5 md:mt-3 leading-snug md:leading-relaxed">
                    Total {pagination.totalItems} pasien terdaftar dalam sistem.
                  </p>
                </div>
              </div>
            </div>

            {/* Toolbar */}
            <div className="flex flex-nowrap items-center justify-end gap-2 sm:gap-3 md:gap-4 !mt-8 sm:!mt-10 md:!mt-12">
              <Button
                onClick={handleRefresh}
                variant="outline"
                className="h-11 sm:h-12 md:h-14 px-3 sm:px-4 rounded-2xl border border-[#DCE7F1] bg-[#F1F6FC] text-[#102F52] font-semibold text-xs sm:text-sm md:text-base gap-1.5 sm:gap-2 shadow-sm hover:bg-[#E4EFFA] active:scale-[0.97] transition-all duration-200 ease-in-out"
              >
                <RefreshCw className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" strokeWidth={2.1} />
                <span className="whitespace-nowrap">Refresh Data</span>
              </Button>
              <Button
                onClick={() => setIsImportOpen(true)}
                variant="outline"
                className="h-11 sm:h-12 md:h-14 px-3 sm:px-4 rounded-2xl border border-[#DCE6EF] bg-white text-[#102F52] font-semibold text-xs sm:text-sm md:text-base gap-1.5 sm:gap-2 shadow-sm hover:bg-[#F5F9FC] active:scale-[0.97] transition-all duration-200 ease-in-out"
              >
                <Upload className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" strokeWidth={2.1} />
                <span className="whitespace-nowrap">Import Excel</span>
              </Button>
              <Button
                onClick={handleAddClick}
                className="h-11 sm:h-12 md:h-14 px-4 sm:px-5 rounded-2xl bg-[#1683F4] hover:bg-[#125fac] text-white font-semibold text-xs sm:text-sm md:text-base gap-1.5 sm:gap-2 shadow-[0_6px_14px_-4px_rgba(22,131,244,0.45)] active:scale-[0.97] transition-all duration-200 ease-in-out"
              >
                <Plus className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" strokeWidth={2.2} />
                <span className="whitespace-nowrap">Tambah Pasien</span>
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

export default AdminDatabasePatients;