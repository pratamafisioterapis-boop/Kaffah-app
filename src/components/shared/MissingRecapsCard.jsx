import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, FileText, Loader2, RefreshCw } from 'lucide-react';
import { getMissingRecaps } from '@/lib/api';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';

const MissingRecapsCard = ({ 
  startDate, 
  endDate, 
  therapistId, 
  role = 'admin', 
  title = "Missing Recaps",
  className 
}) => {
  const [missing, setMissing] = useState([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data, error } = await getMissingRecaps({ startDate, endDate, therapistId });
      if (error) throw error;
      setMissing(data || []);
    } catch (err) {
      console.error(err);
      toast({ 
        variant: "destructive", 
        title: "Error fetching missing recaps", 
        description: err.message 
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [startDate, endDate, therapistId]);

  if (!loading && missing.length === 0) return null;

  return (
    <Card className={cn("border-l-4 border-l-orange-500 shadow-sm", className)}>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-orange-700">
            <AlertCircle className="w-5 h-5" />
            {title}
          </CardTitle>
          <CardDescription className="text-orange-600/80 mt-1">
            {missing.length} appointments pending recap entry.
          </CardDescription>
        </div>
        <Button variant="ghost" size="sm" onClick={fetchData} className="text-orange-600 hover:bg-orange-50">
           <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
        </Button>
      </CardHeader>
      <CardContent className="max-h-60 overflow-y-auto pr-2 space-y-2">
        {loading && missing.length === 0 ? (
          <div className="flex justify-center py-4">
            <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
          </div>
        ) : (
          missing.map(app => (
            <div key={app.id} className="bg-orange-50 p-3 rounded-md border border-orange-100 flex items-start justify-between gap-4">
               <div>
                  <p className="font-semibold text-slate-800 text-sm">
                    {app.patient?.full_name || app.guest_name}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                     <span>{format(new Date(app.appointment_date), 'dd MMM yyyy HH:mm')}</span>
                     <span>•</span>
                     <span>{app.therapist?.name || 'Unknown Therapist'}</span>
                  </div>
               </div>
               {/* 
                  Future enhancement: Link this button to open the recap modal pre-filled
                  For now it's visual
               */}
               <Button size="xs" variant="outline" className="h-7 text-xs border-orange-200 text-orange-700 bg-white hover:bg-orange-50">
                  Isi Recap
               </Button>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
};

export default MissingRecapsCard;