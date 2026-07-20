import React, { useState, useEffect } from 'react';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { 
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  MoreHorizontal, Edit, Trash2, Search,
  ChevronLeft, ChevronRight, AlertCircle, CheckCircle, ClipboardList
} from 'lucide-react';
import { getPatients } from '@/lib/api';
import { normalizePatient } from '@/lib/patientHelpers';

const PatientList = ({ onEdit, onDelete, refreshTrigger }) => {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [itemsPerPage] = useState(20);
  const [totalItems, setTotalItems] = useState(0);

  // Search/Filter State
  const [searchTerm, setSearchTerm] = useState('');
  
  // Sort State
  const [sortBy, setSortBy] = useState('medical_record_number');
  const [sortOrder, setSortOrder] = useState('desc');

  const fetchPatients = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getPatients(currentPage, itemsPerPage);
      
      if (result.error) throw result.error;
      
      // Normalize data immediately after fetch
      const rawData = result.data || [];
      const normalizedData = rawData.map(p => normalizePatient(p));
      
      setPatients(normalizedData);
      setTotalPages(result.pagination?.totalPages || 1);
      setTotalItems(result.pagination?.total || 0);

    } catch (err) {
      console.error("Failed to fetch patients:", err);
      setError("Gagal memuat data pasien.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPatients();
  }, [currentPage, itemsPerPage, refreshTrigger]);

  const handleSort = (column) => {
    if (sortBy === column) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };

  const filteredPatients = patients
      .filter(p =>
          (p.full_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
          (p.medical_record_number || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
          (p.phone || '').includes(searchTerm)
      )
      .sort((a, b) => {
        if (!sortBy) return 0;

        if (sortBy === 'medical_record_number') {
            const rmA = parseInt((a.medical_record_number || '').replace('RM', ''), 10) || 0;
            const rmB = parseInt((b.medical_record_number || '').replace('RM', ''), 10) || 0;
            return sortOrder === 'asc' ? rmA - rmB : rmB - rmA;
        }

        const aVal = a[sortBy];
        const bVal = b[sortBy];

        if (aVal == null) return 1;
        if (bVal == null) return -1;

        if (typeof aVal === 'string') {
            return sortOrder === 'asc'
                ? aVal.localeCompare(bVal)
                : bVal.localeCompare(aVal);
        }

        if (typeof aVal === 'number') {
            return sortOrder === 'asc'
                ? aVal - bVal
                : bVal - aVal;
        }

        return 0;
      });

  if (error) {
      return (
          <div className="flex flex-col items-center justify-center p-8 bg-red-50 rounded-xl border border-red-100">
              <AlertCircle className="w-10 h-10 text-red-500 mb-2" />
              <p className="text-red-700 font-medium">{error}</p>
              <Button variant="outline" onClick={fetchPatients} className="mt-4 bg-white hover:bg-red-50 border-red-200 text-red-600">
                  Coba Lagi
              </Button>
          </div>
      );
  }

  return (
    <div className="space-y-6">
      <div className="relative">
         <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
         <Input 
            placeholder="Cari nama, RM, atau no HP..." 
            className="pl-10 h-11"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
         />
      </div>

      {/* Mobile cards */}
      <div className="sm:hidden space-y-3">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-6 w-24 rounded-full" />
            </div>
          ))
        ) : filteredPatients.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm py-12 text-center text-slate-500">
            <ClipboardList className="w-12 h-12 mb-3 mx-auto text-slate-300" />
            <h3 className="text-lg font-medium text-slate-900">Belum ada data pasien</h3>
            <p className="text-sm mt-1">Silakan tambah data pasien baru untuk memulai.</p>
          </div>
        ) : (
          filteredPatients.map((patient) => (
            <div key={patient.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-bold text-slate-900 text-sm truncate">{patient.full_name}</p>
                  {patient.nickname && <p className="text-xs text-slate-500 truncate">{patient.nickname}</p>}
                  <p className="text-xs font-mono text-slate-500 mt-0.5">{patient.medical_record_number}</p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-slate-200 rounded-full shrink-0">
                      <span className="sr-only">Open menu</span>
                      <MoreHorizontal className="h-4 w-4 text-slate-500" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40">
                    <DropdownMenuLabel>Aksi</DropdownMenuLabel>
                    <DropdownMenuItem onClick={() => onEdit(patient)} className="cursor-pointer">
                      <Edit className="mr-2 h-4 w-4 text-blue-600" /> Edit Pasien
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-red-600 focus:text-red-600 cursor-pointer" onClick={() => onDelete(patient)}>
                      <Trash2 className="mr-2 h-4 w-4" /> Hapus Pasien
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
                <span>{patient.genderLabel}</span>
                <span className="text-slate-300">•</span>
                <span>{patient.formattedAge}</span>
                <span className="text-slate-300">•</span>
                <span className="font-mono whitespace-nowrap">{patient.formattedBirthDate}</span>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {patient.isComplete ? (
                  <Badge className="bg-emerald-50 text-emerald-700 border-transparent font-medium">
                    <CheckCircle className="w-3 h-3 mr-1" /> Lengkap
                  </Badge>
                ) : (
                  <Badge className="bg-amber-50 text-amber-700 border-transparent font-medium">
                    <AlertCircle className="w-3 h-3 mr-1" /> Tidak Lengkap
                  </Badge>
                )}
                {patient.status === 'aktif' ? (
                  <Badge className="bg-green-100 text-green-800 border-transparent">Aktif</Badge>
                ) : (
                  <Badge className="bg-slate-100 text-slate-800 border-transparent">Non-Aktif</Badge>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="hidden sm:block bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
          <Table>
              <TableHeader className="bg-slate-50 border-b-2 border-slate-200">
                  <TableRow>
                      <TableHead className="w-[100px] cursor-pointer select-none font-semibold text-slate-900" onClick={() => handleSort('medical_record_number')}>
                          No. RM {sortBy === 'medical_record_number' && <span className="ml-1 text-slate-400">{sortOrder === 'asc' ? '▲' : '▼'}</span>}
                      </TableHead>
                      <TableHead className="cursor-pointer select-none font-semibold text-slate-900" onClick={() => handleSort('full_name')}>
                          Nama Pasien {sortBy === 'full_name' && <span className="ml-1 text-slate-400">{sortOrder === 'asc' ? '▲' : '▼'}</span>}
                      </TableHead>
                      <TableHead className="cursor-pointer select-none font-semibold text-slate-900" onClick={() => handleSort('age')}>
                          Usia {sortBy === 'age' && <span className="ml-1 text-slate-400">{sortOrder === 'asc' ? '▲' : '▼'}</span>}
                      </TableHead>
                      <TableHead className="font-semibold text-slate-900">Tgl Lahir</TableHead>
                      <TableHead className="font-semibold text-slate-900">Gender</TableHead>
                      <TableHead className="hidden lg:table-cell font-semibold text-slate-900">No. HP</TableHead>
                      <TableHead className="font-semibold text-slate-900">Kelengkapan</TableHead>
                      <TableHead className="cursor-pointer select-none font-semibold text-slate-900" onClick={() => handleSort('status')}>
                          Status {sortBy === 'status' && <span className="ml-1 text-slate-400">{sortOrder === 'asc' ? '▲' : '▼'}</span>}
                      </TableHead>
                      <TableHead className="text-right font-semibold text-slate-900">Aksi</TableHead>
                  </TableRow>
              </TableHeader>

              <TableBody>
                  {loading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                          <TableRow key={i} className="border-b border-slate-100">
                              <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                              <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                              <TableCell><Skeleton className="h-4 w-10" /></TableCell>
                              <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                              <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                              <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                              <TableCell><Skeleton className="h-6 w-24 rounded-full" /></TableCell>
                              <TableCell><Skeleton className="h-6 w-16 rounded-full" /></TableCell>
                              <TableCell><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                          </TableRow>
                      ))
                  ) : filteredPatients.length === 0 ? (
                      <TableRow>
                          <TableCell colSpan={9} className="h-64 text-center">
                              <div className="flex flex-col items-center justify-center text-slate-500">
                                  <ClipboardList className="w-12 h-12 mb-3 text-slate-300" />
                                  <h3 className="text-lg font-medium text-slate-900">Belum ada data pasien</h3>
                                  <p className="text-sm mt-1">Silakan tambah data pasien baru untuk memulai.</p>
                              </div>
                          </TableCell>
                      </TableRow>
                  ) : (
                      filteredPatients.map((patient, index) => (
                          <TableRow 
                            key={patient.id} 
                            className={`${index % 2 === 0 ? 'bg-white' : 'bg-slate-50'} hover:bg-slate-100 transition-colors border-b border-slate-100 last:border-0`}
                          >
                              <TableCell className="font-mono font-medium text-slate-700">
                                  {patient.medical_record_number}
                              </TableCell>
                              <TableCell>
                                  <div className="flex flex-col">
                                      <span className="font-bold text-slate-900 text-sm">{patient.full_name}</span>
                                      {patient.nickname && <span className="text-sm text-slate-500">{patient.nickname}</span>}
                                  </div>
                              </TableCell>
                              <TableCell className="text-slate-700">{patient.formattedAge}</TableCell>
                              <TableCell className="text-sm font-mono text-slate-600">{patient.formattedBirthDate}</TableCell>
                              <TableCell className="text-slate-700">{patient.genderLabel}</TableCell>
                              <TableCell className="hidden lg:table-cell text-sm text-slate-600">
                                  {patient.formattedPhone}
                              </TableCell>
                              <TableCell>
                                  {patient.isComplete ? (
                                      <Badge className="bg-emerald-50 text-emerald-700 border-transparent hover:bg-emerald-100 font-medium">
                                          <CheckCircle className="w-3 h-3 mr-1" /> Lengkap
                                      </Badge>
                                  ) : (
                                      <Badge className="bg-amber-50 text-amber-700 border-transparent hover:bg-amber-100 font-medium">
                                          <AlertCircle className="w-3 h-3 mr-1" /> Tidak Lengkap
                                      </Badge>
                                  )}
                              </TableCell>
                              <TableCell>
                                  {patient.status === 'aktif' ? (
                                    <Badge className="bg-green-100 text-green-800 hover:bg-green-200 border-transparent">Aktif</Badge>
                                  ) : (
                                    <Badge className="bg-slate-100 text-slate-800 hover:bg-slate-200 border-transparent">Non-Aktif</Badge>
                                  )}
                              </TableCell>
                              <TableCell className="text-right">
                                  <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                          <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-slate-200 rounded-full">
                                              <span className="sr-only">Open menu</span>
                                              <MoreHorizontal className="h-4 w-4 text-slate-500" />
                                          </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end" className="w-40">
                                          <DropdownMenuLabel>Aksi</DropdownMenuLabel>
                                          <DropdownMenuItem onClick={() => onEdit(patient)} className="cursor-pointer">
                                              <Edit className="mr-2 h-4 w-4 text-blue-600" /> Edit Pasien
                                          </DropdownMenuItem>
                                          <DropdownMenuItem className="text-red-600 focus:text-red-600 cursor-pointer" onClick={() => onDelete(patient)}>
                                              <Trash2 className="mr-2 h-4 w-4" /> Hapus Pasien
                                          </DropdownMenuItem>
                                      </DropdownMenuContent>
                                  </DropdownMenu>
                              </TableCell>
                          </TableRow>
                      ))
                  )}
              </TableBody>
          </Table>
      </div>

      {totalItems > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-2">
            <p className="text-sm text-slate-500 order-2 sm:order-1">
                Menampilkan <span className="font-medium text-slate-900">{filteredPatients.length}</span> dari <span className="font-medium text-slate-900">{totalItems}</span> pasien
            </p>
            <div className="flex items-center space-x-2 order-1 sm:order-2">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1 || loading}
                    className="h-9 px-4"
                >
                    <ChevronLeft className="h-4 w-4 mr-1" /> Sebelumnya
                </Button>
                <div className="text-sm font-medium px-2 min-w-[3rem] text-center">
                    {currentPage} / {totalPages}
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages || loading}
                    className="h-9 px-4"
                >
                    Selanjutnya <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
            </div>
        </div>
      )}
    </div>
  );
};

export default PatientList;