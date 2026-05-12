import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from '@/components/ui/card';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';

import {
  Loader2,
  Package
} from 'lucide-react';

const formatCurrency = (value) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(value || 0);
};

const PackageFunds = () => {
  const [loading, setLoading] = useState(true);
  const [packages, setPackages] = useState([]);

  useEffect(() => {
    fetchPackageFunds();
  }, []);

  const fetchPackageFunds = async () => {
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('package_tracking')
        .select(`
          id,
          package_name,
          total_sessions,
          sessions_remaining,
          status,
          nominal,
          created_at,
          patients!patient_id (
            full_name
          )
        `)
        .gt('sessions_remaining', 0)
        .eq('status', 'aktif')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const processed = (data || []).map((item) => {
        const nominal = Number(item.nominal || 0);
        const totalSessions = Number(item.total_sessions || 0);
        const remaining = Number(item.sessions_remaining || 0);

        const remainingValue =
          totalSessions > 0
            ? (nominal / totalSessions) * remaining
            : 0;

        return {
          ...item,
          patientName:
            item.patients?.full_name || '-',
          remainingValue
        };
      });

      setPackages(processed);

    } catch (err) {
      console.error('PACKAGE FUND ERROR:', err);
    } finally {
      setLoading(false);
    }
  };

  const totalDanaPaket = packages.reduce(
    (sum, item) => sum + item.remainingValue,
    0
  );

  return (
    <Card className="border-cyan-100 shadow-md">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-slate-800">
            <Package className="w-5 h-5 text-cyan-600" />
            Dana Paket
          </CardTitle>

          <p className="text-sm text-slate-500 mt-1">
            Nilai remaining paket pasien aktif
          </p>
        </div>

        <div className="text-right">
          <p className="text-xs text-slate-500">
            Total Dana Paket
          </p>

          <p className="text-2xl font-bold text-cyan-700">
            {formatCurrency(totalDanaPaket)}
          </p>
        </div>
      </CardHeader>

      <CardContent>
        <div className="rounded-xl border overflow-x-auto bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama Pasien</TableHead>

                <TableHead>
                  Jenis Paket
                </TableHead>

                <TableHead className="text-center">
                  Sisa Sesi
                </TableHead>

                <TableHead>
                  Status
                </TableHead>

                <TableHead className="text-right">
                  Nominal
                </TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="h-24 text-center"
                  >
                    <div className="flex justify-center items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Memuat data...
                    </div>
                  </TableCell>
                </TableRow>

              ) : packages.length === 0 ? (

                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="h-24 text-center text-slate-400"
                  >
                    Tidak ada paket aktif
                  </TableCell>
                </TableRow>

              ) : (

                packages.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-semibold text-slate-700">
                      {item.patientName}
                    </TableCell>

                    <TableCell className="text-slate-600">
                      {item.package_name || '-'}
                    </TableCell>

                    <TableCell className="text-center">
                      <span className="font-bold text-cyan-600">
                        {item.sessions_remaining}
                      </span>
                    </TableCell>

                    <TableCell>
                      <span className="px-2 py-1 rounded-md text-xs font-semibold bg-emerald-100 text-emerald-700">
                        {item.status}
                      </span>
                    </TableCell>

                    <TableCell className="text-right font-bold text-cyan-700">
                      {formatCurrency(item.remainingValue)}
                    </TableCell>
                  </TableRow>
                ))

              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

export default PackageFunds;