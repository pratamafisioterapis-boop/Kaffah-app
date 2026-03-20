import React, { useState, useEffect } from 'react';
import { getTherapistTargetProgress } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Target, Calendar, Flame, Trophy, TrendingUp, RefreshCcw } from 'lucide-react';
import { format, parseISO, startOfMonth } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { motion } from 'framer-motion';

const TherapistTargetWidget = ({ userId }) => {
    const [loading, setLoading] = useState(true);
    const [targetData, setTargetData] = useState(null);
    const [error, setError] = useState(null);
    const [streak, setStreak] = useState(0);

    useEffect(() => {
        if (userId) {
            console.log(`🔄 [TherapistTargetWidget] Initializing for user: ${userId}`);
            fetchTargetAndStreak();
        } else {
            console.warn(`⚠️ [TherapistTargetWidget] No userId provided yet`);
        }
    }, [userId]);

    const getMotivationByProgress = (percentage) => {
        if (percentage >= 100) return "Target tercapai! Luar biasa! 🎉";
        if (percentage >= 80) return "Sedikit lagi! Kamu pasti bisa! 🔥";
        if (percentage >= 50) return "On track! Pertahankan ritmenya! 🚀";
        if (percentage >= 20) return "Awal yang bagus, teruskan! ✨";
        return "Santai dulu, perjalanan baru dimulai 🌱";
    };

    const calculateStreak = (hasActivityToday) => {
        if (!userId) return 0;
        
        const streakKey = `visit_streak_${userId}`;
        const streakDateKey = `visit_streak_date_${userId}`;
        
        const savedStreak = parseInt(localStorage.getItem(streakKey) || '0');
        const lastDate = localStorage.getItem(streakDateKey);
        const today = new Date().toISOString().split('T')[0];
        
        // If we have activity today, ensure streak is updated
        if (hasActivityToday) {
            if (lastDate === today) {
                return savedStreak; 
            }
            
            // Simplified: Increment if last active date was yesterday or today
            let newStreak = savedStreak + 1;
             
            localStorage.setItem(streakKey, newStreak.toString());
            localStorage.setItem(streakDateKey, today);
            return newStreak;
        } 
        
        return lastDate ? savedStreak : 0;
    };

    const fetchTargetAndStreak = async () => {
        setLoading(true);
        setError(null);
        try {
            // Calculate current month range
            const now = new Date();
            const startDate = format(startOfMonth(now), 'yyyy-MM-dd');
            // End date is TODAY as per task requirements
            const endDate = format(now, 'yyyy-MM-dd');

            console.log(`📅 [TherapistTargetWidget] Fetching target for range: ${startDate} to ${endDate}`);

            // 1. Get Target Info with 3 args
            const result = await getTherapistTargetProgress(userId, startDate, endDate);
            
            const data = result.data;
            
            // If data is array and has items
            if (Array.isArray(data) && data.length > 0) {
                console.log(`✅ [TherapistTargetWidget] Data received:`, data[0]);
                const progress = data[0]; 
                
                // Calculate streak
                const currentStreak = calculateStreak(progress.actual_visits > 0); 
                setStreak(currentStreak);
                setTargetData(progress);
            } else {
                console.log(`ℹ️ [TherapistTargetWidget] No target data found (Empty array)`);
                setTargetData(null);
            }
        } catch (err) {
            console.error("❌ [TherapistTargetWidget] Error fetching target:", err);
            setError(err.message || "Gagal memuat data target.");
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <Card className="border-l-4 border-l-indigo-500 shadow-sm h-full">
                <CardContent className="flex items-center justify-center h-40">
                    <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                </CardContent>
            </Card>
        );
    }

    if (error) {
        return (
            <Card className="border-l-4 border-l-rose-500 shadow-sm h-full bg-rose-50/50">
                <CardContent className="flex flex-col items-center justify-center h-48 text-center p-6 space-y-3">
                    <div className="bg-rose-100 p-2 rounded-full">
                        <Target className="w-6 h-6 text-rose-400" />
                    </div>
                    <p className="text-sm font-medium text-rose-600">{error}</p>
                    <Button variant="outline" size="sm" onClick={fetchTargetAndStreak} className="bg-white hover:bg-rose-50 border-rose-200 text-rose-700">
                        <RefreshCcw className="w-3 h-3 mr-2" /> Coba Lagi
                    </Button>
                </CardContent>
            </Card>
        );
    }

    if (!targetData) {
        return (
            <Card className="border-l-4 border-l-slate-300 shadow-sm h-full bg-slate-50/50">
                <CardContent className="flex flex-col items-center justify-center h-48 text-center p-6">
                    <div className="bg-slate-100 p-3 rounded-full mb-3">
                        <Target className="w-6 h-6 text-slate-400" />
                    </div>
                    <p className="text-sm font-medium text-slate-600">Belum ada target aktif</p>
                    <p className="text-xs text-slate-400 mt-1">Target bulan ini belum tersedia.</p>
                </CardContent>
            </Card>
        );
    }

    const { 
        start_date, 
        end_date, 
        target_visits = 0, 
        actual_visits = 0, 
        achievement_percentage = 0, 
        status = 'BELUM TERCAPAI'
    } = targetData;

    // Visual Helpers
    const getStatusColor = (s) => {
        if (s === 'TERCAPAI') return 'bg-emerald-100 text-emerald-800 border-emerald-200';
        if (s === 'BELUM TERCAPAI') return 'bg-amber-100 text-amber-800 border-amber-200';
        return 'bg-rose-100 text-rose-800 border-rose-200'; 
    };

    const getProgressColor = (pct) => {
        if (pct >= 100) return 'bg-emerald-500';
        if (pct >= 80) return 'bg-amber-500';
        return 'bg-indigo-500';
    };

    const getStreakColor = (count) => {
        if (count >= 7) return 'text-rose-500';
        if (count >= 3) return 'text-orange-500';
        return 'text-slate-400';
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
        >
            <Card className="border-l-4 border-l-indigo-500 shadow-sm hover:shadow-md transition-shadow h-full relative overflow-hidden bg-white">
                <CardContent className="p-6">
                    {/* Header: Period & Status */}
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
                                <Calendar className="w-3.5 h-3.5" />
                                <span>
                                    {start_date ? format(parseISO(start_date), 'dd MMM') : '-'} - {end_date ? format(parseISO(end_date), 'dd MMM yyyy', { locale: idLocale }) : '-'}
                                </span>
                            </div>
                            <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                                Target Kunjungan
                                {achievement_percentage >= 100 && (
                                    <motion.span 
                                        initial={{ scale: 0 }} animate={{ scale: 1, rotate: [0, 10, -10, 0] }}
                                        className="bg-yellow-100 text-yellow-700 text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 border border-yellow-200"
                                    >
                                        <Trophy className="w-3 h-3" /> Target Hero
                                    </motion.span>
                                )}
                            </h3>
                        </div>
                        <Badge variant="outline" className={`${getStatusColor(status)} shadow-none`}>
                            {status}
                        </Badge>
                    </div>

                    {/* Motivation Text */}
                    <div className="mb-6 bg-slate-50 p-3 rounded-lg border border-slate-100 flex items-start gap-3">
                        <TrendingUp className="w-5 h-5 text-indigo-500 mt-0.5 shrink-0" />
                        <div>
                            <p className="text-sm font-medium text-slate-700 italic">"{getMotivationByProgress(achievement_percentage)}"</p>
                        </div>
                    </div>

                    {/* Metrics Grid */}
                    <div className="grid grid-cols-3 gap-4 mb-6 text-center divide-x divide-slate-100">
                        <div>
                            <p className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">Target</p>
                            <p className="text-xl font-bold text-slate-800">{target_visits}</p>
                        </div>
                        <div>
                            <p className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">Capaian</p>
                            <p className={`text-xl font-bold ${achievement_percentage >= 100 ? 'text-emerald-600' : 'text-indigo-600'}`}>
                                {actual_visits}
                            </p>
                        </div>
                        <div>
                            <p className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">Persen</p>
                            <p className="text-xl font-bold text-slate-800">{Math.min(achievement_percentage, 100).toFixed(0)}%</p>
                        </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="mb-4">
                        <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                            <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${Math.min(achievement_percentage, 100)}%` }}
                                transition={{ duration: 1, ease: "easeOut" }}
                                className={`h-full ${getProgressColor(achievement_percentage)} relative`}
                            >
                                <div className="absolute inset-0 bg-white/20 animate-[shimmer_2s_infinite] skew-x-12"></div>
                            </motion.div>
                        </div>
                    </div>

                    {/* Footer: Streak & Helper */}
                    <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                        <div className="flex items-center gap-1.5" title="Hari berturut-turut ada kunjungan">
                            <Flame className={`w-4 h-4 ${getStreakColor(streak)}`} />
                            <span className="text-xs font-semibold text-slate-600">
                                {streak > 0 ? `${streak} Hari Streak` : 'Mulai Streak!'}
                            </span>
                        </div>
                        <p className="text-[10px] text-slate-400 flex items-center gap-1">
                            💙 Fokus ke pasien, data otomatis terupdate
                        </p>
                    </div>
                </CardContent>
            </Card>
        </motion.div>
    );
};

export default TherapistTargetWidget;