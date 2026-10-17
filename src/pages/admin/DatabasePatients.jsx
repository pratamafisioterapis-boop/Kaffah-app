import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Database, Plus, Upload } from 'lucide-react';
import { usePatientList } from '@/hooks/usePatientList';
import CenteredPatientTable from '@/components/shared/CenteredPatientTable';
import PatientModal from '@/components/shared/PatientModal';
import ImportPatientExcelModal from '@/components/shared/ImportPatientExcelModal';
import PageHero from '@/components/shared/PageHero';

const AdminDatabasePatients = () => {

    const {
        patients, loading, pagination, filters,
        setPagination, handleFilterChange, refresh: handleRefresh
    } = usePatientList();

    // Modal State
    const [modalOpen, setModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState('add');
    const [selectedPatient, setSelectedPatient] = useState(null);
    const [isImportOpen, setIsImportOpen] = useState(false);

    const handlePaginationChange = (newPagination) => {
        setPagination(newPagination);
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
            <div className="flex flex-nowrap items-center justify-end gap-2 !mt-5 sm:!mt-6">
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

export default AdminDatabasePatients;