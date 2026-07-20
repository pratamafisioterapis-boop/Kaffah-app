import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, TrendingUp, TrendingDown } from 'lucide-react';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { format, isValid } from 'date-fns';

const AdminAccountingReport = ({ data, dateRange }) => {
  // Safety check for data
  if (!data) {
    return <div className="p-4 text-center text-gray-500">No data available for report.</div>;
  }

  const { 
    total_income = 0, 
    total_expenses = 0, 
    expenses_breakdown = [], 
    income_breakdown = [] 
  } = data;
  

  const exportPDF = () => {
    try {
      const doc = new jsPDF();
      
      doc.setFontSize(18);
      doc.text('Admin Accounting Report', 14, 22);
      
      doc.setFontSize(11);
      
      // Safe date formatting
      const startDate = dateRange?.startDate ? new Date(dateRange.startDate) : new Date();
      const endDate = dateRange?.endDate ? new Date(dateRange.endDate) : new Date();
      
      const formattedStart = isValid(startDate) ? format(startDate, 'dd MMM yyyy') : '-';
      const formattedEnd = isValid(endDate) ? format(endDate, 'dd MMM yyyy') : '-';

      doc.text(`Period: ${formattedStart} - ${formattedEnd}`, 14, 32);
      
      doc.autoTable({
        startY: 40,
        head: [['Metric', 'Amount (IDR)']],
        body: [
          ['Total Income', parseFloat(total_income || 0).toLocaleString('id-ID')],
          ['Total Expenses', parseFloat(total_expenses || 0).toLocaleString('id-ID')],
        ],
        theme: 'grid',
      });

      // Expenses Table
      doc.text('Expenses Detail', 14, doc.lastAutoTable.finalY + 15);
      
      const expenseRows = Array.isArray(expenses_breakdown) ? expenses_breakdown.map(e => [
        e.transaction_date && isValid(new Date(e.transaction_date)) ? format(new Date(e.transaction_date), 'dd/MM/yyyy') : '-',
        e.category || '-',
        e.description || '-',
        parseFloat(e.amount || 0).toLocaleString('id-ID')
      ]) : [];

      doc.autoTable({
        startY: doc.lastAutoTable.finalY + 20,
        head: [['Date', 'Category', 'Description', 'Amount']],
        body: expenseRows.length > 0 ? expenseRows : [['-', '-', 'No Data', '0']],
      });

      // Income Table
      doc.text('Income Detail', 14, doc.lastAutoTable.finalY + 15);
      
      const incomeRows = Array.isArray(income_breakdown) ? income_breakdown.map(i => [
        i.transaction_date && isValid(new Date(i.transaction_date)) ? format(new Date(i.transaction_date), 'dd/MM/yyyy') : '-',
        i.source || '-',
        i.description || '-',
        parseFloat(i.amount || 0).toLocaleString('id-ID')
      ]) : [];

      doc.autoTable({
        startY: doc.lastAutoTable.finalY + 20,
        head: [['Date', 'Source', 'Description', 'Amount']],
        body: incomeRows.length > 0 ? incomeRows : [['-', '-', 'No Data', '0']],
      });

      doc.save('admin-accounting-report.pdf');
    } catch (error) {
      console.error("Error generating PDF:", error);
      alert("Failed to generate PDF report. Please check console for details.");
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-bold text-gray-800">Financial Summary Report</h3>
        <Button onClick={exportPDF} variant="outline" className="gap-2 border-gray-300">
          <Download className="w-4 h-4" /> Export PDF
        </Button>
      </div>

      {/* Summary Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-blue-100 border-blue-200 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex justify-between items-start">
              <CardTitle className="text-sm font-bold text-blue-800 uppercase tracking-wider">Total Income</CardTitle>
              <TrendingUp className="w-5 h-5 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-900">
              Rp {parseFloat(total_income || 0).toLocaleString('id-ID')}
            </div>
            <p className="text-xs text-blue-700 mt-1">Total operational income</p>
          </CardContent>
        </Card>
        
        <Card className="bg-red-100 border-red-200 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex justify-between items-start">
              <CardTitle className="text-sm font-bold text-red-800 uppercase tracking-wider">Total Expenses</CardTitle>
              <TrendingDown className="w-5 h-5 text-red-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-900">
              Rp {parseFloat(total_expenses || 0).toLocaleString('id-ID')}
            </div>
            <p className="text-xs text-red-700 mt-1">Total operational costs</p>
          </CardContent>
        </Card>

      </div>

      {/* Visual Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
          <h4 className="font-semibold text-gray-800 mb-4">Expense Distribution</h4>
          {Array.isArray(expenses_breakdown) && expenses_breakdown.length > 0 ? (
            <div className="space-y-3">
              {Object.entries(
                expenses_breakdown.reduce((acc, curr) => {
                  const cat = curr.category || 'Uncategorized';
                  acc[cat] = (acc[cat] || 0) + parseFloat(curr.amount || 0);
                  return acc;
                }, {})
              )
              .sort(([, a], [, b]) => b - a)
              .slice(0, 5)
              .map(([cat, amount], idx) => (
                <div key={idx} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-2 h-2 rounded-full bg-red-500 shrink-0"></div>
                    <span className="text-sm font-medium text-gray-700 truncate">{cat}</span>
                  </div>
                  <span className="text-sm font-bold text-gray-900 shrink-0 whitespace-nowrap">Rp {amount.toLocaleString('id-ID')}</span>
                </div>
              ))}
            </div>
          ) : (
             <p className="text-gray-500 text-sm">No expenses recorded for this period.</p>
          )}
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
           <h4 className="font-semibold text-gray-800 mb-4">Income Sources</h4>
           {Array.isArray(income_breakdown) && income_breakdown.length > 0 ? (
            <div className="space-y-3">
              {Object.entries(
                income_breakdown.reduce((acc, curr) => {
                  const src = curr.source || 'Uncategorized';
                  acc[src] = (acc[src] || 0) + parseFloat(curr.amount || 0);
                  return acc;
                }, {})
              )
              .sort(([, a], [, b]) => b - a)
              .slice(0, 5)
              .map(([source, amount], idx) => (
                <div key={idx} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-2 h-2 rounded-full bg-green-500 shrink-0"></div>
                    <span className="text-sm font-medium text-gray-700 truncate">{source}</span>
                  </div>
                  <span className="text-sm font-bold text-gray-900 shrink-0 whitespace-nowrap">Rp {amount.toLocaleString('id-ID')}</span>
                </div>
              ))}
            </div>
          ) : (
             <p className="text-gray-500 text-sm">No income recorded for this period.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminAccountingReport;