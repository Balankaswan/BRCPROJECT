import { Bill, PartyLedger, PartyLedgerEntry, BillPayment, PaymentDeduction } from '../types';

export interface PaymentData {
  paymentAmount: number;
  paymentDate: string;
  paymentMode: 'bank_transfer' | 'cash' | 'cheque' | 'online' | 'other';
  tdsDeduction: number;
  mamoolDeduction: number;
  paymentCharges: number;
  commissionDeduction: number;
  otherDeduction: number;
  paymentReference?: string;
  remarks?: string;
}

/**
 * Create a Credit entry when a bill is created (Bill amount goes to Party's Credit)
 */
export const createBillCreditEntry = (bill: Bill, runningBalance: number): PartyLedgerEntry => {
  const tripDetails = bill.trips
    .map(trip => `${trip.from} to ${trip.to} (${trip.vehicle})`)
    .join(', ');

  const billAmount = bill.totalFreight + bill.detention + (bill.extraCharges || 0) - bill.mamul;
  
  return {
    id: `${bill.id}_bill_credit`,
    type: 'bill_credit',
    entryType: 'credit',
    date: bill.billDate,
    billNo: bill.billNo,
    billDate: bill.billDate,
    particulars: `Bill Amount - ${tripDetails}`,
    creditAmount: billAmount,
    debitAmount: 0,
    runningBalance: runningBalance + billAmount,
    billAmount,
    tripDetails,
    status: 'pending',
    remarks: `Bill created for ${bill.trips.length} trip(s)`,
    relatedBillId: bill.id,
    createdAt: new Date().toISOString(),
  };
};

/**
 * Create a Debit entry for advance amount when bill has advances
 */
export const createAdvanceDebitEntry = (bill: Bill, runningBalance: number): PartyLedgerEntry => {
  const totalAdvanceAmount = bill.advances.reduce((sum, advance) => sum + advance.amount, 0);
  
  return {
    id: `${bill.id}_advance_debit`,
    type: 'advance_debit',
    entryType: 'debit',
    date: bill.billDate,
    billNo: bill.billNo,
    billDate: bill.billDate,
    particulars: `Advance received as per Bill No. ${bill.billNo}`,
    creditAmount: 0,
    debitAmount: totalAdvanceAmount,
    runningBalance: runningBalance - totalAdvanceAmount,
    advanceAmount: totalAdvanceAmount,
    remarks: `Advance amount for bill ${bill.billNo}`,
    relatedBillId: bill.id,
    createdAt: new Date().toISOString(),
  };
};

/**
 * Create a Debit entry for payment received (reduces party's outstanding balance)
 */
export const createPaymentDebitEntry = (
  bill: Bill,
  paymentData: PaymentData,
  runningBalance: number,
  paymentId: string
): PartyLedgerEntry => {
  return {
    id: `${bill.id}_payment_debit_${Date.now()}`,
    type: 'payment_debit',
    entryType: 'debit',
    date: paymentData.paymentDate,
    billNo: bill.billNo,
    billDate: bill.billDate,
    particulars: `Payment received against Bill No. ${bill.billNo}`,
    creditAmount: 0,
    debitAmount: paymentData.paymentAmount,
    runningBalance: runningBalance - paymentData.paymentAmount,
    paymentAmount: paymentData.paymentAmount,
    paymentMode: paymentData.paymentMode,
    paymentReference: paymentData.paymentReference,
    remarks: paymentData.remarks || `Payment received via ${paymentData.paymentMode}`,
    relatedBillId: bill.id,
    relatedPaymentId: paymentId,
    createdAt: new Date().toISOString(),
  };
};

/**
 * Create Debit entries for each deduction type
 */
export const createDeductionDebitEntries = (
  bill: Bill,
  paymentData: PaymentData,
  runningBalance: number,
  paymentId: string
): PartyLedgerEntry[] => {
  const entries: PartyLedgerEntry[] = [];
  let currentBalance = runningBalance;
  
  const deductions = [
    { type: 'tds', amount: paymentData.tdsDeduction, label: 'TDS Deduction' },
    { type: 'mamool', amount: paymentData.mamoolDeduction, label: 'Mamool Deduction' },
    { type: 'payment_charges', amount: paymentData.paymentCharges, label: 'Payment Charges' },
    { type: 'commission', amount: paymentData.commissionDeduction, label: 'Commission Deduction' },
    { type: 'other', amount: paymentData.otherDeduction, label: 'Other Deduction' },
  ];

  deductions.forEach(deduction => {
    if (deduction.amount > 0) {
      currentBalance += deduction.amount; // Add back since it's a deduction (increases outstanding)
      
      entries.push({
        id: `${bill.id}_${deduction.type}_debit_${Date.now()}_${Math.random()}`,
        type: 'deduction_debit',
        entryType: 'debit',
        date: paymentData.paymentDate,
        billNo: bill.billNo,
        billDate: bill.billDate,
        particulars: `${deduction.label} - Bill No. ${bill.billNo}`,
        creditAmount: 0,
        debitAmount: deduction.amount,
        runningBalance: currentBalance,
        deductionType: deduction.type as 'tds' | 'mamool' | 'payment_charges' | 'commission' | 'other',
        deductionAmount: deduction.amount,
        remarks: `${deduction.label} for payment against bill ${bill.billNo}`,
        relatedBillId: bill.id,
        relatedPaymentId: paymentId,
        createdAt: new Date().toISOString(),
      });
    }
  });

  return entries;
};

/**
 * Update or create party ledger when a bill is created (Credit/Debit system)
 */
export const addBillToPartyLedger = (
  existingLedgers: PartyLedger[],
  bill: Bill
): PartyLedger[] => {
  const existingLedgerIndex = existingLedgers.findIndex(
    ledger => ledger.partyId === bill.partyId
  );

  const billAmount = bill.totalFreight + bill.detention + (bill.extraCharges || 0) - bill.mamul;
  const totalAdvanceAmount = bill.advances.reduce((sum, advance) => sum + advance.amount, 0);
  
  if (existingLedgerIndex >= 0) {
    // Update existing ledger
    const existingLedger = existingLedgers[existingLedgerIndex];
    const currentBalance = existingLedger.outstandingBalance;
    
    const entriesToAdd: PartyLedgerEntry[] = [];
    
    // 1. Create Credit entry for bill amount
    const billCreditEntry = createBillCreditEntry(bill, currentBalance);
    entriesToAdd.push(billCreditEntry);
    
    // 2. Create Debit entry for advance amount if present
    if (totalAdvanceAmount > 0) {
      const advanceDebitEntry = createAdvanceDebitEntry(bill, billCreditEntry.runningBalance);
      entriesToAdd.push(advanceDebitEntry);
    }
    
    const finalBalance = entriesToAdd[entriesToAdd.length - 1].runningBalance;
    
    const updatedLedger: PartyLedger = {
      ...existingLedger,
      entries: [...existingLedger.entries, ...entriesToAdd],
      outstandingBalance: finalBalance,
      totalBillAmount: existingLedger.totalBillAmount + billAmount,
      pendingBills: existingLedger.pendingBills + 1,
      updatedAt: new Date().toISOString(),
    };

    const newLedgers = [...existingLedgers];
    newLedgers[existingLedgerIndex] = updatedLedger;
    return newLedgers;
  } else {
    // Create new ledger
    const entriesToAdd: PartyLedgerEntry[] = [];
    
    // 1. Create Credit entry for bill amount
    const billCreditEntry = createBillCreditEntry(bill, 0);
    entriesToAdd.push(billCreditEntry);
    
    // 2. Create Debit entry for advance amount if present
    if (totalAdvanceAmount > 0) {
      const advanceDebitEntry = createAdvanceDebitEntry(bill, billCreditEntry.runningBalance);
      entriesToAdd.push(advanceDebitEntry);
    }
    
    const finalBalance = entriesToAdd[entriesToAdd.length - 1].runningBalance;
    
    const newLedger: PartyLedger = {
      id: `ledger_${bill.partyId}`,
      partyId: bill.partyId,
      partyName: bill.partyName,
      entries: entriesToAdd,
      outstandingBalance: finalBalance,
      totalBillAmount: billAmount,
      totalPaid: 0,
      totalDeductions: 0,
      paidBills: 0,
      pendingBills: 1,
      partiallyPaidBills: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return [...existingLedgers, newLedger];
  }
};

/**
 * Add payment to party ledger (Credit/Debit system)
 */
export const addPaymentToPartyLedger = (
  existingLedgers: PartyLedger[],
  bill: Bill,
  paymentData: PaymentData
): { updatedLedgers: PartyLedger[]; paymentEntry: PartyLedgerEntry } => {
  const ledgerIndex = existingLedgers.findIndex(
    ledger => ledger.partyId === bill.partyId
  );

  if (ledgerIndex === -1) {
    throw new Error('Party ledger not found. Bill should be created first.');
  }

  const existingLedger = existingLedgers[ledgerIndex];
  const currentBalance = existingLedger.outstandingBalance;
  const paymentId = `payment_${Date.now()}`;
  
  const entriesToAdd: PartyLedgerEntry[] = [];
  let runningBalance = currentBalance;
  
  // 1. Create Debit entry for payment received (reduces outstanding)
  const paymentDebitEntry = createPaymentDebitEntry(bill, paymentData, runningBalance, paymentId);
  entriesToAdd.push(paymentDebitEntry);
  runningBalance = paymentDebitEntry.runningBalance;
  
  // 2. Create Debit entries for each deduction (increases outstanding back)
  const deductionEntries = createDeductionDebitEntries(bill, paymentData, runningBalance, paymentId);
  entriesToAdd.push(...deductionEntries);
  
  // Update running balance to the final value
  const finalBalance = entriesToAdd.length > 0 ? entriesToAdd[entriesToAdd.length - 1].runningBalance : runningBalance;
  
  // Calculate net payment (payment amount minus deductions)
  const totalDeductions = paymentData.tdsDeduction + paymentData.mamoolDeduction + 
    paymentData.paymentCharges + paymentData.commissionDeduction + paymentData.otherDeduction;
  const netPayment = paymentData.paymentAmount - totalDeductions;
  
  // Determine bill status
  let billStatus: 'pending' | 'partially_paid' | 'fully_paid' = 'pending';
  if (finalBalance <= 0) {
    billStatus = 'fully_paid';
  } else if (finalBalance < (bill.totalFreight + bill.detention + (bill.extraCharges || 0) - bill.mamul)) {
    billStatus = 'partially_paid';
  }
  
  // Update status on payment entry
  paymentDebitEntry.status = billStatus;
  
  // Count bill statuses after this payment
  const allBillIds = [...new Set(existingLedger.entries.map(e => e.relatedBillId))];
  let paidCount = 0;
  let partiallyPaidCount = 0;
  let pendingCount = 0;

  // Calculate status counts (simplified for now)
  if (billStatus === 'fully_paid') {
    paidCount = existingLedger.paidBills + 1;
    pendingCount = Math.max(0, existingLedger.pendingBills - 1);
    partiallyPaidCount = existingLedger.partiallyPaidBills;
  } else if (billStatus === 'partially_paid') {
    partiallyPaidCount = existingLedger.partiallyPaidBills + (existingLedger.pendingBills > 0 ? 1 : 0);
    pendingCount = Math.max(0, existingLedger.pendingBills - (existingLedger.pendingBills > 0 ? 1 : 0));
    paidCount = existingLedger.paidBills;
  } else {
    paidCount = existingLedger.paidBills;
    pendingCount = existingLedger.pendingBills;
    partiallyPaidCount = existingLedger.partiallyPaidBills;
  }

  const updatedLedger: PartyLedger = {
    ...existingLedger,
    entries: [...existingLedger.entries, ...entriesToAdd],
    outstandingBalance: finalBalance,
    totalPaid: existingLedger.totalPaid + netPayment,
    totalDeductions: existingLedger.totalDeductions + totalDeductions,
    paidBills: paidCount,
    pendingBills: pendingCount,
    partiallyPaidBills: partiallyPaidCount,
    updatedAt: new Date().toISOString(),
  };

  const newLedgers = [...existingLedgers];
  newLedgers[ledgerIndex] = updatedLedger;

  return {
    updatedLedgers: newLedgers,
    paymentEntry: paymentDebitEntry, // Return the main payment entry
  };
};

/**
 * Get bill payment history from ledger entries
 */
export const getBillPaymentHistory = (
  ledger: PartyLedger,
  billId: string
): PartyLedgerEntry[] => {
  return ledger.entries
    .filter(entry => entry.relatedBillId === billId)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
};

/**
 * Filter ledger entries by payment status
 */
export const filterLedgerEntriesByStatus = (
  ledger: PartyLedger,
  status: 'pending' | 'partially_paid' | 'fully_paid' | 'all'
): PartyLedgerEntry[] => {
  if (status === 'all') {
    return ledger.entries;
  }

  // Get unique bill IDs and their latest status
  const billIds = [...new Set(ledger.entries.map(e => e.relatedBillId))];
  const filteredBillIds: string[] = [];

  billIds.forEach(billId => {
    const billEntries = ledger.entries
      .filter(e => e.relatedBillId === billId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    if (billEntries.length > 0 && billEntries[0].status === status) {
      filteredBillIds.push(billId);
    }
  });

  return ledger.entries.filter(entry => filteredBillIds.includes(entry.relatedBillId));
};

/**
 * Get summary statistics for a party ledger
 */
export const getPartyLedgerSummary = (ledger: PartyLedger) => {
  const totalBills = [...new Set(ledger.entries.map(e => e.relatedBillId))].length;
  
  return {
    totalBills,
    totalBillAmount: ledger.totalBillAmount,
    totalPaid: ledger.totalPaid,
    totalDeductions: ledger.totalDeductions,
    outstandingBalance: ledger.outstandingBalance,
    paidBills: ledger.paidBills,
    pendingBills: ledger.pendingBills,
    partiallyPaidBills: ledger.partiallyPaidBills,
    collectionEfficiency: ledger.totalBillAmount > 0 
      ? ((ledger.totalPaid / ledger.totalBillAmount) * 100).toFixed(2) + '%'
      : '0%',
  };
};
