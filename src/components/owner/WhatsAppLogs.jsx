import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCcw, Loader2, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

const WhatsAppLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetchLogs();
  }, [filter]);

  const fetchLogs = async () => {
    setLoading(true);
    // Now that FK is added, we can use the relationship
    let query = supabase.from('wa_schedule_logs').select('*, patient:patients(full_name)').order('created_at', { ascending: false }).limit(50);
    
    if (filter !== 'all') {
        query = query.eq('status', filter);
    }
    
    const { data } = await query;
    setLogs(data || []);
    setLoading(false);
  };

  const getStatusBadge = (status) => {
      switch(status) {
          case 'sent': return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Terkirim</Badge>;
          case 'failed': return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">Gagal</Badge>;
          default: return <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100">Pending</Badge>;
      }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <div className="flex gap-2">
                <Button variant={filter === 'all' ? "default" : "outline"} size="sm" onClick={() => setFilter('all')}>Semua</Button>
                <Button variant={filter === 'sent' ? "default" : "outline"} size="sm" onClick={() => setFilter('sent')}>Terkirim</Button>
                <Button variant={filter === 'pending' ? "default" : "outline"} size="sm" onClick={() => setFilter('pending')}>Pending</Button>
                <Button variant={filter === 'failed' ? "default" : "outline"} size="sm" onClick={() => setFilter('failed')}>Gagal</Button>
            </div>
            <Button size="sm" variant="ghost" onClick={fetchLogs} disabled={loading}>
                <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
        </div>
        
        {/* Mobile cards */}
        <div className="sm:hidden divide-y divide-slate-100">
            {loading ? (
                <div className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-400"/></div>
            ) : logs.length === 0 ? (
                <div className="text-center py-8 text-slate-500">Belum ada riwayat pesan.</div>
            ) : (
                logs.map((log) => (
                    <div key={log.id} className="p-4 space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                            <span className="text-xs text-slate-500 whitespace-nowrap">{format(new Date(log.created_at), 'dd/MM/yyyy HH:mm')}</span>
                            {getStatusBadge(log.status)}
                        </div>
                        <p className="font-medium text-slate-800 truncate">{log.patient?.full_name || 'Unknown'}</p>
                        <div className="flex items-center justify-between text-xs text-slate-500 gap-2">
                            <span className="truncate">{log.phone_number}</span>
                            <span className="uppercase font-medium shrink-0">{log.category.replace('_', ' ')}</span>
                        </div>
                        {log.status === 'failed' && (
                            <div className="flex items-center text-red-500 text-xs gap-1" title={log.error_message}>
                                <AlertCircle className="w-3 h-3" /> Error
                            </div>
                        )}
                    </div>
                ))
            )}
        </div>

        <div className="hidden sm:block overflow-x-auto">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Waktu</TableHead>
                        <TableHead>Kategori</TableHead>
                        <TableHead>Penerima</TableHead>
                        <TableHead>No. HP</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Detail</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {loading ? (
                        <TableRow><TableCell colSpan={6} className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-400"/></TableCell></TableRow>
                    ) : logs.length === 0 ? (
                        <TableRow><TableCell colSpan={6} className="text-center py-8 text-slate-500">Belum ada riwayat pesan.</TableCell></TableRow>
                    ) : (
                        logs.map((log) => (
                            <TableRow key={log.id}>
                                <TableCell className="whitespace-nowrap text-xs text-slate-500">
                                    {format(new Date(log.created_at), 'dd/MM/yyyy HH:mm')}
                                </TableCell>
                                <TableCell className="text-xs font-medium uppercase text-slate-700">{log.category.replace('_', ' ')}</TableCell>
                                <TableCell className="font-medium text-slate-800">{log.patient?.full_name || 'Unknown'}</TableCell>
                                <TableCell className="text-xs text-slate-500">{log.phone_number}</TableCell>
                                <TableCell>{getStatusBadge(log.status)}</TableCell>
                                <TableCell>
                                    {log.status === 'failed' && (
                                        <div className="flex items-center text-red-500 text-xs gap-1" title={log.error_message}>
                                            <AlertCircle className="w-3 h-3" /> Error
                                        </div>
                                    )}
                                    {log.status === 'sent' && log.sent_at && (
                                        <span className="text-[10px] text-slate-400">
                                            {format(new Date(log.sent_at), 'HH:mm')}
                                        </span>
                                    )}
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>
        </div>
    </div>
  );
};

export default WhatsAppLogs;