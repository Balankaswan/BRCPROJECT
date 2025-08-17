import { Bill, PartyLedger, PartyLedgerEntry, BankEntry, Party, Memo, SupplierLedger, SupplierLedgerEntry, Supplier } from '../types';

/**
 * Automatically generate Party Ledger entries from existing bills and bank entries
 * This ensures the ledger is always up-to-date without requiring manual migration
 */

export const generatePartyLedgerFromBills = (
  party: Party,
  bills: Bill[],
  bankEntries: BankEntry[]
): PartyLedger => {
  const partyBills = bills.filter(bill => bill.partyId === party.id);
  const entries: PartyLedgerEntry[] = [];
  let runningBalance = 0;

  // Get all transactions (bills + banking entries) and sort by date
  const allTransactions: any[] = [];

  // Add bill entries
  partyBills.forEach(bill => {
    const billAmount = bill.totalFreight + bill.detention + (bill.rtoAmount || 0) + (bill.extraCharges || 0) - bill.mamul;
    const tripDetails = bill.trips.map(trip => `${trip.from} to ${trip.to}`).join(', ');
    
    allTransactions.push({
      type: 'bill',
      date: bill.billDate,
      bill,
      billAmount,
      tripDetails
    });

    // Add advance entries from bill
    if (bill.advances && bill.advances.length > 0) {
      bill.advances.forEach((advance, index) => {
        allTransactions.push({
          type: 'bill_advance',
          date: advance.date || bill.billDate,
          bill,
          advance,
          advanceIndex: index
        });
      });
    }
  });

  // Add banking entries linked to this party's bills
  const partyBankEntries = bankEntries.filter(entry => {
    const linkedBill = partyBills.find(bill => bill.id === entry.relatedId);
    return linkedBill && entry.category === 'bill';
  });

  partyBankEntries.forEach(bankEntry => {
    const linkedBill = partyBills.find(bill => bill.id === bankEntry.relatedId);
    if (linkedBill) {
      allTransactions.push({
        type: 'payment',
        date: bankEntry.date,
        bill: linkedBill,
        bankEntry
      });
    }
  });

  // Sort all transactions by date
  allTransactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Process transactions in chronological order
  allTransactions.forEach(transaction => {
    if (transaction.type === 'bill') {
      // Credit entry for bill amount
      runningBalance += transaction.billAmount;
      
      const billCreditEntry: PartyLedgerEntry = {
        id: `${transaction.bill.id}_bill_credit`,
        type: 'bill_credit',
        entryType: 'credit',
        date: transaction.date,
        billNo: transaction.bill.billNo,
        billDate: transaction.bill.billDate,
        particulars: `Bill Amount - ${transaction.tripDetails}`,
        creditAmount: transaction.billAmount,
        debitAmount: 0,
        runningBalance,
        billAmount: transaction.billAmount,
        tripDetails: transaction.tripDetails,
        status: transaction.bill.status === 'received' ? 'fully_paid' : 'pending',
        relatedBillId: transaction.bill.id,
        createdAt: transaction.bill.createdAt || new Date().toISOString(),
      };
      
      entries.push(billCreditEntry);
    } else if (transaction.type === 'bill_advance') {
      // Debit entry for advance amount
      runningBalance -= transaction.advance.amount;
      
      const advanceEntry: PartyLedgerEntry = {
        id: `${transaction.bill.id}_advance_${transaction.advanceIndex}`,
        type: 'advance_debit',
        entryType: 'debit',
        date: transaction.date,
        billNo: transaction.bill.billNo,
        billDate: transaction.bill.billDate,
        particulars: `Advance - ${transaction.advance.narration || 'Bill advance'}`,
        creditAmount: 0,
        debitAmount: transaction.advance.amount,
        runningBalance,
        billAmount: 0,
        tripDetails: '',
        status: 'pending',
        relatedBillId: transaction.bill.id,
        createdAt: transaction.advance.date || transaction.bill.createdAt || new Date().toISOString(),
      };
      
      entries.push(advanceEntry);
    } else if (transaction.type === 'payment') {
      // Debit entry for payment amount
      runningBalance -= transaction.bankEntry.amount;
      
      const paymentEntry: PartyLedgerEntry = {
        id: `${transaction.bill.id}_payment_${transaction.bankEntry.id}`,
        type: 'payment_debit',
        entryType: 'debit',
        date: transaction.date,
        billNo: transaction.bill.billNo,
        billDate: transaction.bill.billDate,
        particulars: `Payment - ${transaction.bankEntry.narration || 'Bank payment'}`,
        creditAmount: 0,
        debitAmount: transaction.bankEntry.amount,
        runningBalance,
        billAmount: 0,
        tripDetails: '',
        status: 'pending',
        relatedBillId: transaction.bill.id,
        createdAt: transaction.bankEntry.createdAt || new Date().toISOString(),
      };
      
      entries.push(paymentEntry);
    }
  });

  // Calculate totals
  const totalCredit = entries.reduce((sum, entry) => sum + (entry.creditAmount || 0), 0);
  const totalDebit = entries.reduce((sum, entry) => sum + (entry.debitAmount || 0), 0);
  const outstandingBalance = totalCredit - totalDebit;

  return {
    id: `auto_${party.id}`,
    partyId: party.id,
    partyName: party.name,
    entries,
    outstandingBalance,
    totalBillAmount: totalCredit,
    totalPaid: totalDebit,
    totalDeductions: 0,
    paidBills: partyBills.filter(bill => bill.status === 'received').length,
    pendingBills: partyBills.filter(bill => bill.status === 'pending').length,
    partiallyPaidBills: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
};

/**
 * Automatically generate Supplier Ledger entries from existing memos and bank entries
 */
export const generateSupplierLedgerFromMemos = (
  supplier: Supplier,
  memos: Memo[],
  bankEntries: BankEntry[]
): SupplierLedger => {
  const supplierMemos = memos.filter(memo => memo.supplierId === supplier.id);
  const entries: SupplierLedgerEntry[] = [];
  let runningBalance = 0;

  // Get all transactions (memos + banking entries) and sort by date
  const allTransactions: any[] = [];

  // Add memo entries
  supplierMemos.forEach(memo => {
    const memoAmount = memo.freight;
    const detentionAmount = memo.detention || 0;
    const extraWeightAmount = memo.extraCharge || 0;
    const commissionAmount = memo.commission || 0;
    const mamulAmount = memo.mamul || 0;
    const tripDetails = `${memo.from} to ${memo.to}`;
    
    allTransactions.push({
      type: 'memo',
      date: memo.loadingDate,
      memo,
      memoAmount,
      detentionAmount,
      extraWeightAmount,
      commissionAmount,
      mamulAmount,
      tripDetails
    });

    // Add advance entries from memo
    if (memo.advances && memo.advances.length > 0) {
      memo.advances.forEach((advance, index) => {
        allTransactions.push({
          type: 'memo_advance',
          date: advance.date || memo.loadingDate,
          memo,
          advance,
          advanceIndex: index
        });
      });
    }
  });

  // Add banking entries linked to this supplier's memos
  const supplierBankEntries = bankEntries.filter(entry => {
    const linkedMemo = supplierMemos.find(memo => memo.id === entry.relatedId);
    return linkedMemo && entry.category === 'memo';
  });

  supplierBankEntries.forEach(bankEntry => {
    const linkedMemo = supplierMemos.find(memo => memo.id === bankEntry.relatedId);
    if (linkedMemo) {
      allTransactions.push({
        type: 'payment',
        date: bankEntry.date,
        memo: linkedMemo,
        bankEntry
      });
    }
  });

  // Sort all transactions by date
  allTransactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Process transactions in chronological order
  allTransactions.forEach(transaction => {
    if (transaction.type === 'memo') {
      // Credit entry for memo amount (we owe supplier)
      runningBalance += transaction.memoAmount + transaction.detentionAmount + transaction.extraWeightAmount;
      
      const memoEntry: SupplierLedgerEntry = {
        id: `${transaction.memo.id}_memo`,
        date: transaction.date,
        memoNo: transaction.memo.memoNo,
        tripDetails: transaction.tripDetails,
        detentionCharges: transaction.detentionAmount,
        extraWeightCharges: transaction.extraWeightAmount,
        creditAmount: transaction.memoAmount + transaction.detentionAmount + transaction.extraWeightAmount,
        debitPayment: 0,
        debitAdvance: 0,
        runningBalance,
        remarks: `Memo Amount - ${transaction.tripDetails}`,
        relatedMemoId: transaction.memo.id,
        commission: transaction.commissionAmount,
        mamul: transaction.mamulAmount,
      };
      
      entries.push(memoEntry);
    } else if (transaction.type === 'memo_advance') {
      // Debit entry for advance amount (we paid supplier)
      runningBalance -= transaction.advance.amount;
      
      const advanceEntry: SupplierLedgerEntry = {
        id: `${transaction.memo.id}_advance_${transaction.advanceIndex}`,
        date: transaction.date,
        memoNo: transaction.memo.memoNo,
        tripDetails: `${transaction.memo.from} to ${transaction.memo.to}`,
        detentionCharges: 0,
        extraWeightCharges: 0,
        creditAmount: 0,
        debitPayment: 0,
        debitAdvance: transaction.advance.amount,
        runningBalance,
        remarks: `Advance Paid - ${transaction.advance.narration || 'Memo advance'}`,
        relatedMemoId: transaction.memo.id,
        commission: 0,
        mamul: 0,
      };
      
      entries.push(advanceEntry);
    } else if (transaction.type === 'payment') {
      // Debit entry for payment amount (we paid supplier)
      runningBalance -= transaction.bankEntry.amount;
      
      const paymentEntry: SupplierLedgerEntry = {
        id: `${transaction.memo.id}_payment_${transaction.bankEntry.id}`,
        date: transaction.date,
        memoNo: transaction.memo.memoNo,
        tripDetails: `${transaction.memo.from} to ${transaction.memo.to}`,
        detentionCharges: 0,
        extraWeightCharges: 0,
        creditAmount: 0,
        debitPayment: transaction.bankEntry.amount,
        debitAdvance: 0,
        runningBalance,
        remarks: `Payment Made - ${transaction.bankEntry.narration || 'Bank payment'}`,
        relatedMemoId: transaction.memo.id,
        relatedBankEntryId: transaction.bankEntry.id,
        commission: 0,
        mamul: 0,
      };
      
      entries.push(paymentEntry);
    }
  });

  // Calculate outstanding balance
  const totalCredit = entries.reduce((sum, entry) => sum + entry.creditAmount, 0);
  const totalDebit = entries.reduce((sum, entry) => sum + entry.debitPayment + entry.debitAdvance, 0);
  const outstandingBalance = totalCredit - totalDebit;

  return {
    id: `auto_${supplier.id}`,
    supplierId: supplier.id,
    supplierName: supplier.name,
    entries,
    outstandingBalance,
    createdAt: new Date().toISOString(),
  };
};

/**
 * Generate all supplier ledgers automatically from existing data
 */
export const generateAllSupplierLedgers = (
  suppliers: Supplier[],
  memos: Memo[],
  bankEntries: BankEntry[]
): SupplierLedger[] => {
  return suppliers
    .filter(supplier => memos.some(memo => memo.supplierId === supplier.id))
    .map(supplier => generateSupplierLedgerFromMemos(supplier, memos, bankEntries));
};

/**
 * Generate all party ledgers automatically from existing data
 */
export const generateAllPartyLedgers = (
  parties: Party[],
  bills: Bill[],
  bankEntries: BankEntry[]
): PartyLedger[] => {
  return parties
    .filter(party => bills.some(bill => bill.partyId === party.id))
    .map(party => generatePartyLedgerFromBills(party, bills, bankEntries));
};

/**
 * Update a specific party ledger when a bill is created/updated
 */
export const updatePartyLedgerForBill = (
  existingLedgers: PartyLedger[],
  parties: Party[],
  bills: Bill[],
  bankEntries: BankEntry[],
  updatedBill: Bill
): PartyLedger[] => {
  const party = parties.find(p => p.id === updatedBill.partyId);
  if (!party) return existingLedgers;

  const updatedLedger = generatePartyLedgerFromBills(party, bills, bankEntries);
  
  const existingIndex = existingLedgers.findIndex(ledger => ledger.partyId === party.id);
  
  if (existingIndex >= 0) {
    const newLedgers = [...existingLedgers];
    newLedgers[existingIndex] = updatedLedger;
    return newLedgers;
  } else {
    return [...existingLedgers, updatedLedger];
  }
};
