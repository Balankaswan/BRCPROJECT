import { Memo, SupplierLedger, SupplierLedgerEntry, BankEntry, Supplier } from '../types';

/**
 * Automatically generate Supplier Ledger entries from existing memos and bank entries
 * This ensures the supplier ledger is always up-to-date without requiring manual migration
 */

export const generateSupplierLedgerFromMemos = (
  supplier: Supplier,
  memos: Memo[],
  bankEntries: BankEntry[]
): SupplierLedger => {
  const supplierMemos = memos.filter(memo => memo.supplierId === supplier.id);
  const entries: SupplierLedgerEntry[] = [];
  let runningBalance = 0;

  // Sort memos by date for chronological order
  const sortedMemos = [...supplierMemos].sort((a, b) => 
    new Date(a.loadingDate).getTime() - new Date(b.loadingDate).getTime()
  );

  // Process each memo
  sortedMemos.forEach(memo => {
    // 1. Create Memo Credit Entry (Memo Amount + Detention + RTO + Extra Charge)
    const freight = parseFloat(memo.freight?.toString() || '0') || 0;
    const detention = parseFloat(memo.detention?.toString() || '0') || 0;
    const rtoAmount = parseFloat(memo.rtoAmount?.toString() || '0') || 0;
    const extraCharge = parseFloat(memo.extraCharge?.toString() || '0') || 0;
    const commission = parseFloat(memo.commission?.toString() || '0') || 0;
    const mamul = parseFloat(memo.mamul?.toString() || '0') || 0;
    
    const memoAmount = freight + detention + rtoAmount + extraCharge;
    const tripDetails = `${memo.from} to ${memo.to} (${memo.vehicle})`;
    
    runningBalance += memoAmount;
    
    const memoCreditEntry: SupplierLedgerEntry = {
      id: `${memo.id}_memo_credit`,
      date: memo.loadingDate,
      memoNo: memo.memoNo,
      tripDetails,
      detentionCharges: detention,
      extraWeightCharges: extraCharge,
      creditAmount: memoAmount,
      debitPayment: 0,
      debitAdvance: 0,
      runningBalance,
      remarks: `Memo Amount - ${tripDetails}`,
      relatedMemoId: memo.id,
      commission: commission,
      mamul: mamul,
    };
    
    entries.push(memoCreditEntry);

    // 2. Create Advance Debit Entries (if any)
    if (memo.advances && memo.advances.length > 0) {
      memo.advances.forEach((advance, index) => {
        const advanceAmount = parseFloat(advance.amount?.toString() || '0') || 0;
        runningBalance -= advanceAmount;
        
        const advanceEntry: SupplierLedgerEntry = {
          id: `${memo.id}_advance_${index}`,
          date: advance.date,
          memoNo: memo.memoNo,
          tripDetails,
          detentionCharges: 0,
          extraWeightCharges: 0,
          creditAmount: 0,
          debitPayment: 0,
          debitAdvance: advanceAmount,
          runningBalance,
          remarks: `Advance Paid - ${advance.narration || 'Memo advance'}`,
          relatedMemoId: memo.id,
          commission: 0,
          mamul: 0,
        };
        
        entries.push(advanceEntry);
      });
    }

    // 3. Create Commission Deduction Entry
    if (commission > 0) {
      runningBalance -= commission;
      
      const commissionEntry: SupplierLedgerEntry = {
        id: `${memo.id}_commission`,
        date: memo.loadingDate,
        memoNo: memo.memoNo,
        tripDetails,
        detentionCharges: 0,
        extraWeightCharges: 0,
        creditAmount: 0,
        debitPayment: commission,
        debitAdvance: 0,
        runningBalance,
        remarks: `Commission Deduction - ${tripDetails}`,
        relatedMemoId: memo.id,
        commission: commission,
        mamul: 0,
      };
      
      entries.push(commissionEntry);
    }

    // 4. Create Mamul Deduction Entry
    if (mamul > 0) {
      runningBalance -= mamul;
      
      const mamulEntry: SupplierLedgerEntry = {
        id: `${memo.id}_mamul`,
        date: memo.loadingDate,
        memoNo: memo.memoNo,
        tripDetails,
        detentionCharges: 0,
        extraWeightCharges: 0,
        creditAmount: 0,
        debitPayment: mamul,
        debitAdvance: 0,
        runningBalance,
        remarks: `Mamul Deduction - ${tripDetails}`,
        relatedMemoId: memo.id,
        commission: 0,
        mamul: mamul,
      };
      
      entries.push(mamulEntry);
    }

    // 5. Create Payment Debit Entries from Bank Entries
    const memoPayments = bankEntries.filter(entry => 
      entry.category === 'memo' && entry.relatedId === memo.id
    );

    memoPayments.forEach(payment => {
      const paymentAmount = parseFloat(payment.amount?.toString() || '0') || 0;
      runningBalance -= paymentAmount;
      
      const paymentEntry: SupplierLedgerEntry = {
        id: `${payment.id}_payment`,
        date: payment.date,
        memoNo: memo.memoNo,
        tripDetails,
        detentionCharges: 0,
        extraWeightCharges: 0,
        creditAmount: 0,
        debitPayment: paymentAmount,
        debitAdvance: 0,
        runningBalance,
        remarks: `Payment Made - ${payment.narration || 'Bank payment'}`,
        relatedMemoId: memo.id,
        relatedBankEntryId: payment.id,
        commission: 0,
        mamul: 0,
      };
      
      entries.push(paymentEntry);
    });
  });

  // Sort all entries by date
  entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Recalculate running balances in chronological order
  let balance = 0;
  entries.forEach(entry => {
    const creditAmount = parseFloat(entry.creditAmount?.toString() || '0') || 0;
    const debitPayment = parseFloat(entry.debitPayment?.toString() || '0') || 0;
    const debitAdvance = parseFloat(entry.debitAdvance?.toString() || '0') || 0;
    
    balance += creditAmount;
    balance -= debitPayment;
    balance -= debitAdvance;
    entry.runningBalance = balance;
  });

  return {
    id: `auto_${supplier.id}`,
    supplierId: supplier.id,
    supplierName: supplier.name,
    entries,
    outstandingBalance: balance,
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
 * Update a specific supplier ledger when a memo is created/updated
 */
export const updateSupplierLedgerForMemo = (
  existingLedgers: SupplierLedger[],
  suppliers: Supplier[],
  memos: Memo[],
  bankEntries: BankEntry[],
  updatedMemo: Memo
): SupplierLedger[] => {
  const supplier = suppliers.find(s => s.id === updatedMemo.supplierId);
  if (!supplier) return existingLedgers;

  const updatedLedger = generateSupplierLedgerFromMemos(supplier, memos, bankEntries);
  
  const existingIndex = existingLedgers.findIndex(ledger => ledger.supplierId === supplier.id);
  
  if (existingIndex >= 0) {
    const newLedgers = [...existingLedgers];
    newLedgers[existingIndex] = updatedLedger;
    return newLedgers;
  } else {
    return [...existingLedgers, updatedLedger];
  }
};
