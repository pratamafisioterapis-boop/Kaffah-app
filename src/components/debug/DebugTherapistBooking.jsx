import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { RefreshCw, X, Database } from 'lucide-react';

const DebugTherapistBooking = () => {
  const [therapists, setTherapists] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchDebugData = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('physiotherapists')
      .select('id, name, is_active, show_on_booking, show_on_landing')
      .order('name');
    setTherapists(data || []);
    setLoading(false);
  };

  useEffect(() => {
    if (isOpen) fetchDebugData();
  }, [isOpen]);

  // Only show in development
  if (import.meta.env.MODE !== 'development') return null;

  if (!isOpen) {
    return (
      <Button 
        variant="destructive" 
        size="sm" 
        className="fixed bottom-4 left-4 z-50 opacity-50 hover:opacity-100 font-mono text-xs shadow-lg"
        onClick={() => setIsOpen(true)}
      >
        <Database className="w-3 h-3 mr-2" /> DEBUG
      </Button>
    );
  }

  return (
    <div className="fixed bottom-4 left-4 z-50 bg-slate-900/95 text-white p-4 rounded-lg shadow-2xl w-[500px] max-h-[80vh] overflow-hidden flex flex-col font-mono text-xs border border-slate-700 backdrop-blur-sm">
      <div className="flex justify-between items-center mb-4 border-b border-slate-700 pb-2">
        <div>
           <h3 className="font-bold text-green-400 flex items-center gap-2">
             <Database className="w-4 h-4" /> Therapist Visibility
           </h3>
           <p className="text-[10px] text-slate-400">Database Direct Query (No Filters)</p>
        </div>
        <div className="flex gap-2">
            <Button size="icon" variant="ghost" className="h-6 w-6 hover:bg-slate-800" onClick={fetchDebugData} disabled={loading}>
                <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button size="icon" variant="ghost" className="h-6 w-6 hover:bg-red-900/50 hover:text-red-400" onClick={() => setIsOpen(false)}>
                <X className="w-3 h-3" />
            </Button>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-slate-800 p-3 rounded border border-slate-700">
            <div className="text-slate-400 text-[10px] uppercase tracking-wider">Total Therapists</div>
            <div className="text-2xl font-bold">{therapists.length}</div>
        </div>
        <div className="bg-slate-800 p-3 rounded border border-slate-700">
            <div className="text-slate-400 text-[10px] uppercase tracking-wider">Visible on Booking</div>
            <div className="text-2xl font-bold text-green-400">
                {therapists.filter(t => t.show_on_booking && t.is_active).length}
            </div>
        </div>
      </div>

      <div className="overflow-y-auto flex-1 border border-slate-700 rounded bg-slate-950">
        <table className="w-full text-left border-collapse">
            <thead className="bg-slate-800 text-slate-300 sticky top-0 z-10">
                <tr>
                    <th className="p-2 border-b border-slate-700 font-semibold">Name</th>
                    <th className="p-2 border-b border-slate-700 font-semibold text-center">Active</th>
                    <th className="p-2 border-b border-slate-700 font-semibold text-center">Booking</th>
                    <th className="p-2 border-b border-slate-700 font-semibold text-center">Landing</th>
                </tr>
            </thead>
            <tbody>
                {therapists.map(t => {
                   const isBookingVisible = t.is_active && t.show_on_booking;
                   return (
                    <tr key={t.id} className={`border-b border-slate-800/50 hover:bg-slate-800/50 transition-colors ${isBookingVisible ? 'bg-green-900/10' : ''}`}>
                        <td className="p-2 truncate max-w-[150px] font-medium text-slate-200">{t.name}</td>
                        <td className="p-2 text-center">
                            {t.is_active ? <span className="text-green-500 bg-green-500/10 px-1.5 py-0.5 rounded">YES</span> : <span className="text-red-500 bg-red-500/10 px-1.5 py-0.5 rounded">NO</span>}
                        </td>
                        <td className="p-2 text-center">
                            {t.show_on_booking ? <span className="text-green-500 font-bold">YES</span> : <span className="text-slate-600">NO</span>}
                        </td>
                         <td className="p-2 text-center">
                            {t.show_on_landing ? <span className="text-blue-400">YES</span> : <span className="text-slate-600">NO</span>}
                        </td>
                    </tr>
                   );
                })}
            </tbody>
        </table>
      </div>
      <div className="mt-3 text-[10px] text-slate-500 flex items-center gap-2">
         <span className="w-2 h-2 rounded-full bg-green-900/50 border border-green-500/30"></span>
         Highlighted rows appear in Public Booking (Active + Booking=YES)
      </div>
    </div>
  );
};

export default DebugTherapistBooking;