import { Bill, PartyLedger, PartyLedgerEntry, BankEntry, Party } from '../types';

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

  // Sort bills by date for chronological order
  const sortedBills = [...partyBills].sort((a, b) => 
    new Date(a.billDate).getTime() - new Date(b.billDate).getTime()
  );

  // Process each bill - Create entries in proper order: Bill first, then advances/deductions
  sortedBills.forEach(bill => {
    const billAmount = bill.totalFreight + bill.detention + (bill.rtoAmount || 0) + (bill.extraCharges || 0) - bill.mamul;
    const tripDetails = bill.trips.map(trip => `${trip.from} to ${trip.to}`).join(', ');
    
    // Store all entries for this bill to maintain proper ordering
    const billEntries: PartyLedgerEntry[] = [];
    
    // 1. Create Bill Credit Entry FIRST (Bill Amount)
    runningBalance += billAmount;
    
    const billCreditEntry: PartyLedgerEntry = {
      id: `${bill.id}_bill_credit`,
      type: 'bill_credit',
      entryType: 'credit',
      date: bill.billDate,
      billNo: bill.billNo,
      billDate: bill.billDate,
      particulars: `Bill Amount - ${tripDetails}`,
      creditAmount: billAmount,
      debitAmount: 0,
      runningBalance,
      billAmount,
      tripDetails,
      status: bill.status === 'received' ? 'fully_paid' : 'pending',
      relatedBillId: bill.id,
      createdAt: bill.createdAt || new Date().toISOString(),
    };
    
    billEntries.push(billCreditEntry);

    // 2. Create Advance Debit Entries AFTER bill entry (if any)
    if (bill.advances && bill.advances.length > 0) {
      bill.advances.forEach((advance, index) => {
        runningBalance -= advance.amount;
        
        const advanceEntry: PartyLedgerEntry = {
          id: `${bill.id}_advance_${index}`,
          type: 'advance_debit',
          entryType: 'debit',
          date: advance.date,
          billNo: bill.billNo,
          billDate: bill.billDate,
          particulars: `Advance Received - ${advance.narration || 'Bill advance'}`,
          creditAmount: 0,
          debitAmount: advance.amount,
          runningBalance,
          advanceAmount: advance.amount,
          relatedBillId: bill.id,
          createdAt: (bill.createdAt || new Date().toISOString()).slice(0, 19) + '.001Z', // Slightly later timestamp
        };
        
        billEntries.push(advanceEntry);
      });
    }
    
    // Add all bill entries in proper order
    entries.push(...billEntries);

    // 3. Create Payment Debit Entries from Bank Entries (ONLY for non-advance transactions)
    // Note: Banking transactions that create advances are already included in bill.advances above
    // So we only process banking transactions that are NOT creating advances (i.e., regular payments)
    const billPayments = bankEntries.filter(entry => 
      entry.category === 'bill' && entry.relatedId === bill.id
    );

    // Skip banking entries that are already represented in bill.advances to avoid double counting
    // Banking advances have IDs starting with "bank_" and are already included in bill.advances
    const uniquePayments = billPayments.filter(payment => {
      // Check if this banking transaction already created an advance in bill.advances
      const hasMatchingAdvance = bill.advances?.some(advance => 
        advance.id.startsWith('bank_') && 
        advance.amount === payment.amount &&
        advance.date === payment.date
      );
      return !hasMatchingAdvance;
    });

    uniquePayments.forEach(payment => {
      runningBalance -= payment.amount;
      
      const paymentEntry: PartyLedgerEntry = {
        id: `${payment.id}_payment`,
        type: 'payment_debit',
        entryType: 'debit',
        date: payment.date,
        billNo: bill.billNo,
        billDate: bill.billDate,
        particulars: `Payment Received - ${payment.narration || 'Bank payment'}`,
        creditAmount: 0,
        debitAmount: payment.amount,
        runningBalance,
        paymentAmount: payment.amount,
        paymentMode: 'bank_transfer',
        paymentReference: payment.narration,
        relatedBillId: bill.id,
        relatedPaymentId: payment.id,
        createdAt: payment.date + 'T00:00:00.000Z',
      };
      
      entries.push(paymentEntry);
    });

    // 4. Create Deduction Entries from Bill Payments (if bill has payment info)
    if (bill.payments && bill.payments.length > 0) {
      bill.payments.forEach(payment => {
        // Payment received entry
        runningBalance -= payment.receivedAmount;
        
        const paymentEntry: PartyLedgerEntry = {
          id: `${bill.id}_payment_${payment.id}`,
          type: 'payment_debit',
          entryType: 'debit',
          date: payment.paymentDate,
          billNo: bill.billNo,
          billDate: bill.billDate,
          particulars: `Payment Received - ${payment.remarks || 'Bill payment'}`,
          creditAmount: 0,
          debitAmount: payment.receivedAmount,
          runningBalance,
          paymentAmount: payment.receivedAmount,
          paymentMode: 'bank_transfer',
          paymentReference: payment.reference,
          relatedBillId: bill.id,
          relatedPaymentId: payment.id,
          createdAt: payment.paymentDate + 'T00:00:00.000Z',
        };
        
        entries.push(paymentEntry);

        // Individual deduction entries from payment.deductions array
        const deductionEntries = payment.deductions || [];

        deductionEntries.forEach((deduction, index) => {
          if (deduction.amount > 0) {
            runningBalance -= deduction.amount;
            
            const deductionEntry: PartyLedgerEntry = {
              id: `${bill.id}_deduction_${payment.id}_${index}`,
              type: 'deduction_debit',
              entryType: 'debit',
              date: payment.paymentDate,
              billNo: bill.billNo,
              billDate: bill.billDate,
              particulars: `${deduction.type.toUpperCase()} Deduction - ${deduction.description || payment.remarks || 'Payment deduction'}`,
              creditAmount: 0,
              debitAmount: deduction.amount,
              runningBalance,
              deductionType: deduction.type === 'mamul' ? 'mamool' : deduction.type,
              deductionAmount: deduction.amount,
              relatedBillId: bill.id,
              relatedPaymentId: payment.id,
              createdAt: payment.paymentDate + 'T00:00:00.000Z',
            };
            
            entries.push(deductionEntry);
          }
        });
      });
    }
  });

  // Sort all entries by bill date first, then by entry type to ensure proper ordering
  entries.sort((a, b) => {
    // First sort by bill date
    const dateA = new Date(a.billDate || a.date).getTime();
    const dateB = new Date(b.billDate || b.date).getTime();
    
    if (dateA !== dateB) {
      return dateA - dateB;
    }
    
    // If same bill date, ensure proper entry order within the bill:
    // 1. Bill Credit (bill_credit) comes first
    // 2. Advance Debit (advance_debit) comes second
    // 3. Payment Debit (payment_debit) comes third
    // 4. Deduction Debit (deduction_debit) comes last
    const typeOrder = {
      'bill_credit': 1,
      'advance_debit': 2, 
      'payment_debit': 3,
      'deduction_debit': 4
    };
    
    const orderA = typeOrder[a.type as keyof typeof typeOrder] || 5;
    const orderB = typeOrder[b.type as keyof typeof typeOrder] || 5;
    
    if (orderA !== orderB) {
      return orderA - orderB;
    }
    
    // Finally sort by creation time for same type entries
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

  // Recalculate running balances in chronological order
  let balance = 0;
  entries.forEach(entry => {
    if (entry.entryType === 'credit') {
      balance += entry.creditAmount;
    } else {
      balance -= entry.debitAmount;
    }
    entry.runningBalance = balance;
  });

  // Calculate summary statistics
  const totalBillAmount = entries
    .filter(entry => entry.type === 'bill_credit')
    .reduce((sum, entry) => sum + entry.creditAmount, 0);
    
  const totalPaid = entries
    .filter(entry => entry.type === 'payment_debit')
    .reduce((sum, entry) => sum + entry.debitAmount, 0);
    
  const totalDeductions = entries
    .filter(entry => entry.type === 'deduction_debit')
    .reduce((sum, entry) => sum + entry.debitAmount, 0);

  const paidBills = partyBills.filter(bill => bill.status === 'received').length;
  const pendingBills = partyBills.filter(bill => bill.status === 'pending').length;
  const partiallyPaidBills = partyBills.filter(bill => 
    bill.payments && bill.payments.length > 0 && bill.status === 'pending'
  ).length;

  return {
    id: `auto_${party.id}`,
    partyId: party.id,
    partyName: party.name,
    entries,
    outstandingBalance: balance,
    totalBillAmount,
    totalPaid,
    totalDeductions,
    paidBills,
    pendingBills,
    partiallyPaidBills,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
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
