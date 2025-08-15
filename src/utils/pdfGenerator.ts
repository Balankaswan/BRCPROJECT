import jsPDF from 'jspdf';
import { Bill, Memo, LoadingSlip, Party } from '../types';
import { formatCurrency, formatDate } from './calculations';
import { addBRCLogo } from './pdfGeneratorUtils';
import { STORAGE_KEYS } from './storage';

export const generateBillPDF = async (bill: Bill): Promise<void> => {
  console.log('Generating PDF for bill:', bill);
  
  // Create PDF in landscape mode
  const pdf = new jsPDF('l', 'mm', 'a4');
  const pageWidth = 297;
  const pageHeight = 210;
  const margin = 15;
  
  // Set default styles
  pdf.setTextColor(0, 0, 0);
  pdf.setDrawColor(0, 0, 0);
  pdf.setLineWidth(0.5);
  
  // === HEADER SECTION ===
  pdf.setFontSize(9);
  pdf.setFont('times', 'normal');
  pdf.text(formatDate(bill.billDate), margin, 12);
  pdf.text(`Bill - ${bill.billNo}`, pageWidth - margin - 30, 12);
  
  // === COMPANY SECTION ===
  const companyY = 20;
  
  // Simple black border around company section
  pdf.setLineWidth(1);
  pdf.setDrawColor(0, 0, 0);
  pdf.rect(margin, companyY, pageWidth - (2 * margin), 45, 'S');
  
  // Add BRC Logo
  await addBRCLogo(pdf, margin + 8, companyY + 5, 25, 20);
  
  // Company Name - with subtle blue color
  pdf.setFontSize(16);
  pdf.setFont('times', 'bold');
  pdf.setTextColor(0, 100, 200); // Subtle blue for company name
  pdf.text('BHAVISHYA ROAD CARRIERS', pageWidth / 2, companyY + 14, { align: 'center' });
  
  // Company Details - black text
  pdf.setFontSize(7);
  pdf.setFont('times', 'normal');
  pdf.setTextColor(0, 0, 0);
  pdf.text('Specialist in Heavy ODC, Hydraulic, Low Bed Trailer, Flat Bed Trailer Transport & Commission Agent', pageWidth / 2, companyY + 19, { align: 'center' });
  pdf.text('FLEET OWNERS, TRANSPORT CONTRACTORS & COMMISSION AGENTS', pageWidth / 2, companyY + 23, { align: 'center' });
  pdf.text('404, Parijaat Business Center, Nr. SP Ring Road, Aslali, Ahmedabad - 382405', pageWidth / 2, companyY + 27, { align: 'center' });
  pdf.text('(SUBJECT TO AHMEDABAD JURISDICTION)', pageWidth / 2, companyY + 31, { align: 'center' });
  
  // Contact Information - INSIDE the company box
  pdf.setFontSize(10);
  pdf.setFont('times', 'bold');
  pdf.text('MOB: 9824026576, 9824900776', margin + 40, companyY + 40);
  pdf.text('PAN NO: BNDPK7173D', pageWidth - margin - 60, companyY + 40);
  
  // === BILL INFORMATION ===
  const billInfoY = companyY + 60;
  
  pdf.setFontSize(10);
  pdf.setFont('times', 'bold');
  pdf.text(`M/S: ${bill.partyName || 'Not specified'}`, margin, billInfoY);
  
  pdf.text(`BILL NO: ${bill.billNo || 'N/A'}`, pageWidth - margin - 60, billInfoY);
  pdf.text(`BILL DATE: ${formatDate(bill.billDate || new Date().toISOString())}`, pageWidth - margin - 60, billInfoY + 6);
  
  // === TABLE WITH WIDER COLUMNS FOR AMOUNTS ===
  const tableY = billInfoY + 18;
  let currentY = tableY;
  
  // Table configuration with proper spacing and justification for landscape layout
  const headers = ['CN NO', 'LOADING DATE', 'FROM', 'TO', 'TRAILOR NO', 'WEIGHT', 'FREIGHT', 'RTO ', 'DETENTION', 'EXTRA WEIGHT', 'ADVANCE', 'BALANCE AMT'];
  const colWidths = [15, 23, 22, 22, 21, 14, 22, 22, 22, 23, 21, 22]; // Balanced widths with proper spacing
  const tableWidth = colWidths.reduce((sum, width) => sum + width, 0);
  const tableX = margin; // Start from left margin for full width utilization
  
  // === TABLE HEADER ===
  pdf.setFont('times', 'bold');
  pdf.setFontSize(8);
  pdf.setLineWidth(0.5);
  
  let currentX = tableX;
  
  // Draw header cells with proper fill and stroke
  headers.forEach((header, index) => {
    // Set colors before each cell to ensure consistency
    pdf.setDrawColor(0, 0, 0); // Black borders
    pdf.setFillColor(240, 240, 240); // Light gray background
    pdf.setTextColor(0, 0, 0); // Black text
    
    // Draw cell with fill and border
    pdf.rect(currentX, currentY, colWidths[index], 12, 'FD');
    
    // Ensure text color is black before drawing text
    pdf.setTextColor(0, 0, 0);
    pdf.text(header, currentX + colWidths[index] / 2, currentY + 7.5, { align: 'center' });
    currentX += colWidths[index];
  });
  
  currentY += 12;
  
  // === TABLE DATA ===
  pdf.setTextColor(0, 0, 0);
  pdf.setFont('times', 'normal');
  pdf.setFontSize(9); // Larger data font size
  pdf.setFillColor(255, 255, 255);
  
  const trips = bill.trips || [];
  const totalAdvance = (bill.advances || []).reduce((sum, adv) => sum + adv.amount, 0);
  
  if (trips.length === 0) {
    // Empty state
    pdf.rect(tableX, currentY, tableWidth, 14, 'FD');
    pdf.setFont('times', 'italic');
    pdf.text('No trips added to this bill', pageWidth / 2, currentY + 9, { align: 'center' });
    currentY += 14;
  } else {
    // Data rows
    trips.forEach((trip, index) => {
      currentX = tableX;
      
      const rtoChallanAmount = parseFloat(trip.rtoChallan) || 0;
      const balance = index === 0 ? (bill.totalFreight || 0) - totalAdvance + rtoChallanAmount + (bill.detention || 0) : 0;
      
      const rowData = [
        trip.cnNo && trip.cnNo.trim() !== '' ? trip.cnNo : `CN-${index + 1}`,
        formatDate(trip.loadingDate),
        (trip.from || '').substring(0, 11),
        (trip.to || '').substring(0, 11),
        trip.vehicle || '',
        `${trip.weight}MT`,
        formatCurrency(trip.freight),
        formatCurrency(rtoChallanAmount),
        index === 0 ? formatCurrency(bill.detention || 0) : '',
        '', // Extra weight column
        index === 0 ? formatCurrency(totalAdvance) : '',
        index === 0 ? formatCurrency(balance) : ''
      ];
      
      // Draw cells with proper spacing
      rowData.forEach((data, colIndex) => {
        // Set proper colors before drawing
        pdf.setDrawColor(0, 0, 0); // Black border
        pdf.setFillColor(255, 255, 255); // White background
        pdf.rect(currentX, currentY, colWidths[colIndex], 12, 'S'); // Just stroke, no fill
        
        // Ensure text color is black
        pdf.setTextColor(0, 0, 0);
        
        // Proper text positioning with adequate spacing to prevent merging
        if (colIndex >= 5 && colIndex <= 11 && data) { // Numeric columns - right align with proper padding
          pdf.text(data.toString(), currentX + colWidths[colIndex] - 3, currentY + 7.5, { align: 'right' });
        } else {
          // Text columns - left align with proper padding
          const maxChars = Math.floor(colWidths[colIndex] / 1.2); // Better character estimation
          const truncatedText = data.toString().length > maxChars ? data.toString().substring(0, maxChars - 2) + '..' : data.toString();
          pdf.text(truncatedText, currentX + 2, currentY + 7.5);
        }
        
        currentX += colWidths[colIndex];
      });
      
      currentY += 12;
    });
  }
  
  // === TOTAL ROW ===
  pdf.setFont('times', 'bold');
  pdf.setFontSize(10); // Larger total font
  
  const totalRtoChallan = trips.reduce((sum, trip) => sum + (parseFloat(trip.rtoChallan) || 0), 0);
  const finalBalance = (bill.totalFreight || 0) - totalAdvance + totalRtoChallan + (bill.detention || 0);
  
  const totalRowData = [
    '',
    '',
    '',
    '',
    '',
    '',
    formatCurrency(bill.totalFreight || 0),
    formatCurrency(totalRtoChallan),
    formatCurrency(bill.detention || 0),
    '',
    formatCurrency(totalAdvance),
    formatCurrency(finalBalance)
  ];
  
  currentX = tableX;
  
  // Set proper colors for total row
  pdf.setDrawColor(0, 0, 0); // Black border
  pdf.setTextColor(0, 0, 0); // Black text
  
  // Draw TOTAL label spanning first 6 columns
  pdf.rect(tableX, currentY, colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4] + colWidths[5], 12, 'S');
  pdf.text('TOTAL', tableX + 3, currentY + 7.5);
  
  // Draw total amounts in remaining columns with proper spacing
  let totalStartX = tableX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4] + colWidths[5];
  for (let i = 6; i < totalRowData.length; i++) {
    pdf.rect(totalStartX, currentY, colWidths[i], 12, 'S');
    if (totalRowData[i]) {
      // Ensure text color is black before drawing
      pdf.setTextColor(0, 0, 0);
      pdf.text(totalRowData[i], totalStartX + colWidths[i] - 3, currentY + 7.5, { align: 'right' });
    }
    totalStartX += colWidths[i];
  }
  
  currentY += 12;
  
  // === FOOTER SECTION - NO BORDERS ===
  const footerY = currentY + 15;
  
  // Bank Details - NO BORDER, subtle blue header
  pdf.setTextColor(0, 100, 200); // Subtle blue for headers
  pdf.setFont('times', 'bold');
  pdf.setFontSize(10);
  pdf.text('BANK DETAILS', margin, footerY);
  
  pdf.setTextColor(0, 0, 0);
  pdf.setFont('times', 'normal');
  pdf.setFontSize(8);
  pdf.text('BENEFICIARY NAME: BHAVISHYA ROAD CARRIERS', margin, footerY + 8);
  pdf.text('ACCOUNT NO: 231005501207', margin, footerY + 14);
  pdf.text('IFSC CODE: ICIC0002310', margin, footerY + 20);
  pdf.text('BRANCH NAME: GHODASAR, AHMEDABAD', margin, footerY + 26);
  
  // Signatory - NO BORDER, subtle blue header - RIGHT ALIGNED
  const sigX = pageWidth - margin - 80; // Better right alignment
  pdf.setTextColor(0, 100, 200); // Subtle blue for headers
  pdf.setFont('times', 'bold');
  pdf.setFontSize(10);
  pdf.text('FOR : BHAVISHYA ROAD CARRIERS', sigX, footerY, { align: 'right' });
  
  pdf.setTextColor(0, 0, 0);
  pdf.setFont('times', 'normal');
  pdf.setFontSize(8);
  pdf.text('AUTHORISED SIGNATORY', sigX, footerY + 20, { align: 'right' });
  
  // System credit footer
  pdf.setTextColor(128, 128, 128);
  pdf.setFont('times', 'normal');
  pdf.setFontSize(6);
  pdf.text('Bill generated by BHAVISHYA ROAD CARRIERS SYSTEM', pageWidth / 2, pageHeight - 8, { align: 'center' });
  
  // Page number
  pdf.text('1/1', pageWidth / 2, pageHeight - 3, { align: 'center' });
  
  // Save PDF
  const sanitizedPartyName = (bill.partyName || 'Unknown').replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
  const billNumber = bill.billNo || 'N/A';
  pdf.save(`BRC_Bill_${billNumber}_${sanitizedPartyName}.pdf`);
};

// Version that returns PDF object for preview (without auto-download)
export const generateBillPDFForPreview = async (bill: Bill): Promise<jsPDF> => {
  console.log('Generating PDF for bill:', bill);
  
  // Create PDF in landscape mode
  const pdf = new jsPDF('l', 'mm', 'a4');
  const pageWidth = 297;
  const pageHeight = 210;
  const margin = 15;
  
  // Set default styles
  pdf.setTextColor(0, 0, 0);
  pdf.setDrawColor(0, 0, 0);
  pdf.setLineWidth(0.5);
  
  // === HEADER SECTION ===
  pdf.setFontSize(9);
  pdf.setFont('times', 'normal');
  pdf.text(formatDate(bill.billDate), margin, 12);
  pdf.text(`Bill - ${bill.billNo}`, pageWidth - margin - 30, 12);
  
  // === COMPANY SECTION ===
  const companyY = 20;
  
  // Simple black border around company section
  pdf.setLineWidth(1);
  pdf.setDrawColor(0, 0, 0);
  pdf.rect(margin, companyY, pageWidth - (2 * margin), 45, 'S');
  
  // Add BRC Logo
  await addBRCLogo(pdf, margin + 8, companyY + 5, 25, 20);
  
  // Company Name - with subtle blue color
  pdf.setFontSize(16);
  pdf.setFont('times', 'bold');
  pdf.setTextColor(0, 100, 200); // Subtle blue for company name
  pdf.text('BHAVISHYA ROAD CARRIERS', pageWidth / 2, companyY + 14, { align: 'center' });
  
  // Company Details - black text
  pdf.setFontSize(7);
  pdf.setFont('times', 'normal');
  pdf.setTextColor(0, 0, 0);
  pdf.text('Specialist in Heavy ODC, Hydraulic, Low Bed Trailer, Flat Bed Trailer Transport & Commission Agent', pageWidth / 2, companyY + 19, { align: 'center' });
  pdf.text('FLEET OWNERS, TRANSPORT CONTRACTORS & COMMISSION AGENTS', pageWidth / 2, companyY + 23, { align: 'center' });
  pdf.text('404, Parijaat Business Center, Nr. SP Ring Road, Aslali, Ahmedabad - 382405', pageWidth / 2, companyY + 27, { align: 'center' });
  pdf.text('Mobile: +91 98250 29702 | Email: bhavishyaroadcarriers@gmail.com', pageWidth / 2, companyY + 31, { align: 'center' });
  
  // Party Details Section
  const partyY = companyY + 50;
  pdf.setFontSize(10);
  pdf.setFont('times', 'bold');
  pdf.text('PARTY DETAILS:', margin, partyY);
  pdf.setFont('times', 'normal');
  pdf.text(bill.partyName, margin + 35, partyY);
  
  // === TRIPS TABLE ===
  const tableY = partyY + 15;
  
  // Table headers with professional styling
  pdf.setFillColor(240, 240, 240); // Light gray background
  pdf.rect(margin, tableY, pageWidth - (2 * margin), 10, 'F');
  
  pdf.setFontSize(8);
  pdf.setFont('times', 'bold');
  pdf.setTextColor(0, 0, 0);
  
  // Column widths: [20, 22, 25, 25, 20, 15, 18, 20, 18, 20, 18, 22]
  const colWidths = [20, 22, 25, 25, 20, 15, 18, 20, 18, 20, 18, 22];
  let currentX = margin;
  
  const headers = ['S.No', 'Date', 'From', 'To', 'Vehicle', 'Weight', 'Rate', 'Freight', 'Mamul', 'Detention', 'RTO', 'Extra'];
  
  headers.forEach((header, index) => {
    pdf.text(header, currentX + colWidths[index] / 2, tableY + 6, { align: 'center' });
    currentX += colWidths[index];
  });
  
  // Table data rows
  let rowY = tableY + 15;
  let totalFreight = 0;
  let totalMamul = 0;
  let totalDetention = 0;
  let totalRTO = 0;
  let totalExtra = 0;
  
  bill.trips.forEach((trip, index) => {
    // Alternating row colors for better readability
    if (index % 2 === 0) {
      pdf.setFillColor(250, 250, 250);
      pdf.rect(margin, rowY - 3, pageWidth - (2 * margin), 10, 'F');
    }
    
    pdf.setFont('times', 'normal');
    pdf.setFontSize(7);
    
    currentX = margin;
    const rowData = [
      trip.cnNo && trip.cnNo.trim() !== '' ? trip.cnNo : `CN-${index + 1}`,
      formatDate(trip.loadingDate),
      trip.from,
      trip.to,
      trip.vehicle,
      trip.weight ? `${trip.weight} MT` : '',
      '', // Rate not available in BillTrip
      formatCurrency(trip.freight),
      formatCurrency(trip.mamul || 0),
      formatCurrency(trip.detention || 0),
      trip.rtoChallan || '',
      '' // Extra weight not available in BillTrip
    ];
    
    rowData.forEach((data, colIndex) => {
      // Center numeric data, left-align text data
      const isNumeric = colIndex >= 6; // Rate, Freight, Mamul, Detention, RTO, Extra are numeric
      const alignment = isNumeric ? 'center' : (colIndex === 2 || colIndex === 3 ? 'left' : 'center');
      const xPos = alignment === 'center' ? currentX + colWidths[colIndex] / 2 : currentX + 2;
      
      pdf.text(data, xPos, rowY + 3, { align: alignment });
      currentX += colWidths[colIndex];
    });
    
    // Update totals
    totalFreight += trip.freight;
    totalMamul += trip.mamul || 0;
    totalDetention += trip.detention || 0;
    totalRTO += 0; // RTO not available at trip level
    totalExtra += 0; // Extra weight not available at trip level
    
    rowY += 10;
  });
  
  // Totals row with professional styling
  pdf.setFillColor(220, 220, 220); // Darker gray for totals
  pdf.rect(margin, rowY, pageWidth - (2 * margin), 10, 'F');
  
  pdf.setFont('times', 'bold');
  pdf.setFontSize(8);
  
  currentX = margin;
  const totalData = [
    '', '', '', '', '', '', 'TOTAL:',
    formatCurrency(totalFreight),
    formatCurrency(totalMamul),
    formatCurrency(totalDetention),
    formatCurrency(totalRTO),
    formatCurrency(totalExtra)
  ];
  
  totalData.forEach((data, colIndex) => {
    if (data) {
      const isNumeric = colIndex >= 6;
      const alignment = isNumeric ? 'center' : 'left';
      const xPos = alignment === 'center' ? currentX + colWidths[colIndex] / 2 : currentX + 2;
      
      pdf.text(data, xPos, rowY + 6, { align: alignment });
    }
    currentX += colWidths[colIndex];
  });
  
  // === SUMMARY SECTION ===
  const summaryY = rowY + 20;
  
  pdf.setFontSize(10);
  pdf.setFont('times', 'bold');
  pdf.text('BILL SUMMARY:', margin, summaryY);
  
  // Calculate total advance amount
  const totalAdvance = (bill.advances || []).reduce((sum, adv) => sum + adv.amount, 0);
  
  const summaryData = [
    ['Total Freight:', formatCurrency(bill.totalFreight)],
    ['Total Mamul:', formatCurrency(bill.mamul)],
    ['Total Detention:', formatCurrency(bill.detention)],
    ['RTO Challan:', formatCurrency(bill.rtoAmount || 0)],
    ['Extra Charges:', formatCurrency(bill.extraCharges || 0)],
    ['GRAND TOTAL:', formatCurrency(bill.totalFreight + bill.mamul + bill.detention + (bill.rtoAmount || 0) + (bill.extraCharges || 0))],
    ['Total Advance:', formatCurrency(totalAdvance)],
    ['Balance Amount:', formatCurrency(bill.balance)]
  ];
  
  let summaryRowY = summaryY + 8;
  summaryData.forEach((row, index) => {
    if (index === summaryData.length - 3 || index === summaryData.length - 2 || index === summaryData.length - 1) {
      pdf.setFont('times', 'bold');
      pdf.setFontSize(11);
    } else {
      pdf.setFont('times', 'normal');
      pdf.setFontSize(10);
    }
    
    pdf.text(row[0], margin, summaryRowY);
    pdf.text(row[1], margin + 80, summaryRowY);
    summaryRowY += 6;
  });

  // === ADVANCE DETAILS (if any) ===
  if (bill.advances && bill.advances.length > 0) {
    summaryRowY += 10; // Add spacing
    
    pdf.setFontSize(10);
    pdf.setFont('times', 'bold');
    pdf.text('ADVANCE DETAILS:', margin, summaryRowY);
    
    summaryRowY += 8;
    bill.advances.forEach((advance, index) => {
      pdf.setFont('times', 'normal');
      pdf.setFontSize(9);
      pdf.text(`${index + 1}. ${formatDate(advance.date)} - ${formatCurrency(advance.amount)}`, margin + 5, summaryRowY);
      if (advance.narration) {
        pdf.text(`   ${advance.narration}`, margin + 5, summaryRowY + 4);
        summaryRowY += 8;
      } else {
        summaryRowY += 6;
      }
    });
  }
  
  // === FOOTER ===
  pdf.setFontSize(8);
  pdf.setTextColor(100, 100, 100);
  pdf.text('Generated by Bhavishya Road Carriers Management System', margin, pageHeight - 10);
  pdf.text(`Generated on: ${formatDate(new Date().toISOString())}`, pageWidth - margin, pageHeight - 10, { align: 'right' });
  
  // Return PDF object for preview (don't auto-download)
  return pdf;
};

export const generateMemoPDF = async (memo: Memo): Promise<void> => {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = 210;
  const margin = 15;
  
  // Set default styles
  pdf.setTextColor(0, 0, 0);
  pdf.setDrawColor(0, 0, 0);
  pdf.setLineWidth(0.5);
  
  // === HEADER SECTION ===
  // Professional border around entire header
  pdf.setLineWidth(1);
  pdf.setDrawColor(0, 0, 0); // Black border
  pdf.rect(margin, 10, pageWidth - (2 * margin), 55, 'S');
  
  // Add BRC Logo - positioned better
  await addBRCLogo(pdf, margin + 5, 15, 30, 20);
  
  // Company name with professional styling
  pdf.setFontSize(20);
  pdf.setFont('times', 'bold');
  pdf.setTextColor(0, 50, 120);
  pdf.text('BHAVISHYA ROAD CARRIERS', pageWidth / 2, 25, { align: 'center' });
  
  // Company tagline
  pdf.setFontSize(8);
  pdf.setFont('times', 'italic');
  pdf.setTextColor(80, 80, 80);
  pdf.text('Specialist in Heavy ODC, Hydraulic, Low Bed Trailer, Flat Bed Trailer Transport & Commission Agent', pageWidth / 2, 31, { align: 'center' });
  
  // Company details
  pdf.setFontSize(7);
  pdf.setFont('times', 'normal');
  pdf.setTextColor(0, 0, 0);
  pdf.text('FLEET OWNERS, TRANSPORT CONTRACTORS & COMMISSION AGENTS', pageWidth / 2, 36, { align: 'center' });
  pdf.text('404, Parijaat Business Center, Nr. SP Ring Road, Aslali, Ahmedabad - 382405', pageWidth / 2, 41, { align: 'center' });
  pdf.text('(SUBJECT TO AHMEDABAD JURISDICTION)', pageWidth / 2, 46, { align: 'center' });
  
  // Contact details in professional boxes
  pdf.setFontSize(10);
  pdf.setFont('times', 'bold');
  pdf.setTextColor(0, 50, 120);
  pdf.text('MOB: 9824026576, 9824900776', margin + 5, 58);
  pdf.text('PAN NO: BNDPK7173D', pageWidth - margin - 50, 58);
  
  // === MEMO TITLE SECTION ===
  pdf.setFillColor(240, 240, 240);
  pdf.rect(margin, 70, pageWidth - (2 * margin), 12, 'F');
  pdf.setLineWidth(0.5);
  pdf.setDrawColor(0, 0, 0); // Black border
  pdf.rect(margin, 70, pageWidth - (2 * margin), 12, 'S');
  
  pdf.setFontSize(14);
  pdf.setFont('times', 'bold');
  pdf.setTextColor(0, 50, 120);
  pdf.text('BROKER MEMO', pageWidth / 2, 78, { align: 'center' });
  
  // Memo details
  pdf.setFontSize(12);
  pdf.setFont('times', 'normal');
  pdf.setTextColor(0, 0, 0);
  pdf.text(`Memo No: ${memo.memoNo}`, margin + 5, 88);
  pdf.text(`Date: ${formatDate(memo.loadingDate)}`, pageWidth - margin - 40, 88);
  
  // === TRANSPORT DETAILS TABLE ===
  let currentY = 92; // Reduced spacing from memo details
  
  // Table header
  pdf.setFillColor(0, 50, 120);
  pdf.rect(margin, currentY, pageWidth - (2 * margin), 8, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(10);
  pdf.setFont('times', 'bold');
  pdf.text('TRANSPORT DETAILS', margin + 3, currentY + 5.5);
  
  currentY += 8;
  
  // Transport details in structured format
  pdf.setTextColor(0, 0, 0);
  pdf.setFontSize(10); // Increased font size
  pdf.setFont('times', 'normal');
  
  const transportDetails = [
    [`From:`, memo.from, `To:`, memo.to],
    [`Material:`, memo.material || 'Not specified', `Vehicle No:`, memo.vehicle],
    [`Weight:`, `${memo.weight || 25} MT`, `Loading Date:`, formatDate(memo.loadingDate)]
  ];
  
  transportDetails.forEach((row, index) => {
    const rowY = currentY + (index * 8) + 5; // Increased row height
    // Alternating row colors
    if (index % 2 === 0) {
      pdf.setFillColor(250, 250, 250);
      pdf.rect(margin, rowY - 3, pageWidth - (2 * margin), 8, 'F'); // Increased height
    }
    
    pdf.setFont('times', 'bold');
    pdf.text(row[0], margin + 3, rowY);
    pdf.setFont('times', 'normal');
    pdf.text(row[1], margin + 30, rowY); // Better spacing
    
    pdf.setFont('times', 'bold');
    pdf.text(row[2], margin + 100, rowY); // Better spacing
    pdf.setFont('times', 'normal');
    pdf.text(row[3], margin + 130, rowY); // Better spacing
  });
  
  currentY += 25; // Increased spacing to prevent overlap
  
  // === SUPPLIER DETAILS ===
  pdf.setFillColor(0, 50, 120);
  pdf.rect(margin, currentY, pageWidth - (2 * margin), 8, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(10);
  pdf.setFont('times', 'bold');
  pdf.text('SUPPLIER DETAILS', margin + 3, currentY + 5.5);
  
  currentY += 15;
  pdf.setTextColor(0, 0, 0);
  pdf.setFontSize(10); // Increased font size
  pdf.setFont('times', 'bold');
  pdf.text('Supplier:', margin + 3, currentY);
  pdf.setFont('times', 'normal');
  pdf.text(memo.supplierName, margin + 30, currentY);
  
  currentY += 10; // Reduced spacing
  
  // === FINANCIAL DETAILS TABLE ===
  pdf.setFillColor(0, 50, 120);
  pdf.rect(margin, currentY, pageWidth - (2 * margin), 8, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(10);
  pdf.setFont('times', 'bold');
  pdf.text('FINANCIAL BREAKDOWN', margin + 3, currentY + 5.5);
  
  currentY += 12;
  
  // Financial table with professional styling
  const advanceTotal = memo.advances.reduce((sum, adv) => sum + adv.amount, 0);
  
  const financialRows = [
    { label: 'Freight Amount', amount: memo.freight, color: [0, 0, 0] },
    { label: 'Less: Advance', amount: -advanceTotal, color: [200, 0, 0] },
    { label: 'Less: Commission (6%)', amount: -(memo.commission || 0), color: [200, 0, 0] },
    { label: 'Less: Mamul (Deduction)', amount: -(memo.mamul || 0), color: [200, 0, 0] },
    { label: 'Add: Detention', amount: memo.detention || 0, color: [0, 120, 0] },
    { label: 'Add: Extra Charges', amount: memo.extraCharge || 0, color: [0, 120, 0] }
  ];
  
  financialRows.forEach((row, index) => {
    const rowY = currentY + (index * 7); // Minimal spacing between rows
    
    // Alternating row background
    if (index % 2 === 0) {
      pdf.setFillColor(250, 250, 250);
      pdf.rect(margin, rowY - 2, pageWidth - (2 * margin), 6, 'F'); // Further reduced height
    }
    
    pdf.setTextColor(row.color[0], row.color[1], row.color[2]);
    pdf.setFontSize(12); // Increased font size more
    pdf.setFont('times', 'normal');
    pdf.text(row.label, margin + 5, rowY + 4);
    
    const amountText = row.amount >= 0 ? `${formatCurrency(Math.abs(row.amount))}` : `(${formatCurrency(Math.abs(row.amount))})`;
    pdf.text(amountText, pageWidth - margin - 10, rowY + 4, { align: 'right' });
  });
  
  currentY += 35; // Further reduced spacing
  
  // Balance amount with emphasis
  pdf.setFillColor(230, 230, 230);
  pdf.rect(margin, currentY, pageWidth - (2 * margin), 10, 'F'); // Reduced height
  pdf.setLineWidth(0.3); // Thinner border
  pdf.setDrawColor(0, 0, 0); // Black border
  pdf.rect(margin, currentY, pageWidth - (2 * margin), 10, 'S');
  
  pdf.setFontSize(14); // Reduced font size
  pdf.setFont('times', 'bold');
  pdf.setTextColor(0, 0, 0); // Black text
  pdf.text('BALANCE AMOUNT:', margin + 5, currentY + 7);
  pdf.text(`${formatCurrency(memo.balance)}`, pageWidth - margin - 10, currentY + 7, { align: 'right' });
  
  // === ADVANCES SECTION ===
  if (memo.advances.length > 0) {
    currentY += 20;
    pdf.setFillColor(0, 50, 120);
    pdf.rect(margin, currentY, pageWidth - (2 * margin), 8, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(11); // Increased font size
    pdf.setFont('times', 'bold');
    pdf.text('ADVANCE DETAILS', margin + 3, currentY + 5.5);
    
    currentY += 15;
    memo.advances.forEach((advance, index) => {
      pdf.setTextColor(0, 0, 0);
      pdf.setFontSize(10); // Increased font size
      pdf.setFont('times', 'normal');
      pdf.text(`${index + 1}. ${formatDate(advance.date)} - ${formatCurrency(advance.amount)}`, margin + 5, currentY);
      if (advance.narration) {
        pdf.text(`   ${advance.narration}`, margin + 5, currentY + 4);
        currentY += 7; // Reduced spacing
      } else {
        currentY += 5; // Reduced spacing
      }
    });
  }
  
  // === SIGNATURE SECTION ===
  // Add proper spacing between financial details and signature to prevent overlap
  const signatureY = Math.max(currentY + 25, 220); // Increased spacing from 5mm to 25mm, minimum position 220mm
  
  pdf.setFontSize(12);
  pdf.setFont('times', 'bold');
  pdf.setTextColor(0, 0, 0);
  pdf.text('FOR, BHAVISHYA ROAD CARRIERS', pageWidth - margin - 10, signatureY, { align: 'right' });
  
  pdf.setFontSize(10);
  pdf.setFont('times', 'normal');
  pdf.setTextColor(0, 0, 0);
  pdf.text('Authorized Signatory', pageWidth - margin - 10, signatureY + 20, { align: 'right' });
  
  // === FOOTER ===
  pdf.setFontSize(8); // Increased font size
  pdf.setTextColor(100, 100, 100);
  pdf.text('Generated by Bhavishya Road Carriers Management System', margin, 275); // Moved up
  pdf.text(`Generated on: ${formatDate(new Date().toISOString())}`, pageWidth - margin, 275, { align: 'right' }); // Moved up
  
  // Create filename with supplier name and memo number
  const sanitizedSupplierName = memo.supplierName.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
  pdf.save(`Memo_${memo.memoNo}_${sanitizedSupplierName}.pdf`);
};

// Version that returns PDF object for preview (without auto-download)
export const generateMemoPDFForPreview = async (memo: Memo): Promise<jsPDF> => {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = 210;
  const margin = 15;
  
  // Set default styles
  pdf.setTextColor(0, 0, 0);
  pdf.setDrawColor(0, 0, 0);
  pdf.setLineWidth(0.5);
  
  // === HEADER SECTION ===
  // Professional border around entire header
  pdf.setLineWidth(1);
  pdf.setDrawColor(0, 0, 0); // Black border
  pdf.rect(margin, 10, pageWidth - (2 * margin), 55, 'S');
  
  // Add BRC Logo - positioned better
  await addBRCLogo(pdf, margin + 5, 15, 30, 20);
  
  // Company name with professional styling
  pdf.setFontSize(20);
  pdf.setFont('times', 'bold');
  pdf.setTextColor(0, 100, 200); // Subtle blue for company name
  pdf.text('BHAVISHYA ROAD CARRIERS', pageWidth / 2, 25, { align: 'center' });
  
  // Company details
  pdf.setFontSize(8);
  pdf.setFont('times', 'normal');
  pdf.setTextColor(0, 0, 0);
  pdf.text('Specialist in Heavy ODC, Hydraulic, Low Bed Trailer, Flat Bed Trailer Transport & Commission Agent', pageWidth / 2, 32, { align: 'center' });
  pdf.text('FLEET OWNERS, TRANSPORT CONTRACTORS & COMMISSION AGENTS', pageWidth / 2, 37, { align: 'center' });
  pdf.text('404, Parijaat Business Center, Nr. SP Ring Road, Aslali, Ahmedabad - 382405', pageWidth / 2, 42, { align: 'center' });
  pdf.text('Mobile: +91 98250 29702 | Email: bhavishyaroadcarriers@gmail.com', pageWidth / 2, 47, { align: 'center' });
  
  // Memo number and date
  pdf.setFontSize(12);
  pdf.setFont('times', 'bold');
  pdf.text(`MEMO NO: ${memo.memoNo}`, margin + 5, 58);
  pdf.text(`DATE: ${formatDate(memo.loadingDate)}`, pageWidth - margin - 5, 58, { align: 'right' });
  
  let currentY = 75;
  
  // === TRANSPORT DETAILS ===
  pdf.setFillColor(0, 50, 120);
  pdf.rect(margin, currentY, pageWidth - (2 * margin), 8, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(10);
  pdf.setFont('times', 'bold');
  pdf.text('TRANSPORT DETAILS', margin + 3, currentY + 5.5);
  
  currentY += 15;
  
  // Transport details in a clean table format
  const transportRows = [
    ['From:', memo.from, 'To:', memo.to],
    ['Material:', memo.material || 'N/A', 'Weight:', memo.weight ? `${memo.weight} MT` : 'N/A'],
    ['Vehicle:', memo.vehicle, 'Loading Date:', formatDate(memo.loadingDate)]
  ];
  
  transportRows.forEach((row, index) => {
    // Alternating row colors
    if (index % 2 === 0) {
      pdf.setFillColor(250, 250, 250);
      pdf.rect(margin, currentY - 3, pageWidth - (2 * margin), 8, 'F'); // Increased height
    }
    
    pdf.setFont('times', 'bold');
    pdf.text(row[0], margin + 3, currentY);
    pdf.setFont('times', 'normal');
    pdf.text(row[1], margin + 30, currentY); // Better spacing
    
    pdf.setFont('times', 'bold');
    pdf.text(row[2], margin + 100, currentY); // Better spacing
    pdf.setFont('times', 'normal');
    pdf.text(row[3], margin + 130, currentY); // Better spacing
  });
  
  currentY += 25; // Increased spacing to prevent overlap
  
  // === SUPPLIER DETAILS ===
  pdf.setFillColor(0, 50, 120);
  pdf.rect(margin, currentY, pageWidth - (2 * margin), 8, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(10);
  pdf.setFont('times', 'bold');
  pdf.text('SUPPLIER DETAILS', margin + 3, currentY + 5.5);
  
  currentY += 15;
  pdf.setTextColor(0, 0, 0);
  pdf.setFontSize(10); // Increased font size
  pdf.setFont('times', 'bold');
  pdf.text('Supplier:', margin + 3, currentY);
  pdf.setFont('times', 'normal');
  pdf.text(memo.supplierName, margin + 30, currentY);
  
  currentY += 10; // Reduced spacing
  
  // === FINANCIAL DETAILS TABLE ===
  pdf.setFillColor(0, 50, 120);
  pdf.rect(margin, currentY, pageWidth - (2 * margin), 8, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(10);
  pdf.setFont('times', 'bold');
  pdf.text('FINANCIAL BREAKDOWN', margin + 3, currentY + 5.5);
  
  currentY += 12;
  
  // Financial table with professional styling
  const advanceTotal = memo.advances.reduce((sum, adv) => sum + adv.amount, 0);
  
  const financialRows = [
    ['Freight:', formatCurrency(memo.freight)],
    ['Commission:', formatCurrency(memo.commission || 0)],
    ['Mamul:', formatCurrency(memo.mamul)],
    ['Detention:', formatCurrency(memo.detention)],
    ['RTO Amount:', formatCurrency(memo.rtoAmount || 0)],
    ['Extra Charge:', formatCurrency(memo.extraCharge || 0)],
    ['Total Advance:', formatCurrency(advanceTotal)],
    ['BALANCE AMOUNT:', formatCurrency(memo.balance)]
  ];
  
  financialRows.forEach((row, index) => {
    // Alternating row colors for better readability
    if (index % 2 === 0) {
      pdf.setFillColor(250, 250, 250);
      pdf.rect(margin, currentY - 3, pageWidth - (2 * margin), 8, 'F');
    }
    
    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(10); // Increased font size
    
    // Highlight balance amount
    if (row[0] === 'BALANCE AMOUNT:') {
      pdf.setFont('times', 'bold');
      pdf.setFillColor(220, 220, 220);
      pdf.rect(margin, currentY - 3, pageWidth - (2 * margin), 8, 'F');
    } else {
      pdf.setFont('times', 'normal');
    }
    
    pdf.text(row[0], margin + 3, currentY);
    pdf.text(row[1], pageWidth - margin - 5, currentY, { align: 'right' });
    currentY += 7; // Reduced spacing
  });
  
  // === ADVANCE DETAILS (if any) ===
  if (memo.advances && memo.advances.length > 0) {
    currentY += 10; // Reduced spacing
    
    pdf.setFillColor(0, 50, 120);
    pdf.rect(margin, currentY, pageWidth - (2 * margin), 8, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(10);
    pdf.setFont('times', 'bold');
    pdf.text('ADVANCE DETAILS', margin + 3, currentY + 5.5);
    
    currentY += 15;
    memo.advances.forEach((advance, index) => {
      pdf.setTextColor(0, 0, 0);
      pdf.setFontSize(10); // Increased font size
      pdf.setFont('times', 'normal');
      pdf.text(`${index + 1}. ${formatDate(advance.date)} - ${formatCurrency(advance.amount)}`, margin + 5, currentY);
      if (advance.narration) {
        pdf.text(`   ${advance.narration}`, margin + 5, currentY + 4);
        currentY += 7; // Reduced spacing
      } else {
        currentY += 5; // Reduced spacing
      }
    });
  }
  
  // === SIGNATURE SECTION ===
  // Add proper spacing between financial details and signature to prevent overlap
  const signatureY = Math.max(currentY + 25, 220); // Increased spacing from 5mm to 25mm, minimum position 220mm
  
  pdf.setFontSize(12);
  pdf.setFont('times', 'bold');
  pdf.setTextColor(0, 0, 0);
  pdf.text('FOR, BHAVISHYA ROAD CARRIERS', pageWidth - margin - 10, signatureY, { align: 'right' });
  
  pdf.setFontSize(10);
  pdf.setFont('times', 'normal');
  pdf.setTextColor(0, 0, 0);
  pdf.text('Authorized Signatory', pageWidth - margin - 10, signatureY + 20, { align: 'right' });
  
  // === FOOTER ===
  pdf.setFontSize(8); // Increased font size
  pdf.setTextColor(100, 100, 100);
  pdf.text('Generated by Bhavishya Road Carriers Management System', margin, 275); // Moved up
  pdf.text(`Generated on: ${formatDate(new Date().toISOString())}`, pageWidth - margin, 275, { align: 'right' }); // Moved up
  
  // Return PDF object for preview (don't auto-download)
  return pdf;
};

export const generateLoadingSlipPDF = async (slip: LoadingSlip): Promise<void> => {
  const pdf = new jsPDF('p', 'mm', 'a4');
  
  // Add BRC Logo - improved positioning
  await addBRCLogo(pdf, 80, 5, 35, 22);
  
  // Company header with enhanced styling - moved down to avoid overlap
  pdf.setFontSize(18);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(0, 50, 120); // Darker blue for better contrast
  pdf.text('BHAVISHYA ROAD CARRIERS', 105, 35, { align: 'center' });
  
  pdf.setFontSize(14);
  pdf.setTextColor(0, 50, 120); // Darker blue for better contrast
  pdf.text('LOADING SLIP', 105, 45, { align: 'center' });
  
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(0, 0, 0); // Black text
  pdf.text('Specialist in Heavy ODC, Hydraulic, Low Bed Trailer, Flat Bed Trailer Transport & Commission Agent', 105, 51, { align: 'center' });
  pdf.text('FLEET OWNERS, TRANSPORT CONTRACTORS & COMMISSION AGENTS', 105, 55, { align: 'center' });
  pdf.text('404, Parijaat Business Center, Nr. SP Ring Road, Aslali, Ahmedabad - 382405', 105, 59, { align: 'center' });
  
  // Contact details with darker blue styling for better contrast
  pdf.setTextColor(0, 50, 120); // Darker blue
  pdf.setFont('helvetica', 'bold');
  pdf.text('MOB: 9824026576, 9824900776 | PAN NO: BNDPK7173D', 105, 65, { align: 'center' });
  
  // Slip details with enhanced styling
  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(0, 0, 0); // Black text
  pdf.text(`Slip No: ${slip.slipNo}`, 20, 75);
  pdf.text(`Date: ${formatDate(slip.date)}`, 150, 75);
  
  // Details section with blue headers - updated to show M/s. prominently
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'bold');
  pdf.setFillColor(0, 80, 160); // Blue background
  pdf.rect(20, 85, 170, 8, 'F');
  pdf.setTextColor(255, 255, 255); // White text
  pdf.text(`M/s. ${slip.partyName}`, 22, 91);
  
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(0, 0, 0); // Black text
  
  // Party Person and Vehicle No on the same row with proper spacing
  pdf.setFont('helvetica', 'bold');
  pdf.text('Party Person:', 20, 105);
  pdf.setFont('helvetica', 'normal');
  pdf.text(slip.partyPersonName || 'Not specified', 75, 105);
  
  pdf.setFont('helvetica', 'bold');
  pdf.text('Vehicle No:', 120, 105);
  pdf.setFont('helvetica', 'normal');
  pdf.text(slip.vehicleNo, 155, 105);
  
  // Transport details
  pdf.setFont('helvetica', 'normal');
  pdf.text(`From: ${slip.from}`, 20, 115);
  pdf.text(`To: ${slip.to}`, 120, 115);
  pdf.text(`Material: ${slip.material}`, 20, 125);
  pdf.text(`Weight: ${slip.weight} MT`, 20, 135);
  pdf.text(`Dimensions: ${slip.dimensions}`, 120, 135);
  
  // Financial section
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'bold');
  pdf.setFillColor(0, 80, 160); // Blue background
  pdf.rect(20, 145, 170, 8, 'F');
  pdf.setTextColor(255, 255, 255); // White text
  pdf.text('Financial Details', 22, 151);
  
  // Financial details with proper structure
  let currentFinancialY = 160;
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  
  // Freight Amount
  if (slip.freight) {
    pdf.setTextColor(0, 0, 0); // Black text
    pdf.text(`Freight Amount: ${formatCurrency(slip.freight)}`, 20, currentFinancialY);
    currentFinancialY += 10;
  }
  
  // Advance Amount
  pdf.setTextColor(0, 100, 0); // Green for advance
  pdf.text(`Advance Amount: ${formatCurrency(slip.advanceAmount)}`, 20, currentFinancialY);
  currentFinancialY += 10;
  
  // RTO Amount if greater than 0
  if (slip.rtoAmount && slip.rtoAmount > 0) {
    pdf.setTextColor(0, 0, 150); // Dark blue for RTO
    pdf.text(`RTO Amount: ${formatCurrency(slip.rtoAmount)}`, 20, currentFinancialY);
    currentFinancialY += 10;
  }
  
  // Total Freight (Freight + RTO)
  const totalFreight = (slip.freight || 0) + (slip.rtoAmount || 0);
  if (totalFreight > 0) {
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(0, 0, 0); // Black text for total
    pdf.text(`Total Freight: ${formatCurrency(totalFreight)}`, 20, currentFinancialY);
    pdf.setFont('helvetica', 'normal'); // Reset font
    currentFinancialY += 10;
  }
  
  // Calculate dynamic position for bank details with optimized spacing
  let bankDetailsY = currentFinancialY + 1.5;
  
  // Add thin horizontal line above bank details for separation
  pdf.setLineWidth(0.5);
  pdf.setDrawColor(0, 0, 0);
  pdf.line(20, bankDetailsY - 2, 190, bankDetailsY - 2);
  
  // Bank Details header with consistent blue styling
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'bold');
  pdf.setFillColor(0, 80, 160); // Blue background
  pdf.rect(20, bankDetailsY, 170, 8, 'F');
  pdf.setTextColor(255, 255, 255); // White text
  pdf.text('Bank Details', 22, bankDetailsY + 6);
  
  // Bank details content with fixed values - properly formatted
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(0, 0, 0); // Black text
  
  const bankY = bankDetailsY + 12;
  const labelX = 22;
  const valueStartX = 80; // Fixed position where values start
  
  // Beneficiary Name
  pdf.setFont('helvetica', 'bold');
  pdf.text('Beneficiary Name:', labelX, bankY);
  pdf.setFont('helvetica', 'normal');
  pdf.text('BHAVISHYA ROAD CARRIERS', valueStartX, bankY);
  
  // Account Number
  pdf.setFont('helvetica', 'bold');
  pdf.text('Account No:', labelX, bankY + 7);
  pdf.setFont('helvetica', 'normal');
  pdf.text('231005501207', valueStartX, bankY + 7);
  
  // IFSC Code
  pdf.setFont('helvetica', 'bold');
  pdf.text('IFSC Code:', labelX, bankY + 14);
  pdf.setFont('helvetica', 'normal');
  pdf.text('ICIC0002310', valueStartX, bankY + 14);
  
  // Branch Name
  pdf.setFont('helvetica', 'bold');
  pdf.text('Branch Name:', labelX, bankY + 21);
  pdf.setFont('helvetica', 'normal');
  pdf.text('GHODASAR, AHMEDABAD', valueStartX, bankY + 21);
  
  // Authorized Signatory section - positioned properly below bank details with optimized spacing
  const signatureY = bankY + 27;
  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(0, 80, 160); // Blue color
  pdf.text('FOR, BHAVISHYA ROAD CARRIERS', 170, signatureY, { align: 'center' });
  
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(0, 0, 0);
  pdf.text('AUTHORISED SIGNATORY', 170, signatureY + 10, { align: 'center' });

  
  // Notice section with enhanced styling - positioned dynamically with optimized spacing
  const noticeY = Math.max(signatureY + 13, 235);
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(200, 0, 0); // Red color for important notice
  pdf.text('IMPORTANT NOTICE:', 20, noticeY);
  
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(0, 0, 0);
  pdf.text('(1) Please verify Engine No., Chassis No., R.T.O. Book, C.S.T. No. etc.', 20, noticeY + 7);
  pdf.text('(2) We are not responsible for accident, leakage & breakage', 20, noticeY + 12);
  pdf.text('(3) One Day Halting charges: Rs. 4000 (4) Transportation at Owner\'s Risk', 20, noticeY + 17);
  
  // Company footer with blue styling - positioned dynamically with optimized spacing
  const footerY = Math.max(noticeY + 20, 275);
  pdf.setFontSize(7);
  pdf.setTextColor(0, 80, 160); // Blue color
  pdf.text('Generated by Bhavishya Road Carriers System', 20, footerY);
  pdf.text(`Generated on: ${formatDate(new Date().toISOString())}`, 130, footerY);
  
  pdf.save(`LoadingSlip_${slip.slipNo}.pdf`);
};