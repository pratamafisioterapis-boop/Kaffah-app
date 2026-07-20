import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Bug, Search, Loader2, Trash2, RefreshCw, X, 
  AlertCircle, Package, FileText, User 
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { deletePackageTracking, deleteDailyRecapsByPackageType } from '@/lib/api';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { format } from 'date-fns';
import DeletePackageConfirmationModal from './DeletePackageConfirmationModal';

const DebugPackagePanel = () => {
    const { toast } = useToast();
    
    // Search State
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [searchResults, setSearchResults] = useState([]);
    
    // Selected Patient State
    const [selectedPatient, setSelectedPatient] = useState(null);
    const [isLoadingData, setIsLoadingData] = useState(false);
    const [patientPackages, setPatientPackages] = useState([]);
    const [patientRecaps, setPatientRecaps] = useState([]);

    // Delete Modal State
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [packageToDelete, setPackageToDelete] = useState(null);
    const [recapCount, setRecapCount] = useState(0);

    // Search Effect
    useEffect(() => {
        const delayDebounceFn = setTimeout(async () => {
            if (searchQuery.length >= 2) {
                performSearch();
            } else {
                setSearchResults([]);
            }
        }, 300);

        return () => clearTimeout(delayDebounceFn);
    }, [searchQuery]);

    const performSearch = async () => {
        setIsSearching(true);
        try {
            const { data, error } = await supabase
                .from('patients')
                .select('id, full_name, rm_number')
                .ilike('full_name', `%${searchQuery}%`)
                .limit(5);
            
            if (error) throw error;
            setSearchResults(data || []);
        } catch (error) {
            console.error("Search error:", error);
        } finally {
            setIsSearching(false);
        }
    };

    const handleSelectPatient = async (patient) => {
        setSelectedPatient(patient);
        setSearchQuery(''); // Clear search to hide dropdown
        setSearchResults([]);
        fetchPatientData(patient.id);
    };

    const fetchPatientData = async (patientId) => {
        setIsLoadingData(true);
        try {
            // Fetch Packages
            const { data: packages, error: pkgError } = await supabase
                .from('package_tracking')
                .select('*')
                .eq('patient_id', patientId)
                .order('start_date', { ascending: false });
            
            if (pkgError) throw pkgError;
            setPatientPackages(packages || []);

            // Fetch Recaps
            const { data: recaps, error: recapError } = await supabase
                .from('daily_recaps')
                .select('*')
                .eq('patient_id', patientId)
                .order('recap_date', { ascending: false });

            if (recapError) throw recapError;
            setPatientRecaps(recaps || []);

        } catch (error) {
            toast({
                variant: "destructive",
                title: "Error fetching data",
                description: error.message
            });
        } finally {
            setIsLoadingData(false);
        }
    };

    const handleInitiateDelete = async (pkg) => {
        if (!selectedPatient) return;

        try {
            // Fetch count of related recaps
            const { count, error } = await supabase
                .from('daily_recaps')
                .select('*', { count: 'exact', head: true })
                .eq('patient_id', pkg.patient_id)
                .ilike('package_type', pkg.package_name);

            if (error) throw error;

            setPackageToDelete({
                ...pkg,
                patient_name: selectedPatient.full_name
            });
            setRecapCount(count || 0);
            setDeleteModalOpen(true);

        } catch (error) {
            console.error("Error checking recaps:", error);
            toast({
                variant: "destructive",
                title: "Error",
                description: "Failed to check related recaps."
            });
        }
    };

    const handleConfirmDelete = async (deleteRecaps) => {
        if (!packageToDelete) return;

        try {
            // 1. Always delete the package tracking record
            const { error: pkgError } = await deletePackageTracking(packageToDelete.id);
            if (pkgError) throw pkgError;

            // 2. Optionally delete related recaps
            let message = "Package deleted successfully.";
            
            if (deleteRecaps) {
                const { count, error: recapError } = await deleteDailyRecapsByPackageType(
                    packageToDelete.patient_id, 
                    packageToDelete.package_name
                );
                
                if (recapError) throw recapError;
                message = `Package and ${count} related recaps deleted successfully.`;
            }

            toast({ 
                title: "Success", 
                description: message,
                variant: "default"
            });

            // Refresh data
            if (selectedPatient) fetchPatientData(selectedPatient.id);

        } catch (error) {
            toast({
                variant: "destructive",
                title: "Delete Failed",
                description: error.message
            });
        } finally {
            setDeleteModalOpen(false);
            setPackageToDelete(null);
        }
    };

    const clearSelection = () => {
        setSelectedPatient(null);
        setPatientPackages([]);
        setPatientRecaps([]);
        setSearchQuery('');
    };

    return (
        <Card className="border-amber-200 bg-amber-50/30 mt-6 mb-6">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-amber-800 text-lg flex items-center gap-2">
                            <Bug className="w-5 h-5" /> Patient Data Debugger
                        </CardTitle>
                        <CardDescription>
                            Search for a patient to inspect and fix package/recap inconsistencies.
                        </CardDescription>
                    </div>
                    {selectedPatient && (
                         <Button variant="ghost" size="sm" onClick={clearSelection} className="text-slate-500 hover:text-red-600">
                            <X className="w-4 h-4 mr-2" /> Close
                        </Button>
                    )}
                </div>
            </CardHeader>
            
            <CardContent className="space-y-6">
                {/* Search Section */}
                {!selectedPatient && (
                    <div className="relative max-w-md">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <Input 
                                placeholder="Search patient name..." 
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9 bg-white"
                            />
                            {isSearching && (
                                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-slate-400" />
                            )}
                        </div>
                        
                        {/* Search Results Dropdown */}
                        {searchResults.length > 0 && (
                            <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-md shadow-lg z-10 overflow-hidden">
                                {searchResults.map((patient) => (
                                    <div 
                                        key={patient.id}
                                        onClick={() => handleSelectPatient(patient)}
                                        className="p-3 hover:bg-slate-50 cursor-pointer border-b last:border-0 flex justify-between items-center"
                                    >
                                        <span className="font-medium text-slate-700">{patient.full_name}</span>
                                        <span className="text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded">{patient.rm_number || 'No RM'}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Patient Detail View */}
                {selectedPatient && (
                    <div className="space-y-6 animate-in fade-in duration-300">
                        {/* Patient Header */}
                        <div className="flex items-center gap-3 bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                            <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
                                <User className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800">{selectedPatient.full_name}</h3>
                                <p className="text-xs text-slate-500 font-mono">{selectedPatient.rm_number}</p>
                            </div>
                            <Button 
                                variant="outline" 
                                size="sm" 
                                className="ml-auto" 
                                onClick={() => fetchPatientData(selectedPatient.id)}
                                disabled={isLoadingData}
                            >
                                <RefreshCw className={`w-3.5 h-3.5 mr-2 ${isLoadingData ? 'animate-spin' : ''}`} />
                                Refresh
                            </Button>
                        </div>

                        {/* Packages Section */}
                        <div className="space-y-2">
                            <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                                <Package className="w-4 h-4" /> Package History
                            </h4>
                            <div className="bg-white rounded-md border border-slate-200 overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-slate-50">
                                            <TableHead>Package Name</TableHead>
                                            <TableHead>Start Date</TableHead>
                                            <TableHead>End Date</TableHead>
                                            <TableHead className="text-center">Sessions</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead className="text-right">Action</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {patientPackages.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={6} className="text-center py-6 text-slate-400 italic">
                                                    No packages found.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            patientPackages.map((pkg) => (
                                                <TableRow key={pkg.id}>
                                                    <TableCell className="font-medium">{pkg.package_name}</TableCell>
                                                    <TableCell className="text-xs">{pkg.start_date}</TableCell>
                                                    <TableCell className="text-xs">{pkg.end_date || '-'}</TableCell>
                                                    <TableCell className="text-center text-xs">
                                                        {pkg.sessions_used} / {pkg.total_sessions}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant="outline" className="text-xs">
                                                            {pkg.status}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <Button 
                                                            variant="ghost" 
                                                            size="sm" 
                                                            className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                                            onClick={() => handleInitiateDelete(pkg)}
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>

                        {/* Daily Recaps Section */}
                        <div className="space-y-2">
                            <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                                <FileText className="w-4 h-4" /> Related Daily Recaps
                            </h4>
                            <div className="bg-white rounded-md border border-slate-200 max-h-[300px] overflow-auto">
                                <Table>
                                    <TableHeader className="sticky top-0 bg-white z-10 shadow-sm">
                                        <TableRow>
                                            <TableHead>Date</TableHead>
                                            <TableHead>Package Info</TableHead>
                                            <TableHead>Amount</TableHead>
                                            <TableHead>Therapist</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {patientRecaps.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={4} className="text-center py-6 text-slate-400 italic">
                                                    No recaps found.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            patientRecaps.map((recap) => (
                                                <TableRow key={recap.id}>
                                                    <TableCell className="text-xs font-medium">
                                                        {format(new Date(recap.recap_date), 'dd MMM yyyy')}
                                                    </TableCell>
                                                    <TableCell className="text-xs">
                                                        {recap.package_type || '-'}
                                                    </TableCell>
                                                    <TableCell className="text-xs font-mono">
                                                        {Number(recap.amount).toLocaleString('id-ID')}
                                                    </TableCell>
                                                    <TableCell className="text-xs text-slate-500">
                                                        {recap.therapist_name}
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    </div>
                )}

                <DeletePackageConfirmationModal 
                    isOpen={deleteModalOpen}
                    onClose={() => setDeleteModalOpen(false)}
                    onConfirm={handleConfirmDelete}
                    packageData={packageToDelete}
                    recapCount={recapCount}
                />
            </CardContent>
        </Card>
    );
};

export default DebugPackagePanel;