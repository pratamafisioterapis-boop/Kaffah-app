import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Users, Package, ArrowUpDown, ArrowUp, ArrowDown, Calendar, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { getAllPackageTrackings } from '@/lib/api';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/customSupabaseClient';

const PatientIncomeSection = () => {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortConfig, setSortConfig] = useState({ key: 'start_date', direction: 'descending' });
  const [error, setError] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch all package trackings with patient details
      const { data, error } = await getAllPackageTrackings();
      if (error) throw error;
      setPackages(data || []);
    } catch (err) {
      console.error("Error fetching package data:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Subscribe to changes in package_tracking to reflect DB trigger updates immediately
    const subscription = supabase
      .channel('public:package_tracking')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'package_tracking' }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  // Filter and Sort Logic
  const processedPackages = useMemo(() => {
    // Filter: Only show packages where total_sessions > 1 (Actual Packages)
    let filtered = packages.filter(pkg => pkg.total_sessions > 1);

    // Sort
    if (sortConfig.key) {
      filtered.sort((a, b) => {
        let aValue, bValue;
        switch (sortConfig.key) {
          case 'patient': 
            aValue = a.patient?.full_name?.toLowerCase() || ''; 
            bValue = b.patient?.full_name?.toLowerCase() || ''; 
            break;
          case 'package': 
            aValue = a.package_name?.toLowerCase() || ''; 
            bValue = b.package_name?.toLowerCase() || ''; 
            break;
          case 'start_date': 
            aValue = new Date(a.start_date); 
            bValue = new Date(b.start_date); 
            break;
          case 'used': 
            aValue = a.sessions_used || 0; 
            bValue = b.sessions_used || 0; 
            break;
          case 'remaining': 
            aValue = a.sessions_remaining || 0; 
            bValue = b.sessions_remaining || 0; 
            break;
          case 'status': 
            aValue = a.status?.toLowerCase() || ''; 
            bValue = b.status?.toLowerCase() || ''; 
            break;
          default: 
            return 0;
        }

        if (aValue < bValue) return sortConfig.direction === 'ascending' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'ascending' ? 1 : -1;
        return 0;
      });
    }
    return filtered;
  }, [packages, sortConfig]);

  const requestSort = (key) => {
    let direction = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const SortIcon = ({ columnKey }) => {
    if (sortConfig.key !== columnKey) return <ArrowUpDown className="ml-1 h-3 w-3 opacity-30" />;
    return sortConfig.direction === 'ascending' 
      ? <ArrowUp className="ml-1 h-3 w-3 text-blue-600" /> 
      : <ArrowDown className="ml-1 h-3 w-3 text-blue-600" />;
  };

  const getStatusBadge = (status) => {
    const s = (status || '').toLowerCase();
    if (s.includes('aktif') || s === 'active') return <Badge className="bg-green-100 text-green-700 hover:bg-green-200 border-green-200"><Clock className="w-3 h-3 mr-1"/> Aktif</Badge>;
    if (s.includes('selesai') || s === 'completed') return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-200 border-blue-200"><CheckCircle className="w-3 h-3 mr-1"/> Selesai</Badge>;
    if (s.includes('diperpanjang')) return <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-200 border-purple-200"><Clock className="w-3 h-3 mr-1"/> Diperpanjang</Badge>;
    if (s.includes('belum')) return <Badge variant="outline" className="text-slate-500 border-slate-300"><AlertCircle className="w-3 h-3 mr-1"/> Belum Dimulai</Badge>;
    return <Badge variant="secondary">{status}</Badge>;
  };

  return (
    <Card className="border-0 shadow-none bg-transparent">
       <CardContent className="p-6 md:p-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
             <div>
                <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                   <Package className="w-6 h-6 text-blue-600" />
                   Riwayat Paket Pasien
                </h2>
                <p className="text-slate-500 mt-1">
                   Tracking otomatis penggunaan paket berdasarkan input Daily Recaps.
                </p>
             </div>
             
             <div className="flex items-center gap-2 text-sm text-slate-500 bg-slate-50 px-3 py-2 rounded-lg border border-slate-200">
                <Users className="w-4 h-4" />
                <span>Total: <strong className="text-slate-900">{processedPackages.length}</strong> Paket Terdaftar</span>
             </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg mb-6 flex items-center gap-2">
               <AlertCircle className="w-5 h-5" />
               Error fetching data: {error}
            </div>
          )}

          {loading ? (
             <div className="flex flex-col items-center justify-center p-12 gap-2">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                <span className="text-sm text-slate-400">Memuat data paket...</span>
             </div>
          ) : (
            <motion.div 
               initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
               className="rounded-xl border border-slate-200 overflow-hidden bg-white shadow-sm"
            >
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-600 font-semibold tracking-wider">
                            <tr>
                                <th className="px-6 py-4 whitespace-nowrap cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => requestSort('patient')}>
                                    <div className="flex items-center">Pasien <SortIcon columnKey="patient" /></div>
                                </th>
                                <th className="px-6 py-4 whitespace-nowrap cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => requestSort('package')}>
                                    <div className="flex items-center">Jenis Paket <SortIcon columnKey="package" /></div>
                                </th>
                                <th className="px-6 py-4 whitespace-nowrap cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => requestSort('start_date')}>
                                    <div className="flex items-center">Tanggal Beli <SortIcon columnKey="start_date" /></div>
                                </th>
                                <th className="px-6 py-4 text-center whitespace-nowrap cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => requestSort('used')}>
                                    <div className="flex items-center justify-center">Sesi Terpakai <SortIcon columnKey="used" /></div>
                                </th>
                                <th className="px-6 py-4 text-center whitespace-nowrap cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => requestSort('remaining')}>
                                    <div className="flex items-center justify-center">Sisa Sesi <SortIcon columnKey="remaining" /></div>
                                </th>
                                <th className="px-6 py-4 whitespace-nowrap cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => requestSort('status')}>
                                    <div className="flex items-center">Status <SortIcon columnKey="status" /></div>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {processedPackages.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="p-12 text-center text-slate-400 italic bg-slate-50/30">
                                       Belum ada data paket yang terekam (Total Sesi &gt; 1).
                                    </td>
                                </tr>
                            ) : (
                                processedPackages.map((pkg) => (
                                    <tr key={pkg.id} className="hover:bg-blue-50/30 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="font-medium text-slate-900">{pkg.patient?.full_name || 'Deleted User'}</div>
                                            <div className="text-xs text-slate-500 font-mono">{pkg.patient?.rm_number || '-'}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-blue-700 font-medium">{pkg.package_name}</span>
                                        </td>
                                        <td className="px-6 py-4 text-slate-600">
                                            <div className="flex items-center gap-2">
                                               <Calendar className="w-3.5 h-3.5 text-slate-400"/>
                                               {pkg.start_date ? format(new Date(pkg.start_date), 'dd MMM yyyy', { locale: localeId }) : '-'}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="font-bold text-slate-700">{pkg.sessions_used}</span>
                                            <span className="text-slate-400 mx-1">/</span>
                                            <span className="text-slate-500">{pkg.total_sessions}</span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                           <span className={`font-bold ${pkg.sessions_remaining === 0 ? 'text-orange-500' : 'text-emerald-600'}`}>
                                              {pkg.sessions_remaining}
                                           </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            {getStatusBadge(pkg.status)}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </motion.div>
          )}
       </CardContent>
    </Card>
  );
};

export default PatientIncomeSection;