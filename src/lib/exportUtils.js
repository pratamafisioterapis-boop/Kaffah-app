import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { format } from 'date-fns';

const formatCurrency = (amount) => {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
};

export const generateExcelReport = (incomeData, expenseData, dateRange) => {
    const totalIncome = incomeData.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
    const totalExpenses = expenseData.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
    const netProfit = totalIncome - totalExpenses;
    
    const startDate = dateRange.startDate ? format(new Date(dateRange.startDate), 'dd-MM-yyyy') : 'All_Time';
    const endDate = dateRange.endDate ? format(new Date(dateRange.endDate), 'dd-MM-yyyy') : 'All_Time';
    const fileName = `Report_${startDate}_${endDate}.xlsx`;

    // 1. Summary Sheet
    const summaryData = [
        ["Financial Report Summary"],
        ["Period", `${startDate} to ${endDate}`],
        [],
        ["Metric", "Amount (IDR)"],
        ["Total Income", totalIncome],
        ["Total Expenses", totalExpenses],
        ["Net Profit", netProfit],
    ];
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);

    // 2. Income Sheet
    const incomeRows = incomeData.map(item => ({
        Date: format(new Date(item.date), 'dd/MM/yyyy'),
        Source: item.source,
        Category: item.category,
        Description: item.description,
        Amount: Number(item.amount)
    }));
    const wsIncome = XLSX.utils.json_to_sheet(incomeRows);
    
    // Add totals to Income sheet
    XLSX.utils.sheet_add_aoa(wsIncome, [["", "", "", "Total Income", totalIncome]], { origin: -1 });

    // 3. Expense Sheet
    const expenseRows = expenseData.map(item => ({
        Date: format(new Date(item.date), 'dd/MM/yyyy'),
        Source: item.source,
        Category: item.category,
        Description: item.description,
        Amount: Number(item.amount)
    }));
    const wsExpenses = XLSX.utils.json_to_sheet(expenseRows);
    
    // Add totals to Expense sheet
    XLSX.utils.sheet_add_aoa(wsExpenses, [["", "", "", "Total Expenses", totalExpenses]], { origin: -1 });

    // Create Workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");
    XLSX.utils.book_append_sheet(wb, wsIncome, "Income");
    XLSX.utils.book_append_sheet(wb, wsExpenses, "Expenses");

    // Save
    XLSX.writeFile(wb, fileName);
};

export const generatePDFReport = (incomeData, expenseData, dateRange) => {
    const doc = new jsPDF();
    const totalIncome = incomeData.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
    const totalExpenses = expenseData.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
    const netProfit = totalIncome - totalExpenses;

    const startDate = dateRange.startDate ? format(new Date(dateRange.startDate), 'dd MMM yyyy') : 'All Time';
    const endDate = dateRange.endDate ? format(new Date(dateRange.endDate), 'dd MMM yyyy') : 'All Time';

    // Title
    doc.setFontSize(20);
    doc.text("Financial Report", 14, 22);
    
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Period: ${startDate} - ${endDate}`, 14, 30);

    // Summary Section
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text("Summary", 14, 45);

    doc.autoTable({
        startY: 50,
        head: [['Metric', 'Amount']],
        body: [
            ['Total Income', formatCurrency(totalIncome)],
            ['Total Expenses', formatCurrency(totalExpenses)],
            ['Net Profit', formatCurrency(netProfit)]
        ],
        theme: 'striped',
        headStyles: { fillColor: [66, 66, 66] },
        styles: { fontSize: 10, cellPadding: 3 },
    });

    // Income Section
    let finalY = doc.lastAutoTable.finalY + 15;
    doc.setFontSize(14);
    doc.text("Detailed Income", 14, finalY);

    doc.autoTable({
        startY: finalY + 5,
        head: [['Date', 'Source', 'Category', 'Description', 'Amount']],
        body: incomeData.map(item => [
            format(new Date(item.date), 'dd/MM/yyyy'),
            item.source,
            item.category,
            item.description || '-',
            formatCurrency(item.amount)
        ]),
        theme: 'grid',
        headStyles: { fillColor: [16, 185, 129] }, // Emerald color
        styles: { fontSize: 8 },
        columnStyles: {
            4: { halign: 'right' }
        },
        foot: [['', '', '', 'Total Income', formatCurrency(totalIncome)]]
    });

    // Expenses Section
    finalY = doc.lastAutoTable.finalY + 15;
    
    // Check if new page needed
    if (finalY > 250) {
        doc.addPage();
        finalY = 20;
    }

    doc.setFontSize(14);
    doc.text("Detailed Expenses", 14, finalY);

    doc.autoTable({
        startY: finalY + 5,
        head: [['Date', 'Source', 'Category', 'Description', 'Amount']],
        body: expenseData.map(item => [
            format(new Date(item.date), 'dd/MM/yyyy'),
            item.source,
            item.category,
            item.description || '-',
            formatCurrency(item.amount)
        ]),
        theme: 'grid',
        headStyles: { fillColor: [244, 63, 94] }, // Rose color
        styles: { fontSize: 8 },
        columnStyles: {
            4: { halign: 'right' }
        },
        foot: [['', '', '', 'Total Expenses', formatCurrency(totalExpenses)]]
    });

    // Footer
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text('Generated by Kaffah System Care', 14, doc.internal.pageSize.height - 10);
        doc.text(`Page ${i} of ${pageCount}`, doc.internal.pageSize.width - 25, doc.internal.pageSize.height - 10);
    }

    const fileNameDate = dateRange.startDate ? format(new Date(dateRange.startDate), 'dd-MM-yyyy') : 'Report';
    doc.save(`Report_${fileNameDate}.pdf`);
};