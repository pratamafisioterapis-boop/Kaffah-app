import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Clock, Check } from 'lucide-react';
import { getTherapistPracticeHours, updateTherapistPracticeHours } from '@/lib/api';

const OwnerTherapistScheduleSettings = ({ therapistId }) => {
    const { toast } = useToast();
    const [schedule, setSchedule] = useState([]);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(null); // Track which day is updating

    useEffect(() => {
    let isMounted = true;

    const load = async () => {
        if (!therapistId) return;

        setLoading(true);
        const { data, error } = await getTherapistPracticeHours(therapistId);

        if (!isMounted) return;

        if (data) {
            const fullWeek = Array.from({ length: 7 }, (_, i) => {
                const existing = data.find(d => d.day_of_week === i);
                return existing || {
                    day_of_week: i,
                    day_name: ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][i],
                    display_start_time: '09:00:00',
                    display_end_time: '17:00:00',
                    is_display_active: false
                };
            });
            setSchedule(fullWeek);
        } else {
            toast({ variant: "destructive", title: "Error", description: error?.message || "Gagal memuat jadwal" });
        }

        setLoading(false);
    };

    load();

    return () => {
        isMounted = false;
    };
}, [therapistId]);;

    const fetchSchedule = async () => {
        setLoading(true);
        const { data, error } = await getTherapistPracticeHours(therapistId);
        if (data) {
            // Ensure we have all 7 days even if DB returns partial
            const fullWeek = Array.from({ length: 7 }, (_, i) => {
                const existing = data.find(d => d.day_of_week === i);
                return existing || {
                    day_of_week: i,
                    day_name: ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][i],
                    display_start_time: '09:00:00',
                    display_end_time: '17:00:00',
                    is_display_active: false
                };
            });
            setSchedule(fullWeek);
        } else {
            toast({ variant: "destructive", title: "Error", description: error?.message || "Gagal memuat jadwal" });
        }
        setLoading(false);
    };

    const handleUpdate = async (dayOfWeek, updates) => {
        setUpdating(dayOfWeek);
        
        // Optimistic UI update
        const updatedSchedule = schedule.map(day => 
            day.day_of_week === dayOfWeek ? { ...day, ...updates } : day
        );
        setSchedule(updatedSchedule);

        const currentDay = updatedSchedule.find(d => d.day_of_week === dayOfWeek);
        
        const { error } = await updateTherapistPracticeHours(
    therapistId,
    dayOfWeek,
    currentDay.display_start_time?.length === 5 
        ? currentDay.display_start_time + ':00' 
        : currentDay.display_start_time,
    currentDay.display_end_time?.length === 5 
        ? currentDay.display_end_time + ':00' 
        : currentDay.display_end_time,
    currentDay.is_display_active
);

        if (error) {
            toast({ variant: "destructive", title: "Gagal Update", description: error.message });
            fetchSchedule(); // Revert
        } else {
             // Success - no toast needed for every single checkbox click to reduce noise,
             // or use a subtle indicator. For now let's just clear updating state.
        }
        setUpdating(null);
    };

    if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Clock className="w-5 h-5" />
                    Pengaturan Jam Praktek (Tampilan Web)
                </CardTitle>
                <p className="text-sm text-slate-500">
                    Atur jam praktek yang akan ditampilkan di halaman depan website.
                    <br/>
                    <span className="font-semibold text-amber-600">Catatan:</span> Pengaturan ini HANYA untuk tampilan informasi, tidak mempengaruhi slot booking sistem.
                </p>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {schedule.map((day) => (
                        <div key={day.day_of_week} className={`flex flex-col md:flex-row md:items-center gap-4 p-4 rounded-lg border ${day.is_display_active ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-100 opacity-70'}`}>
                            <div className="w-32 flex items-center gap-2">
                                <Checkbox 
                                    id={`active-${day.day_of_week}`}
                                    checked={day.is_display_active}
                                    onCheckedChange={(checked) => handleUpdate(day.day_of_week, { is_display_active: checked })}
                                />
                                <label 
                                    htmlFor={`active-${day.day_of_week}`}
                                    className="font-medium cursor-pointer select-none"
                                >
                                    {day.day_name}
                                </label>
                            </div>

                            <div className="flex items-center gap-2 flex-1">
                                <Input 
                                    type="time" 
                                    value={day.display_start_time?.slice(0,5) || ''}
                                    onChange={(e) => handleUpdate(day.day_of_week, { display_start_time: e.target.value + ':00' })}
                                    disabled={!day.is_display_active}
                                    className="w-32"
                                />
                                <span className="text-slate-400">-</span>
                                <Input 
                                    type="time" 
                                    value={day.display_end_time?.slice(0,5) || ''}
                                    onChange={(e) => handleUpdate(day.day_of_week, { display_end_time: e.target.value + ':00' })}
                                    disabled={!day.is_display_active}
                                    className="w-32"
                                />
                            </div>

                            <div className="w-8 flex justify-center">
                                {updating === day.day_of_week && <Loader2 className="w-4 h-4 animate-spin text-blue-500" />}
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
};

export default OwnerTherapistScheduleSettings;