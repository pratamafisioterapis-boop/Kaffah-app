import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCcw, AlertCircle, FileText } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { cn } from '@/lib/utils';

const DailyEvaluationReportWidget = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch ALL records where evaluation_daily is null or empty string
      // Removing date filters as requested to show all-time pending evaluations
      const { data: recaps, error: fetchError } = await supabase
        .from('daily_recaps')
        .select('*')
        .or('evaluation_daily.is.null,evaluation_daily.eq.""');

      if (fetchError) throw fetchError;

      // Group by therapist_name
      const groupedData = recaps.reduce((acc, curr) => {
        const name = curr.therapist_name || 'Unknown Therapist';
        if (!acc[name]) {
          acc[name] = 0;
        }
        acc[name]++;
        return acc;
      }, {});

      // Convert to array and sort by count descending
      const sortedData = Object.entries(groupedData)
        .map(([name, count]) => ({
          name,
          total_belum_evaluasi: count
        }))
        .sort((a, b) => b.total_belum_evaluasi - a.total_belum_evaluasi);

      setData(sortedData);
    } catch (err) {
      console.error('Error fetching daily evaluation report:', err);
      setError('Failed to load evaluation report.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Set up real-time subscription for any changes in daily_recaps
    const channel = supabase
      .channel('daily_recaps_all_changes_widget')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'daily_recaps'
        },
        () => {
          // Refresh data on any change (insert/update/delete) to daily_recaps
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <Card className="shadow-sm border-slate-200 h-full">
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-rose-100 rounded-lg">
            <FileText className="h-4 w-4 text-rose-600" />
          </div>
          <div>
            <CardTitle className="text-base font-semibold text-slate-900">
              Unfilled Daily Evaluations
            </CardTitle>
            <p className="text-sm text-slate-500">
              All time pending evaluations
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={fetchData}
          disabled={loading}
          className="h-8 w-8 p-0"
        >
          <RefreshCcw className={cn("h-4 w-4", loading && "animate-spin")} />
          <span className="sr-only">Refresh</span>
        </Button>
      </CardHeader>
      <CardContent>
        {error ? (
          <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-md text-sm">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        ) : loading && data.length === 0 ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex justify-between items-center py-2">
                <div className="h-4 bg-slate-100 rounded w-1/3 animate-pulse" />
                <div className="h-6 bg-slate-100 rounded w-12 animate-pulse" />
              </div>
            ))}
          </div>
        ) : data.length === 0 ? (
          <div className="text-center py-6 text-slate-500 text-sm">
            No pending evaluations found. Great job!
          </div>
        ) : (
          <div className="relative overflow-x-auto max-h-[400px]">
            <Table>
              <TableHeader className="sticky top-0 bg-white z-10 shadow-sm">
                <TableRow>
                  <TableHead className="w-[70%]">Physiotherapist Name</TableHead>
                  <TableHead className="text-right">Unfilled Count</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((item) => (
                  <TableRow key={item.name} className="hover:bg-slate-50">
                    <TableCell className="font-medium text-slate-700">
                      {item.name}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge 
                        variant="secondary" 
                        className={cn(
                          "font-mono",
                          item.total_belum_evaluasi > 10 ? "bg-red-100 text-red-700 hover:bg-red-100" : "bg-slate-100 text-slate-700 hover:bg-slate-100"
                        )}
                      >
                        {item.total_belum_evaluasi}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DailyEvaluationReportWidget;