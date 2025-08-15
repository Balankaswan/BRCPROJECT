import { Bill, Memo, BankEntry, Party, Supplier, PartyLedger } from '../types';

/**
 * Calculate the total bill amount (freight + detention - mamul)
 */
export const calculateTotalBillAmount = (bill: Bill): number => {
  return bill.totalFreight + bill.detention - bill.mamul;
};

/**
 * Calculate the total memo amount (freight + commission + detention - mamul)
 */
export const calculateTotalMemoAmount = (memo: Memo): number => {
  return memo.freight + memo.commission + memo.detention - memo.mamul;
};

/**
 * Calculate total received amount for a bill from bank entries
 */
export const calculateBillReceivedAmount = (billId: string, bankEntries: BankEntry[]): number => {
  return bankEntries
    .filter(entry => entry.category === 'bill' && entry.relatedId === billId && entry.type === 'credit')
    .reduce((sum, entry) => sum + entry.amount, 0);
};

/**
 * Calculate total received amount for a memo from bank entries
 */
export const calculateMemoReceivedAmount = (memoId: string, bankEntries: BankEntry[]): number => {
  return bankEntries
    .filter(entry => entry.category === 'memo' && entry.relatedId === memoId && entry.type === 'debit')
    .reduce((sum, entry) => sum + entry.amount, 0);
};

/**
 * Calculate correct bill balance: (freight + detention) - total_received_amount
 */
export const calculateCorrectBillBalance = (bill: Bill, bankEntries: BankEntry[]): number => {
  const totalBillAmount = calculateTotalBillAmount(bill);
  const receivedAmount = calculateBillReceivedAmount(bill.id, bankEntries);
  return Math.max(0, totalBillAmount - receivedAmount);
};

/**
 * Calculate correct memo balance: (freight + detention) - total_received_amount
 */
export const calculateCorrectMemoBalance = (memo: Memo, bankEntries: BankEntry[]): number => {
  const totalMemoAmount = calculateTotalMemoAmount(memo);
  const receivedAmount = calculateMemoReceivedAmount(memo.id, bankEntries);
  return Math.max(0, totalMemoAmount - receivedAmount);
};

/**
 * Data integrity check for bill - ensures balance doesn't exceed maximum
 */
export const validateBillBalance = (bill: Bill): { isValid: boolean; correctedBalance?: number; warning?: string } => {
  const maxBillAmount = calculateTotalBillAmount(bill);
  
  if (bill.balance > maxBillAmount) {
    return {
      isValid: false,
      correctedBalance: maxBillAmount,
      warning: `Bill ${bill.billNo}: Balance (${bill.balance}) exceeded maximum amount (${maxBillAmount}). Resetting to maximum.`
    };
  }
  
  return { isValid: true };
};

/**
 * Data integrity check for memo - ensures balance doesn't exceed maximum
 */
export const validateMemoBalance = (memo: Memo): { isValid: boolean; correctedBalance?: number; warning?: string } => {
  const maxMemoAmount = calculateTotalMemoAmount(memo);
  
  if (memo.balance > maxMemoAmount) {
    return {
      isValid: false,
      correctedBalance: maxMemoAmount,
      warning: `Memo ${memo.memoNo}: Balance (${memo.balance}) exceeded maximum amount (${maxMemoAmount}). Resetting to maximum.`
    };
  }
  
  return { isValid: true };
};

/**
 * Update bill with correct balance after bank entry deletion
 */
export const recalculateBillAfterDeletion = (
  bill: Bill, 
  deletedAmount: number, 
  bankEntries: BankEntry[]
): Bill => {
  // Calculate what the received amount should be after deletion
  const currentReceivedAmount = calculateBillReceivedAmount(bill.id, bankEntries);
  const newBalance = calculateCorrectBillBalance(bill, bankEntries);
  
  // Validate and correct if needed
  const validation = validateBillBalance({ ...bill, balance: newBalance });
  const correctedBalance = validation.isValid ? newBalance : validation.correctedBalance!;
  
  if (!validation.isValid && validation.warning) {
    console.warn(validation.warning);
  }
  
  return {
    ...bill,
    balance: correctedBalance,
    netAmountReceived: currentReceivedAmount,
    status: correctedBalance > 0 ? 'pending' as const : 'received' as const,
    receivedDate: correctedBalance > 0 ? undefined : bill.receivedDate,
    receivedNarration: correctedBalance > 0 ? undefined : bill.receivedNarration
  };
};

/**
 * Update memo with correct balance after bank entry deletion
 */
export const recalculateMemoAfterDeletion = (
  memo: Memo, 
  deletedAmount: number, 
  bankEntries: BankEntry[]
): Memo => {
  // Calculate what the received amount should be after deletion
  const currentReceivedAmount = calculateMemoReceivedAmount(memo.id, bankEntries);
  const newBalance = calculateCorrectMemoBalance(memo, bankEntries);
  
  // Validate and correct if needed
  const validation = validateMemoBalance({ ...memo, balance: newBalance });
  const correctedBalance = validation.isValid ? newBalance : validation.correctedBalance!;
  
  if (!validation.isValid && validation.warning) {
    console.warn(validation.warning);
  }
  
  return {
    ...memo,
    balance: correctedBalance,
    amountReceived: currentReceivedAmount,
    totalMemoAmount: calculateTotalMemoAmount(memo),
    status: correctedBalance > 0 ? 'pending' as const : 'paid' as const,
    paidDate: correctedBalance > 0 ? undefined : memo.paidDate
  };
};

/**
 * Ensure party balance matches the sum of all their bill balances
 */
export const synchronizePartyBalance = (
  parties: Party[],
  partyId: string,
  bills: Bill[], 
  memos: Memo[],
  bankEntries: BankEntry[]
): Party[] => {
  return parties.map(party => {
    if (party.id === partyId) {
      const partyBills = bills.filter(bill => bill.partyId === party.id);
      const totalOutstanding = partyBills.reduce((sum, bill) => sum + bill.balance, 0);
      
      return {
        ...party,
        balance: totalOutstanding,
        activeTrips: partyBills.reduce((sum, bill) => sum + bill.trips.length, 0)
      };
    }
    return party;
  });
};

/**
 * Ensure supplier balance matches the sum of all their memo balances
 */
export const synchronizeSupplierBalance = (
  suppliers: Supplier[],
  supplierId: string,
  bills: Bill[],
  memos: Memo[], 
  bankEntries: BankEntry[]
): Supplier[] => {
  return suppliers.map(supplier => {
    if (supplier.id === supplierId) {
      const supplierMemos = memos.filter(memo => memo.supplierId === supplier.id);
      const totalOutstanding = supplierMemos.reduce((sum, memo) => sum + memo.balance, 0);
      
      return {
        ...supplier,
        balance: totalOutstanding,
        activeTrips: supplierMemos.length
      };
    }
    return supplier;
  });
};

/**
 * Find all bills linked to a bank entry by ID or name
 */
export const findLinkedBills = (
  allBills: Bill[],
  relatedId?: string, 
  relatedName?: string
): Bill[] => {
  const linkedBills: Bill[] = [];
  
  // First try to find by relatedId (direct link)
  if (relatedId) {
    const billById = allBills.find(b => b.id === relatedId);
    if (billById) {
      linkedBills.push(billById);
    }
  }
  
  // If not found by ID, try to find by bill number in relatedName
  if (relatedName && linkedBills.length === 0) {
    const billByNumber = allBills.find(b => b.billNo === relatedName);
    if (billByNumber) {
      linkedBills.push(billByNumber);
    }
  }
  
  return linkedBills;
};

/**
 * Find all memos linked to a bank entry by ID or name
 */
export const findLinkedMemos = (
  allMemos: Memo[],
  relatedId?: string, 
  relatedName?: string
): Memo[] => {
  const linkedMemos: Memo[] = [];
  
  // First try to find by relatedId (direct link)
  if (relatedId) {
    const memoById = allMemos.find(m => m.id === relatedId);
    if (memoById) {
      linkedMemos.push(memoById);
    }
  }
  
  // If not found by ID, try to find by memo number in relatedName
  if (relatedName && linkedMemos.length === 0) {
    const memoByNumber = allMemos.find(m => m.memoNo === relatedName);
    if (memoByNumber) {
      linkedMemos.push(memoByNumber);
    }
  }
  
  return linkedMemos;
};
