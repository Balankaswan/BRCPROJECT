import { 
  PartyLedger, 
  SupplierLedger, 
  PartyLedgerEntry, 
  SupplierLedgerEntry, 
  Bill, 
  Memo, 
  BankEntry, 
  Party, 
  Supplier 
} from '../types';
import { formatDate, formatCurrency } from './calculations';

// Party Ledger Functions
export const createPartyLedgerEntry = (
  bill: Bill,
  bankEntry?: BankEntry,
  isAdvance: boolean = false
): PartyLedgerEntry => {
  const tripDetails = bill.trips
    .map(trip => `${trip.from} - ${trip.to}`)
    .join(', ');

  // Calculate RTO challan amount from trips
  const rtoAmount = bill.trips.reduce((sum, trip) => {
    return sum + (parseFloat(trip.rtoChallan) || 0);
  }, 0);

  return {
    id: `${bill.id}_${bankEntry?.id || 'bill'}`,
    date: bankEntry?.date || bill.billDate,
    billNo: bill.billNo,
    tripDetails,
    creditAmount: isAdvance ? 0 : bill.totalFreight + bill.detention + (bill.rtoAmount || 0) + rtoAmount,
    debitPayment: (bankEntry && !isAdvance) ? bankEntry.amount : 0,
    debitAdvance: isAdvance ? (bankEntry?.amount || bill.advances.reduce((sum, adv) => sum + adv.amount, 0)) : 0,
    runningBalance: 0, // Will be calculated after sorting entries
    remarks: bankEntry?.narration || (isAdvance ? 'Advance received' : `Bill created with RTO: ${formatCurrency(rtoAmount)}`),
    relatedBillId: bill.id,
    relatedBankEntryId: bankEntry?.id
  };
};

export const updatePartyLedger = (
  existingLedgers: PartyLedger[],
  party: Party,
  bills: Bill[],
  bankEntries: BankEntry[]
): PartyLedger[] => {
  // Find existing ledger or create new one
  let ledger = existingLedgers.find(l => l.partyId === party.id);
  
  if (!ledger) {
    ledger = {
      id: `party_${party.id}`,
      partyId: party.id,
      partyName: party.name,
      entries: [],
      outstandingBalance: 0,
      createdAt: new Date().toISOString()
    };
  }

  // Get all bills for this party
  const partyBills = bills.filter(bill => bill.partyId === party.id);
  
  // Get all bank entries related to this party's bills
  const partyBankEntries = bankEntries.filter(entry => 
    entry.category === 'bill' && 
    partyBills.some(bill => bill.id === entry.relatedId)
  );

  // Create entries
  const entries: PartyLedgerEntry[] = [];

  // Add bill entries
  partyBills.forEach(bill => {
    // Add main bill entry (credit)
    entries.push(createPartyLedgerEntry(bill));

    // Add advance entries if any
    bill.advances.forEach(advance => {
      entries.push({
        id: `${bill.id}_advance_${advance.id}`,
        date: advance.date,
        billNo: bill.billNo,
        tripDetails: bill.trips.map(trip => `${trip.from} - ${trip.to}`).join(', '),
        creditAmount: 0,
        debitPayment: 0,
        debitAdvance: advance.amount,
        runningBalance: 0,
        remarks: advance.narration || 'Advance received during bill creation',
        relatedBillId: bill.id
      });
    });

    // Add payment entries
    const billPayments = partyBankEntries.filter(entry => entry.relatedId === bill.id);
    billPayments.forEach(payment => {
      entries.push({
        id: `${bill.id}_payment_${payment.id}`,
        date: payment.date,
        billNo: bill.billNo,
        tripDetails: bill.trips.map(trip => `${trip.from} - ${trip.to}`).join(', '),
        creditAmount: 0,
        debitPayment: payment.amount,
        debitAdvance: 0,
        runningBalance: 0,
        remarks: payment.narration || 'Payment received',
        relatedBillId: bill.id,
        relatedBankEntryId: payment.id
      });
    });
  });

  // Sort entries by date
  entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Calculate running balances
  let runningBalance = 0;
  entries.forEach(entry => {
    runningBalance += entry.creditAmount - (entry.type === 'payment_debit' ? entry.debitAmount : 0) - (entry.type === 'advance_debit' ? entry.debitAmount : 0);
    entry.runningBalance = runningBalance;
  });

  // Update ledger
  ledger.entries = entries;
  ledger.outstandingBalance = runningBalance;

  // Return updated ledgers array
  return [
    ...existingLedgers.filter(l => l.partyId !== party.id),
    ledger
  ];
};

// Supplier Ledger Functions
export const createSupplierLedgerEntry = (
  memo: Memo,
  bankEntry?: BankEntry,
  isAdvance: boolean = false
): SupplierLedgerEntry => {
  const tripDetails = `${memo.from} - ${memo.to} / ${memo.vehicle}`;

  return {
    id: `${memo.id}_${bankEntry?.id || 'memo'}`,
    date: bankEntry?.date || memo.loadingDate,
    memoNo: memo.memoNo,
    tripDetails,
    detentionCharges: memo.detention,
    extraWeightCharges: 0, // Will be implemented when Extra Weight field is added
    creditAmount: isAdvance ? 0 : memo.freight + memo.detention,
    debitPayment: (bankEntry && !isAdvance) ? bankEntry.amount : 0,
    debitAdvance: isAdvance ? (bankEntry?.amount || memo.advances.reduce((sum, adv) => sum + adv.amount, 0)) : 0,
    runningBalance: 0, // Will be calculated after sorting entries
    remarks: bankEntry?.narration || (isAdvance ? 'Advance paid' : `Memo created`),
    relatedMemoId: memo.id,
    relatedBankEntryId: bankEntry?.id,
    commission: memo.commission,
    mamul: memo.mamul
  };
};

export const updateSupplierLedger = (
  existingLedgers: SupplierLedger[],
  supplier: Supplier,
  memos: Memo[],
  bankEntries: BankEntry[]
): SupplierLedger[] => {
  // Find existing ledger or create new one
  let ledger = existingLedgers.find(l => l.supplierId === supplier.id);
  
  if (!ledger) {
    ledger = {
      id: `supplier_${supplier.id}`,
      supplierId: supplier.id,
      supplierName: supplier.name,
      entries: [],
      outstandingBalance: 0,
      createdAt: new Date().toISOString()
    };
  }

  // Get all memos for this supplier
  const supplierMemos = memos.filter(memo => memo.supplierId === supplier.id);
  
  // Get all bank entries related to this supplier's memos
  const supplierBankEntries = bankEntries.filter(entry => 
    entry.category === 'memo' && 
    supplierMemos.some(memo => memo.id === entry.relatedId)
  );

  // Create entries
  const entries: SupplierLedgerEntry[] = [];

  // Add memo entries
  supplierMemos.forEach(memo => {
    // Add main memo entry (credit)
    entries.push(createSupplierLedgerEntry(memo));

    // Add advance entries if any
    memo.advances.forEach(advance => {
      entries.push({
        id: `${memo.id}_advance_${advance.id}`,
        date: advance.date,
        memoNo: memo.memoNo,
        tripDetails: `${memo.from} - ${memo.to} / ${memo.vehicle}`,
        detentionCharges: 0,
        extraWeightCharges: 0,
        creditAmount: 0,
        debitPayment: 0,
        debitAdvance: advance.amount,
        runningBalance: 0,
        remarks: advance.narration || 'Advance paid during memo creation',
        relatedMemoId: memo.id,
        commission: memo.commission,
        mamul: memo.mamul
      });
    });

    // Add payment entries
    const memoPayments = supplierBankEntries.filter(entry => entry.relatedId === memo.id);
    memoPayments.forEach(payment => {
      entries.push({
        id: `${memo.id}_payment_${payment.id}`,
        date: payment.date,
        memoNo: memo.memoNo,
        tripDetails: `${memo.from} - ${memo.to} / ${memo.vehicle}`,
        detentionCharges: 0,
        extraWeightCharges: 0,
        creditAmount: 0,
        debitPayment: payment.amount,
        debitAdvance: 0,
        runningBalance: 0,
        remarks: payment.narration || 'Payment made',
        relatedMemoId: memo.id,
        relatedBankEntryId: payment.id,
        commission: memo.commission,
        mamul: memo.mamul
      });
    });
  });

  // Sort entries by date
  entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Calculate running balances (for suppliers, credit is what we owe them, debit is what we pay/deduct)
  let runningBalance = 0;
  entries.forEach(entry => {
    // Credit increases what we owe, debit (payments + commission + mamul) reduces what we owe
    const creditAmount = entry.creditAmount;
    const debitAmount = entry.debitPayment + entry.debitAdvance + (entry.commission || 0) + (entry.mamul || 0);
    runningBalance += creditAmount - debitAmount;
    entry.runningBalance = runningBalance;
  });

  // Update ledger
  ledger.entries = entries;
  ledger.outstandingBalance = runningBalance;

  // Return updated ledgers array
  return [
    ...existingLedgers.filter(l => l.supplierId !== supplier.id),
    ledger
  ];
};

// Update party balance based on ledger
export const calculatePartyOutstandingBalance = (
  party: Party,
  bills: Bill[],
  bankEntries: BankEntry[]
): number => {
  const partyBills = bills.filter(bill => bill.partyId === party.id);
  
  let totalBillAmount = 0;
  let totalPaymentsReceived = 0;
  let totalAdvancesReceived = 0;

  partyBills.forEach(bill => {
    totalBillAmount += bill.totalFreight + bill.detention;
    totalAdvancesReceived += bill.advances.reduce((sum, adv) => sum + adv.amount, 0);
    
    // Add payments from banking
    const billPayments = bankEntries.filter(entry => 
      entry.category === 'bill' && entry.relatedId === bill.id
    );
    totalPaymentsReceived += billPayments.reduce((sum, payment) => sum + payment.amount, 0);
  });

  return totalBillAmount - (totalPaymentsReceived + totalAdvancesReceived);
};

// Update supplier balance based on ledger
export const calculateSupplierOutstandingBalance = (
  supplier: Supplier,
  memos: Memo[],
  bankEntries: BankEntry[]
): number => {
  const supplierMemos = memos.filter(memo => memo.supplierId === supplier.id);
  
  let totalMemoAmount = 0;
  let totalPaymentsMade = 0;
  let totalAdvancesPaid = 0;
  let totalCommission = 0;
  let totalMamul = 0;

  supplierMemos.forEach(memo => {
    totalMemoAmount += memo.freight + memo.detention;
    totalAdvancesPaid += memo.advances.reduce((sum, adv) => sum + adv.amount, 0);
    totalCommission += memo.commission;
    totalMamul += memo.mamul;
    
    // Add payments from banking
    const memoPayments = bankEntries.filter(entry => 
      entry.category === 'memo' && entry.relatedId === memo.id
    );
    totalPaymentsMade += memoPayments.reduce((sum, payment) => sum + payment.amount, 0);
  });

  return totalMemoAmount - (totalPaymentsMade + totalAdvancesPaid + totalCommission + totalMamul);
};

// Generate PDF for party ledger
export const generatePartyLedgerPDF = async (ledger: PartyLedger) => {
  // Import jsPDF dynamically to avoid SSR issues
  const { default: jsPDF } = await import('jspdf');
  
  const pdf = new jsPDF('p', 'mm', 'a4'); // Portrait for party ledger
  
  // Add company logo
  try {
    const logoImg = new Image();
    logoImg.src = '/49a17683-5076-4438-802b-1f127b406df3 copy.JPG';
    await new Promise((resolve) => {
      logoImg.onload = resolve;
      logoImg.onerror = resolve; // Continue even if logo fails to load
    });
    
    if (logoImg.complete && logoImg.naturalWidth > 0) {
      // Add logo (top-left, small size)
      pdf.addImage(logoImg, 'JPEG', 10, 5, 20, 20);
    }
  } catch (error) {
    console.warn('Failed to load logo:', error);
  }
  
  // Header
  pdf.setFontSize(20);
  pdf.setFont('helvetica', 'bold');
  pdf.text('BHAVISHYA ROAD CARRIERS', 105, 20, { align: 'center' });
  
  pdf.setFontSize(14);
  pdf.text('PARTY LEDGER', 105, 35, { align: 'center' });
  
  pdf.setFontSize(10);
  pdf.text(`Party: ${ledger.partyName}`, 20, 55);
  pdf.text(`Balance: ₹${ledger.outstandingBalance.toLocaleString()}`, 80, 55);
  
  // Table Header
  const startY = 65;
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'bold');
  
  const headers = ['Date', 'Bill No', 'Trip Details', 'Credit', 'Debit-Payment', 'Debit-Advance', 'Balance', 'Remarks'];
  const colWidths = [18, 18, 35, 20, 22, 22, 20, 35];
  let currentX = 10;
  
  // Set header background and text colors
  pdf.setFillColor(220, 220, 220); // Light gray background
  pdf.setDrawColor(0, 0, 0); // Black border
  pdf.setTextColor(0, 0, 0); // Black text
  
  // Draw header cells and text in one pass
  headers.forEach((header, index) => {
    // Draw header cell with background (fill only, no border)
    pdf.rect(currentX, startY, colWidths[index], 9, );
    
    // Add header text with proper font size for readability
    pdf.setFontSize(6.5);
    const textX = currentX + (colWidths[index] / 2);
    
    // Center-align header text (single line only for compactness)
    pdf.text(header, textX, startY + 6, { align: 'center' });
    
    currentX += colWidths[index];
  });
  
  // Reset font size for data
  pdf.setFontSize(6);
  
  // Table Data
  pdf.setFont('helvetica', 'normal');
  pdf.setFillColor(255, 255, 255); // White background for data rows
  let currentY = startY + 9;
  
  ledger.entries.forEach((entry) => {
    currentX = 10;
    const rowData = [
      formatDate(entry.date),
      entry.billNo || '',
      entry.tripDetails || entry.particulars || '',
      entry.creditAmount > 0 ? entry.creditAmount.toLocaleString() : '',
      (entry.type === 'payment_debit' && entry.debitAmount > 0) ? entry.debitAmount.toLocaleString() : '',
      (entry.type === 'advance_debit' && entry.debitAmount > 0) ? entry.debitAmount.toLocaleString() : '',
      entry.runningBalance.toLocaleString(),
      entry.remarks || entry.particulars || ''
    ];
    
    rowData.forEach((data, colIndex) => {
      // Draw cell border
      pdf.rect(currentX, currentY, colWidths[colIndex], 7, 'S');
      const textWidth = colWidths[colIndex] - 2;
      if (typeof data === 'string' && data.length > 0) {
        // Handle text wrapping for long content
        const lines = pdf.splitTextToSize(data, textWidth);
        pdf.text(lines[0] || '', currentX + 1, currentY + 5);
      }
      currentX += colWidths[colIndex];
    });
    currentY += 7;
    
    // Add new page if needed (increased threshold for single page)
    if (currentY > 270) {
      pdf.addPage();
      currentY = 20;
    }
  });
  
  // Totals row
  currentX = 10;
  pdf.setFont('helvetica', 'bold');
  pdf.setFillColor(230, 230, 230); // Light gray background for totals
  
  const totalCredit = ledger.entries.reduce((sum, entry) => sum + entry.creditAmount, 0);
  const totalDebitPayment = ledger.entries.reduce((sum, entry) => sum + (entry.type === 'payment_debit' ? entry.debitAmount : (entry as any).debitPayment || 0), 0);
  const totalDebitAdvance = ledger.entries.reduce((sum, entry) => sum + (entry.type === 'advance_debit' ? entry.debitAmount : (entry as any).debitAdvance || 0), 0);
  
  const totalRowData = [
    'TOTALS',
    '',
    '',
    totalCredit.toLocaleString(),
    totalDebitPayment.toLocaleString(),
    totalDebitAdvance.toLocaleString(),
    ledger.outstandingBalance.toLocaleString(),
    ''
  ];
  
  totalRowData.forEach((data, colIndex) => {
    // Draw cell border
    pdf.rect(currentX, currentY, colWidths[colIndex], 7, 'S');
      
    if (typeof data === 'string' && data.length > 0) {
      // Right-align numeric columns (Credit, Debit, Balance)
      if (colIndex >= 3 && colIndex <= 6) {
        const textX = currentX + colWidths[colIndex] - 2;
        pdf.text(data, textX, currentY + 5, { align: 'right' });
      } else {
        // Left-align text columns
        const textWidth = colWidths[colIndex] - 4;
        const lines = pdf.splitTextToSize(data, textWidth);
        pdf.text(lines[0] || '', currentX + 2, currentY + 5);
      }
    }
    currentX += colWidths[colIndex];
  });
  
  pdf.save(`Party_Ledger_${ledger.partyName}.pdf`);
};

// Generate PDF for supplier ledger
export const generateSupplierLedgerPDF = async (ledger: SupplierLedger) => {
  // Import jsPDF dynamically to avoid SSR issues
  const { default: jsPDF } = await import('jspdf');
  
  const pdf = new jsPDF('l', 'mm', 'a4'); // Landscape for more columns
  
  // Add company logo
  try {
    const logoImg = new Image();
    logoImg.src = '/49a17683-5076-4438-802b-1f127b406df3 copy.JPG';
    await new Promise((resolve) => {
      logoImg.onload = resolve;
      logoImg.onerror = resolve; // Continue even if logo fails to load
    });
    
    if (logoImg.complete && logoImg.naturalWidth > 0) {
      // Add logo (top-left, small size for landscape)
      pdf.addImage(logoImg, 'JPEG', 10, 5, 20, 20);
    }
  } catch (error) {
    console.warn('Failed to load logo:', error);
  }
  
  // Header
  pdf.setFontSize(20);
  pdf.setFont('helvetica', 'bold');
  pdf.text('BHAVISHYA ROAD CARRIERS', 148, 20, { align: 'center' });
  
  pdf.setFontSize(16);
  pdf.text('SUPPLIER LEDGER', 148, 35, { align: 'center' });
  
  pdf.setFontSize(14);
  pdf.text(`Supplier: ${ledger.supplierName}`, 20, 55);
  pdf.text(`Outstanding Balance: ₹${ledger.outstandingBalance.toLocaleString()}`, 180, 55);
  
  // Table Header
  const startY = 65;
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'bold');
  
  const headers = ['Date', 'Memo No', 'Trip Details', 'Detention', 'Extra Wt', 'Credit', 'Debit-Payment', 'Debit-Advance', 'Balance', 'Remarks'];
  const colWidths = [15,15 , 25, 18, 14, 18, 22, 22, 22, 40];
  let currentX = 10;
  
  // Set header background and text colors
  pdf.setFillColor(220, 220, 220); // Light gray background
  pdf.setDrawColor(0, 0, 0); // Black border
  pdf.setTextColor(0, 0, 0); // Black text
  
  // Draw header cells and text in one pass
  headers.forEach((header, index) => {
    // Draw header cell with background (fill only, no border)
    pdf.rect(currentX, startY, colWidths[index], 10, );
    
    // Add header text with proper font size for readability
    pdf.setFontSize(6.5);
    const textX = currentX + (colWidths[index] / 2);
    
    // Center-align header text (single line only for compactness)
    pdf.text(header, textX, startY + 6.5, { align: 'center' });
    
    currentX += colWidths[index];
  });
  
  // Reset font size for data
  pdf.setFontSize(6);
  
  // Table Data
  pdf.setFont('helvetica', 'normal');
  pdf.setFillColor(255, 255, 255); // White background for data rows
  let currentY = startY + 10;
  
  ledger.entries.forEach((entry) => {
    currentX = 10;
    const rowData = [
      formatDate(entry.date),
      entry.memoNo || '',
      entry.tripDetails || '',
      entry.detentionCharges > 0 ? entry.detentionCharges.toLocaleString() : '',
      entry.extraWeightCharges > 0 ? entry.extraWeightCharges.toLocaleString() : '',
      entry.creditAmount > 0 ? entry.creditAmount.toLocaleString() : '',
      entry.debitPayment > 0 ? entry.debitPayment.toLocaleString() : '',
      entry.debitAdvance > 0 ? entry.debitAdvance.toLocaleString() : '',
      entry.runningBalance.toLocaleString(),
      entry.remarks || ''
    ];
    
    rowData.forEach((data, colIndex) => {
      // Draw cell border
      pdf.rect(currentX, currentY, colWidths[colIndex], 7, 'S');
      const textWidth = colWidths[colIndex] - 2;
      if (typeof data === 'string' && data.length > 0) {
        // Handle text wrapping for long content
        const lines = pdf.splitTextToSize(data, textWidth);
        pdf.text(lines[0] || '', currentX + 1, currentY + 5);
      }
      currentX += colWidths[colIndex];
    });
    currentY += 7;
    
    // Add new page if needed (increased threshold for landscape)
    if (currentY > 180) {
      pdf.addPage();
      currentY = 20;
    }
  });
  
  // Totals row
  currentX = 10;
  pdf.setFont('helvetica', 'bold');
  pdf.setFillColor(230, 230, 230); // Light gray background for totals
  
  const totalDetention = ledger.entries.reduce((sum, entry) => sum + entry.detentionCharges, 0);
  const totalExtraWeight = ledger.entries.reduce((sum, entry) => sum + entry.extraWeightCharges, 0);
  const totalCredit = ledger.entries.reduce((sum, entry) => sum + entry.creditAmount, 0);
  const totalDebitPayment = ledger.entries.reduce((sum, entry) => sum + (entry.type === 'payment_debit' ? entry.debitAmount : (entry as any).debitPayment || 0), 0);
  const totalDebitAdvance = ledger.entries.reduce((sum, entry) => sum + (entry.type === 'advance_debit' ? entry.debitAmount : (entry as any).debitAdvance || 0), 0);
  
  const totalRowData = [
    'TOTALS',
    '',
    '',
    totalDetention.toLocaleString(),
    totalExtraWeight.toLocaleString(),
    totalCredit.toLocaleString(),
    totalDebitPayment.toLocaleString(),
    totalDebitAdvance.toLocaleString(),
    ledger.outstandingBalance.toLocaleString(),
    ''
  ];
  
  totalRowData.forEach((data, colIndex) => {
    // Draw totals cell with background (fill only, no border)
    pdf.rect(currentX, currentY, colWidths[colIndex], 10, );
    
    if (data) {
      // Right-align numeric columns, left-align text
      if (colIndex >= 3 && colIndex <= 8) {
        const textX = currentX + colWidths[colIndex] - 2;
        pdf.text(data, textX, currentY + 6.5, { align: 'right' });
      } else {
        pdf.text(data, currentX + 2, currentY + 6.5);
      }
    }
    currentX += colWidths[colIndex];
  });
  
  pdf.save(`Supplier_Ledger_${ledger.supplierName}.pdf`);
};
