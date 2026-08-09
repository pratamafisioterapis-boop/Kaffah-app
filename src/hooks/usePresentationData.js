import { useState, useEffect, useCallback } from 'react';
import { format, eachDayOfInterval, isSameDay, parseISO, getDay, getHours } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { supabase } from '@/lib/customSupabaseClient';
import {
  fetchTotalSessions,
  fetchTotalPatients,
  fetchTotalPackages,
  fetchActiveTherapists,
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
        sessionsRes, patientsRes, packagesRes, activeTherapistsRes,
        ownerIncRes, adminIncRes, patientIncRes, ownerExpRes, adminExpRes, bepRes,
        patientMixRes, cancellationRes, packageRenewalRes, receivablesRes, staffQualityRes, growthRes,
        dailyRecapsRes, appointmentsRes, paymentMethodOptionsRes,
      ] = await Promise.all([
        fetchTotalSessions(startDate, endDate),
        fetchTotalPatients(startDate, endDate),
        fetchTotalPackages(startDate, endDate),
        fetchActiveTherapists(),
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
        // `status` disertakan supaya sesi selesai bisa dihitung untuk seluruh
        // rentang tanggal yang dipilih, bukan cuma "hari ini" seperti di
        // dashboard biasa — tidak relevan untuk slideshow berbasis periode.
        // therapist_name/payment_method/package_tracking dipakai untuk
        // breakdown revenue per terapis & metode pembayaran (pola sama
        // dengan RevenueOverview.jsx) tanpa perlu query terpisah.
        supabase.from('daily_recaps')
          .select('recap_date, amount, status, therapist_name, payment_method, package_tracking_id, package_tracking(nominal, total_sessions)')
          .eq('clinic_id', clinicId)
          .gte('recap_date', startDate).lte('recap_date', endDate),
        supabase.from('appointments').select('appointment_date, status').eq('clinic_id', clinicId)
          .gte('appointment_date', `${startDate}T00:00:00`).lte('appointment_date', `${endDate}T23:59:59`),
        supabase.from('operational_options').select('id, label')
          .eq('category', 'payment_method').eq('clinic_id', clinicId),
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

      // Jam paling ramai (0-23) dari seluruh appointment pada periode ini.
      const hourCounts = Array.from({ length: 24 }, () => 0);
      appointments.forEach((a) => {
        hourCounts[getHours(parseISO(a.appointment_date))] += 1;
      });
      const peakHourIdx = hourCounts.reduce((maxIdx, count, idx) => (count > hourCounts[maxIdx] ? idx : maxIdx), 0);
      const peakHour = { hour: peakHourIdx, label: `${String(peakHourIdx).padStart(2, '0')}:00`, count: hourCounts[peakHourIdx] };

      const noShowCount = statusCounts['no_show'] || 0;
      const noShowRate = appointments.length > 0 ? Math.round((noShowCount / appointments.length) * 100) : 0;

      const completedSessionsRange = dailyRecaps.filter((r) => r.status === 'completed').length;
      const avgSessionsPerDay = dayInterval.length > 0
        ? Math.round(((sessionsRes?.data || 0) / dayInterval.length) * 10) / 10
        : 0;

      const totalRevenue = sumAmount(ownerIncRes?.data) + sumAmount(adminIncRes?.data) + sumAmount(patientIncRes?.data);
      const totalExpenses = sumAmount(ownerExpRes?.data) + sumAmount(adminExpRes?.data);
      const netProfit = totalRevenue - totalExpenses;
      const profitMargin = totalRevenue > 0 ? Math.round((netProfit / totalRevenue) * 100) : 0;
      const avgRevenuePerSession = (sessionsRes?.data || 0) > 0 ? Math.round(totalRevenue / sessionsRes.data) : 0;

      // ── Revenue & jumlah sesi per terapis (pola sama dengan RevenueOverview.jsx) ──
      const revenueByTherapistMap = {};
      const sessionsByTherapistMap = {};
      dailyRecaps.forEach((r) => {
        if (!r.therapist_name) return;
        sessionsByTherapistMap[r.therapist_name] = (sessionsByTherapistMap[r.therapist_name] || 0) + 1;
        const pkg = r.package_tracking;
        const revenueForRow = r.package_tracking_id && pkg?.total_sessions
          ? Number(pkg.nominal) / Number(pkg.total_sessions)
          : Number(r.amount) || 0;
        revenueByTherapistMap[r.therapist_name] = (revenueByTherapistMap[r.therapist_name] || 0) + revenueForRow;
      });
      const revenueByTherapist = Object.entries(revenueByTherapistMap)
        .map(([name, revenue]) => ({ name: name.split(',')[0], revenue: Math.round(revenue) }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 8);
      const sessionsByTherapist = Object.entries(sessionsByTherapistMap)
        .map(([name, sessions]) => ({ name: name.split(',')[0], sessions }))
        .sort((a, b) => b.sessions - a.sessions)
        .slice(0, 8);

      // ── Pemasukan per metode pembayaran ──
      const paymentMethodLabelMap = {};
      (paymentMethodOptionsRes?.data || []).forEach((pm) => { paymentMethodLabelMap[pm.id] = pm.label; });
      const paymentMethodMap = {};
      dailyRecaps.forEach((r) => {
        const amount = Number(r.amount) || 0;
        if (amount <= 0) return;
        const label = paymentMethodLabelMap[r.payment_method] || r.payment_method || 'Tidak Diketahui';
        paymentMethodMap[label] = (paymentMethodMap[label] || 0) + amount;
      });
      const paymentMethodBreakdown = Object.entries(paymentMethodMap)
        .map(([method, amount]) => ({ method, amount: Math.round(amount) }))
        .sort((a, b) => b.amount - a.amount);

      // ── Pengeluaran per kategori (owner + admin) ──
      const expenseCategoryMap = {};
      [...(ownerExpRes?.data || []), ...(adminExpRes?.data || [])].forEach((e) => {
        const category = e.category || 'Lainnya';
        expenseCategoryMap[category] = (expenseCategoryMap[category] || 0) + (Number(e.amount) || 0);
      });
      const expenseBreakdown = Object.entries(expenseCategoryMap)
        .map(([category, amount]) => ({ category, amount: Math.round(amount) }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 8);

      setData({
        operational: {
          totalSessions: sessionsRes?.data || 0,
          totalPatients: patientsRes?.data || 0,
          totalPackages: packagesRes?.data || 0,
          completedSessionsRange,
          avgSessionsPerDay,
          // fetchActiveTherapists (alias getActivePhysiotherapists) mengembalikan
          // array baris terapis, bukan hitungan — ambil panjangnya.
          activeTherapists: (activeTherapistsRes?.data || []).length,
          sessionTrend,
        },
        finance: {
          totalRevenue,
          totalExpenses,
          netProfit,
          profitMargin,
          avgRevenuePerSession,
          revenueTrend: sessionTrend,
          bep: bepRes?.data || null,
          paymentMethodBreakdown,
          expenseBreakdown,
        },
        appointment: {
          statusBreakdown,
          byWeekday,
          busiestDay,
          peakHour,
          noShowCount,
          noShowRate,
          totalAppointments: appointments.length,
        },
        therapistPerformance: {
          revenueByTherapist,
          sessionsByTherapist,
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
