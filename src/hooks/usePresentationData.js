import { useState, useEffect, useCallback } from 'react';
import { format, eachDayOfInterval, isSameDay, parseISO, getDay } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { supabase } from '@/lib/customSupabaseClient';
import {
  fetchTotalSessions,
  fetchTotalPatients,
  fetchTotalPackages,
  fetchCompletedSessions,
  fetchActiveTherapists,
  fetchEmptySlots,
  getOwnerIncome,
  getAdminIncome,
  getPatientIncomeFromPackages,
  getOwnerExpenditures,
  getAdminExpenses,
  getBepFinancials,
  fetchPatientMixForRange,
  fetchCancellationRate,
  getPackageRenewalRate,
  getTotalOutstandingReceivables,
  getClinicStaffQualitySummary,
  getPeriodGrowth,
} from '@/lib/api';

const WEEKDAY_LABELS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const sumAmount = (rows) => (rows || []).reduce((s, r) => s + (Number(r.amount) || 0), 0);

const resolveClinicId = async () => {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData?.session?.user?.id;
  if (!userId) return null;
  const { data: userRow } = await supabase.from('users').select('clinic_id').eq('id', userId).single();
  return userRow?.clinic_id || null;
};

// Semua data yang dibutuhkan slideshow "Presentasi Direksi", diambil sekali di
// satu tempat (bukan per-widget seperti pola dashboard biasa) supaya
// transisi antar slide saat presentasi tidak ada chart yang pop-in bergantian.
export const usePresentationData = (dateRange) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { startDate, endDate } = dateRange;
      const clinicId = await resolveClinicId();

      const [
        sessionsRes, patientsRes, packagesRes, completedRes, activeTherapistsRes, emptySlotsRes,
        ownerIncRes, adminIncRes, patientIncRes, ownerExpRes, adminExpRes, bepRes,
        patientMixRes, cancellationRes, packageRenewalRes, receivablesRes, staffQualityRes, growthRes,
        dailyRecapsRes, appointmentsRes,
      ] = await Promise.all([
        fetchTotalSessions(startDate, endDate),
        fetchTotalPatients(startDate, endDate),
        fetchTotalPackages(startDate, endDate),
        fetchCompletedSessions(),
        fetchActiveTherapists(),
        fetchEmptySlots(),
        getOwnerIncome({ startDate, endDate }),
        getAdminIncome({ startDate, endDate }),
        getPatientIncomeFromPackages({ startDate, endDate }),
        getOwnerExpenditures({ startDate, endDate }),
        getAdminExpenses({ startDate, endDate }),
        getBepFinancials(),
        fetchPatientMixForRange({ startDate, endDate }),
        fetchCancellationRate({ startDate, endDate }),
        getPackageRenewalRate({ startDate, endDate }),
        getTotalOutstandingReceivables(),
        getClinicStaffQualitySummary({ startDate, endDate }),
        getPeriodGrowth({ startDate, endDate }),
        supabase.from('daily_recaps').select('recap_date, amount').eq('clinic_id', clinicId)
          .gte('recap_date', startDate).lte('recap_date', endDate),
        supabase.from('appointments').select('appointment_date, status').eq('clinic_id', clinicId)
          .gte('appointment_date', `${startDate}T00:00:00`).lte('appointment_date', `${endDate}T23:59:59`),
      ]);

      const dayInterval = eachDayOfInterval({ start: parseISO(startDate), end: parseISO(endDate) });
      const dailyRecaps = dailyRecapsRes?.data || [];
      const appointments = appointmentsRes?.data || [];

      // Tren sesi & revenue harian untuk chart (dibatasi ke maksimal ~62 titik
      // supaya chart tetap terbaca kalau rentang tanggalnya panjang).
      const trendDays = dayInterval.length > 62
        ? dayInterval.filter((_, i) => i % Math.ceil(dayInterval.length / 62) === 0)
        : dayInterval;

      const sessionTrend = trendDays.map((day) => ({
        date: format(day, 'dd MMM', { locale: idLocale }),
        fullDate: format(day, 'dd MMM yyyy', { locale: idLocale }),
        sessions: dailyRecaps.filter((r) => isSameDay(parseISO(r.recap_date), day)).length,
        revenue: sumAmount(dailyRecaps.filter((r) => isSameDay(parseISO(r.recap_date), day))),
      }));

      const statusCounts = {};
      appointments.forEach((a) => {
        statusCounts[a.status] = (statusCounts[a.status] || 0) + 1;
      });
      const statusBreakdown = Object.entries(statusCounts).map(([status, count]) => ({ status, count }));

      const weekdayCounts = WEEKDAY_LABELS.map(() => 0);
      appointments.forEach((a) => {
        const dayIdx = getDay(parseISO(a.appointment_date));
        weekdayCounts[dayIdx] += 1;
      });
      const byWeekday = WEEKDAY_LABELS.map((label, idx) => ({ day: label, count: weekdayCounts[idx] }));
      const busiestDay = byWeekday.reduce((max, d) => (d.count > max.count ? d : max), byWeekday[0]);

      const totalRevenue = sumAmount(ownerIncRes?.data) + sumAmount(adminIncRes?.data) + sumAmount(patientIncRes?.data);
      const totalExpenses = sumAmount(ownerExpRes?.data) + sumAmount(adminExpRes?.data);
      const netProfit = totalRevenue - totalExpenses;
      const profitMargin = totalRevenue > 0 ? Math.round((netProfit / totalRevenue) * 100) : 0;

      setData({
        operational: {
          totalSessions: sessionsRes?.data || 0,
          totalPatients: patientsRes?.data || 0,
          totalPackages: packagesRes?.data || 0,
          completedSessions: completedRes?.data || 0,
          // fetchActiveTherapists (alias getActivePhysiotherapists) mengembalikan
          // array baris terapis, bukan hitungan — ambil panjangnya.
          activeTherapists: (activeTherapistsRes?.data || []).length,
          emptySlotsToday: emptySlotsRes?.data || 0,
          sessionTrend,
        },
        finance: {
          totalRevenue,
          totalExpenses,
          netProfit,
          profitMargin,
          revenueTrend: sessionTrend,
          bep: bepRes?.data || null,
        },
        appointment: {
          statusBreakdown,
          byWeekday,
          busiestDay,
          totalAppointments: appointments.length,
        },
        growth: growthRes?.data || null,
        patientMix: patientMixRes?.data || null,
        cancellation: cancellationRes?.data || null,
        packageRenewal: packageRenewalRes?.data || null,
        receivables: receivablesRes?.data || null,
        staffQuality: staffQualityRes?.data || null,
      });
    } catch (err) {
      console.error('Failed to load presentation data:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return { data, loading, error, refetch: fetchAll };
};
