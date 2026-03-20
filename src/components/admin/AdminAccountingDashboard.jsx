import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Filter, AlertCircle, Loader2, FileText, Wallet, Calendar } from 'lucide-react';
import { startOfMonth, endOfMonth, format } from 'date-fns';
import { getAdminAccountingReport } from '@/lib/api';

import AdminExpenseForm from './accounting/AdminExpenseForm';
import AdminIncomeForm from './accounting/AdminIncomeForm';
import AdminExpenseList from './accounting/AdminExpenseList';
import AdminIncomeList from './accounting/AdminIncomeList';
import AdminAccountingReport from './accounting/AdminAccountingReport';

// Modals
import AdminExpenseEditModal from './accounting/AdminExpenseEditModal';
import AdminExpenseDeleteConfirmationModal from './accounting/AdminExpenseDeleteConfirmationModal';
import AdminIncomeEditModal from './accounting/AdminIncomeEditModal';
import AdminIncomeDeleteConfirmationModal from './accounting/AdminIncomeDeleteConfirmationModal';

const AdminAccountingDashboard = ({ initialData, dateRange: propDateRange }) => {
  const [dateRange, setDateRange] = useState(propDateRange || {
    startDate: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    endDate: format(endOfMonth(new Date()), 'yyyy-MM-dd')
  });
  
  const [activeTab, setActiveTab] = useState("expenses");
  
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState(null);
  const [reportData, setReportData] = useState(initialData || {
    total_income: 0,
    total_expenses: 0,
    expenses_breakdown: [],
    income_breakdown: []
  });

  // --- Modal States ---
  // Expense
  const [editingExpense, setEditingExpense] = useState(null);
  const [deletingExpense, setDeletingExpense] = useState(null);
  const [showExpenseEditModal, setShowExpenseEditModal] = useState(false);
  const [showExpenseDeleteModal, setShowExpenseDeleteModal] = useState(false);

  // Income
  const [editingIncome, setEditingIncome] = useState(null);
  const [deletingIncome, setDeletingIncome] = useState(null);
  const [showIncomeEditModal, setShowIncomeEditModal] = useState(false);
  const [showIncomeDeleteModal, setShowIncomeDeleteModal] = useState(false);

  useEffect(() => {
    if (initialData) {
      setReportData(initialData);
      setLoading(false);
    } else {
      fetchData();
    }
  }, [initialData, dateRange]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await getAdminAccountingReport({ 
        startDate: dateRange.startDate, 
        endDate: dateRange.endDate 
      });
      
      if (error) throw error;
      
      if (data) {
        setReportData({
          total_income: data.total_income || 0,
          total_expenses: data.total_expenses || 0,
          expenses_breakdown: Array.isArray(data.expenses_breakdown) ? data.expenses_breakdown : [],
          income_breakdown: Array.isArray(data.income_breakdown) ? data.income_breakdown : []
        });
      } else {
        // Fallback if data is null
        setReportData({
          total_income: 0,
          total_expenses: 0,
          expenses_breakdown: [],
          income_breakdown: []
        });
      }
    } catch (err) {
      console.error('[DASHBOARD] Fetch error:', err);
      setError(err.message || 'Failed to fetch accounting data');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
     fetchData();
  };

  // --- Expense Handlers ---
  const handleEditExpense = (expense) => {
    setEditingExpense(expense);
    setShowExpenseEditModal(true);
  };

  const handleDeleteExpense = (expense) => {
    setDeletingExpense(expense);
    setShowExpenseDeleteModal(true);
  };

  // --- Income Handlers ---
  const handleEditIncome = (income) => {
    setEditingIncome(income);
    setShowIncomeEditModal(true);
  };

  const handleDeleteIncome = (income) => {
    setDeletingIncome(income);
    setShowIncomeDeleteModal(true);
  };

  const safeExpenses = Array.isArray(reportData?.expenses_breakdown) ? reportData.expenses_breakdown : [];
  const safeIncome = Array.isArray(reportData?.income_breakdown) ? reportData.income_breakdown : [];

  if (loading && !reportData.expenses_breakdown) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center text-red-600 bg-red-50 rounded-lg border border-red-200">
        <AlertCircle className="w-10 h-10 mx-auto mb-3" />
        <h3 className="font-bold text-lg">Gagal Memuat Data</h3>
        <p className="mb-4">{error}</p>
        <Button onClick={fetchData} variant="outline" className="border-red-200 hover:bg-red-100">
          Coba Lagi
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full font-sans">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Akuntansi & Keuangan</h1>
          <p className="text-slate-500 mt-1">Kelola arus kas operasional klinik (Admin)</p>
        </div>

        <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
          <div className="px-2 text-slate-400">
             <Calendar className="w-4 h-4" />
          </div>
          <input 
            type="date" 
            className="bg-transparent border-none text-sm font-medium focus:ring-0 text-slate-700 w-32"
            value={dateRange.startDate}
            onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
          />
          <span className="text-slate-300">|</span>
          <input 
            type="date" 
            className="bg-transparent border-none text-sm font-medium focus:ring-0 text-slate-700 w-32"
            value={dateRange.endDate}
            onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
          />
          <Button onClick={fetchData} size="sm" className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm h-8">
            <Filter className="w-3.5 h-3.5 mr-1.5" /> Filter
          </Button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setActiveTab("expenses")}
          className={`px-5 py-2.5 rounded-xl font-medium transition-all flex items-center gap-2.5 text-sm ${
            activeTab === "expenses" 
              ? "bg-rose-600 text-white shadow-lg shadow-rose-200 ring-1 ring-rose-500 ring-offset-1" 
              : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200 shadow-sm"
          }`}
        >
          <Wallet className="w-4 h-4" />
          Pengeluaran
        </button>
        <button
          onClick={() => setActiveTab("income")}
          className={`px-5 py-2.5 rounded-xl font-medium transition-all flex items-center gap-2.5 text-sm ${
            activeTab === "income" 
              ? "bg-emerald-600 text-white shadow-lg shadow-emerald-200 ring-1 ring-emerald-500 ring-offset-1" 
              : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200 shadow-sm"
          }`}
        >
          <Wallet className="w-4 h-4" />
          Pemasukan
        </button>
        <button
          onClick={() => setActiveTab("reports")}
          className={`px-5 py-2.5 rounded-xl font-medium transition-all flex items-center gap-2.5 text-sm ${
            activeTab === "reports" 
              ? "bg-blue-600 text-white shadow-lg shadow-blue-200 ring-1 ring-blue-500 ring-offset-1" 
              : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200 shadow-sm"
          }`}
        >
          <FileText className="w-4 h-4" />
          Laporan
        </button>
      </div>

      {/* Content Area */}
      <div className="w-full">
        {activeTab === "expenses" && (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-1">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm sticky top-4">
                <div className="mb-4 pb-4 border-b border-slate-100">
                   <h3 className="font-bold text-slate-800 text-lg">Input Pengeluaran</h3>
                   <p className="text-slate-500 text-sm">Catat pengeluaran operasional baru</p>
                </div>
                <AdminExpenseForm onSuccess={handleRefresh} />
              </div>
            </div>
            <div className="xl:col-span-2 space-y-4">
              <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                 Daftar Pengeluaran 
                 <span className="text-xs font-normal bg-slate-100 px-2 py-0.5 rounded-full text-slate-500 border border-slate-200">
                    {safeExpenses.length} transaksi
                 </span>
              </h3>
              <AdminExpenseList 
                expenses={safeExpenses} 
                onRefresh={handleRefresh} 
                onEdit={handleEditExpense}
                onDelete={handleDeleteExpense}
                canEdit={true}
                canDelete={true}
              />
            </div>
          </div>
        )}

        {activeTab === "income" && (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-1">
               <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm sticky top-4">
                <div className="mb-4 pb-4 border-b border-slate-100">
                   <h3 className="font-bold text-slate-800 text-lg">Input Pemasukan</h3>
                   <p className="text-slate-500 text-sm">Catat pemasukan tambahan (non-pasien)</p>
                </div>
                <AdminIncomeForm onSuccess={handleRefresh} />
              </div>
            </div>
            <div className="xl:col-span-2 space-y-4">
              <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                 Daftar Pemasukan
                 <span className="text-xs font-normal bg-slate-100 px-2 py-0.5 rounded-full text-slate-500 border border-slate-200">
                    {safeIncome.length} transaksi
                 </span>
              </h3>
              <AdminIncomeList 
                income={safeIncome} 
                onRefresh={handleRefresh} 
                onEdit={handleEditIncome} 
                onDelete={handleDeleteIncome}
                canEdit={true}
                canDelete={true}
              />
            </div>
          </div>
        )}

        {activeTab === "reports" && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <AdminAccountingReport data={reportData} dateRange={dateRange} />
          </div>
        )}
      </div>

      {/* --- Modals --- */}
      
      {/* Expense Edit */}
      <AdminExpenseEditModal 
        isOpen={showExpenseEditModal}
        onClose={() => setShowExpenseEditModal(false)}
        expense={editingExpense}
        onSuccess={handleRefresh}
      />
      
      {/* Expense Delete Confirmation */}
      <AdminExpenseDeleteConfirmationModal 
        isOpen={showExpenseDeleteModal}
        onClose={() => setShowExpenseDeleteModal(false)}
        expense={deletingExpense}
        onSuccess={handleRefresh}
      />
      
      {/* Income Edit */}
      <AdminIncomeEditModal 
        isOpen={showIncomeEditModal}
        onClose={() => setShowIncomeEditModal(false)}
        income={editingIncome}
        onSuccess={handleRefresh}
      />

      {/* Income Delete Confirmation */}
      <AdminIncomeDeleteConfirmationModal 
        isOpen={showIncomeDeleteModal}
        onClose={() => setShowIncomeDeleteModal(false)}
        income={deletingIncome}
        onSuccess={handleRefresh}
      />
    </div>
  );
};

export default AdminAccountingDashboard;