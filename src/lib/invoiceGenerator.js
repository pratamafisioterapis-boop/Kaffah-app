import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { format } from 'date-fns';

export const generateInvoicePDF = (recap, activePackage, clinic = {}) => {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;

  const clinicName = clinic.name || '';
  const clinicNameParts = clinicName.split(' ');
  const clinicNameLine1 = clinicNameParts[0] || '';
  const clinicNameLine2 = clinicNameParts.slice(1).join(' ');

  // --- 1. Blue Sidebar (Left) ---
  // Color: #1e3a8a (approx Tailwind blue-900)
  doc.setFillColor(30, 58, 138);
  doc.rect(0, 0, 60, pageHeight, 'F'); // Sidebar width 60mm

  // Sidebar Content - Logo Area
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(32);
  doc.setFont('helvetica', 'bold');

  // Big initial-letter logo simulation
  doc.text(clinicNameLine1.charAt(0).toUpperCase(), 30, 40, { align: 'center' });

  doc.setFontSize(14);
  doc.text(clinicNameLine1.toUpperCase(), 30, 50, { align: 'center' });
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(clinicNameLine2.toUpperCase(), 30, 55, { align: 'center' });

  // Sidebar Content - Company Info
  const sidebarContentY = 90;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(clinicName.toUpperCase(), 30, sidebarContentY, { align: 'center' });

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  const address = clinic.address || '';
  doc.text(address, 30, sidebarContentY + 10, { align: 'center', lineHeightFactor: 1.5 });

  doc.text(clinic.email || '', 30, sidebarContentY + 30, { align: 'center' });
  doc.text(clinic.phone || '', 30, sidebarContentY + 35, { align: 'center' });

  // --- 2. Main Content Area (Right Side) ---
  const contentStartX = 70; // Start after sidebar
  const contentWidth = pageWidth - contentStartX - 10;
  
  // Header: Date & Receipt
  doc.setTextColor(0, 0, 0);
  const headerY = 20;
  
  // Receipt Number Generation
  const receiptNo = recap.id.substring(0, 8).toUpperCase();
  const dateStr = format(new Date(recap.recap_date), 'dd MMMM yyyy');

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  
  // Align to right edge
  const rightEdge = pageWidth - 15;
  
  doc.text("DATE", rightEdge - 30, headerY);
  doc.setFont('helvetica', 'normal');
  doc.text(dateStr, rightEdge, headerY, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.text("RECEIPT NO.", rightEdge - 30, headerY + 10);
  doc.setFont('helvetica', 'normal');
  doc.text(receiptNo, rightEdge, headerY + 10, { align: 'right' });

  // --- 3. Patient & Therapist Info ---
  const infoY = 50;
  
  // Label Style
  const drawLabel = (label, x, y) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text(label.toUpperCase(), x, y);
    doc.setTextColor(0, 0, 0);
  };

  // Value Style
  const drawValue = (value, x, y, maxWidth) => {
    doc.setFont('helvetica', 'bold'); // Changed to bold as per typical invoice style
    doc.setFontSize(10);
    if (maxWidth) {
       doc.text(value, x, y + 5, { maxWidth });
    } else {
       doc.text(value, x, y + 5);
    }
  };

  // Row 1: Patient Name & Therapist
  drawLabel("PATIENT NAME", contentStartX, infoY);
  drawValue(recap.patient?.full_name || "Guest", contentStartX, infoY);

  drawLabel("THERAPIST", contentStartX + 70, infoY);
  drawValue(recap.therapist_name || "-", contentStartX + 70, infoY);

  // Row 2: RM Number
  const infoY2 = infoY + 15;
  drawLabel("MEDICAL RECORD NO", contentStartX, infoY2);
  drawValue(recap.patient?.rm_number || "-", contentStartX, infoY2);

  // Row 3: Address & Phone
  const infoY3 = infoY2 + 15;
  drawLabel("ADDRESS", contentStartX, infoY3);
  doc.setFont('helvetica', 'normal'); // Address usually normal
  doc.setFontSize(9);
  doc.text(recap.patient?.address || "-", contentStartX, infoY3 + 5, { maxWidth: 60 });

  drawLabel("PHONE NUMBER", contentStartX + 70, infoY3);
  drawValue(recap.patient?.phone || "-", contentStartX + 70, infoY3);

  // --- 4. Services Table ---
  const tableY = infoY3 + 25;
  
  let sessionInfo = "-";
  if (activePackage) {
    sessionInfo = `${activePackage.sessions_used || 1} / ${activePackage.total_sessions}`;
  } else if (recap.package_type) {
    sessionInfo = "1";
  }

  const amount = Number(recap.amount);
  const formattedAmount = "Rp " + amount.toLocaleString('id-ID');

  doc.autoTable({
    startY: tableY,
    margin: { left: contentStartX, right: 15 },
    head: [['CODE', 'DESCRIPTION', 'SESSION', 'RATE']],
    body: [
      [
        'TR01', 
        recap.service_type || 'Physiotherapy Session', 
        sessionInfo, 
        formattedAmount
      ],
      ['', '', '', ''], // Spacer rows
      ['', '', '', ''],
    ],
    theme: 'plain',
    headStyles: {
      fillColor: [30, 58, 138],
      textColor: 255,
      fontSize: 8,
      fontStyle: 'bold',
      halign: 'center',
      cellPadding: 3
    },
    bodyStyles: {
      fontSize: 9,
      textColor: 0,
      cellPadding: 4,
      valign: 'middle'
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 20 },
      1: { cellWidth: 'auto' }, // Description
      2: { halign: 'center', cellWidth: 25 },
      3: { halign: 'right', cellWidth: 35 },
    },
    didDrawPage: (data) => {
      // Draw line at bottom of table
      doc.setDrawColor(200, 200, 200);
      doc.line(contentStartX, data.cursor.y, pageWidth - 15, data.cursor.y);
    }
  });

  // --- 5. Calculation Area ---
  let finalY = doc.lastAutoTable.finalY + 5;
  const calcXLabel = 130;
  const calcXValue = rightEdge;

  doc.setFontSize(9);
  
  // Subtotal
  doc.setFont('helvetica', 'normal');
  doc.text("SUBTOTAL", calcXLabel, finalY + 5);
  doc.setFont('helvetica', 'bold');
  doc.text(formattedAmount, calcXValue, finalY + 5, { align: 'right' });

  // Discount
  doc.setFont('helvetica', 'normal');
  doc.text("DISCOUNT", calcXLabel, finalY + 12);
  doc.setFont('helvetica', 'bold');
  doc.text("-", calcXValue, finalY + 12, { align: 'right' });

  // Total / Balance Paid
  finalY += 20;
  doc.setFillColor(30, 58, 138); // Blue box
  doc.rect(calcXLabel - 5, finalY, 70, 10, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text("BALANCE PAID", calcXLabel, finalY + 6);
  doc.text(formattedAmount, calcXValue, finalY + 6, { align: 'right' });

  // --- 6. Payment Methods ---
  doc.setTextColor(0, 0, 0);
  const paymentY = finalY + 25;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text("PAYMENT METHOD:", contentStartX, paymentY);
  
  const methods = [
    { label: 'Cash', x: 0 },
    { label: 'QRIS', x: 30 },
    { label: 'Debit', x: 60 },
    { label: 'Credit', x: 90 },
    { label: 'Transfer', x: 0, y: 10 },
    { label: 'Insurance', x: 30, y: 10 }
  ];

  const userMethod = (recap.payment_method || '').toLowerCase();
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);

  methods.forEach(m => {
    const startX = contentStartX + m.x;
    const startY = paymentY + 5 + (m.y || 0);
    
    // Draw Checkbox
    doc.setDrawColor(0);
    doc.rect(startX, startY, 4, 4);
    
    // Check mark
    if (userMethod.includes(m.label.toLowerCase())) {
        doc.setFont('zapfdingbats');
        doc.setFontSize(8);
        doc.text("4", startX + 0.5, startY + 3); // ZapfDingbats check
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
    }

    doc.text(m.label, startX + 6, startY + 3);
  });

  // --- 7. Signatures ---
  const sigY = paymentY + 40;
  
  // Therapist Signature
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text("Therapist,", contentStartX + 15, sigY, { align: 'center' });
  doc.line(contentStartX, sigY + 20, contentStartX + 30, sigY + 20);
  doc.text(`( ${recap.therapist_name?.split(' ')[0] || "          "} )`, contentStartX + 15, sigY + 24, { align: 'center' });

  // Patient Signature
  doc.text("Patient,", rightEdge - 20, sigY, { align: 'center' });
  doc.line(rightEdge - 40, sigY + 20, rightEdge, sigY + 20);
  doc.text(`( ${recap.patient?.full_name?.split(' ')[0] || "          "} )`, rightEdge - 20, sigY + 24, { align: 'center' });

  // Footer Note
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text(`Thank you for trusting ${clinicName} for your recovery.`, contentStartX, pageHeight - 10);

  return doc;
};