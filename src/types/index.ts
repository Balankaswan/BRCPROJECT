export interface Party {
  id: string;
  name: string;
  mobile?: string;
  address?: string;
  gst?: string;
  balance: number;
  activeTrips: number;
  createdAt: string;
}

export interface Supplier {
  id: string;
  name: string;
  mobile?: string;
  address?: string;
  balance: number;
  activeTrips: number;
  createdAt: string;
}

export interface LoadingSlip {
  id: string;
  slipNo: string;
  date: string;
  vehicleNo: string;
  from: string;
  to: string;
  partyName: string;
  partyPersonName?: string;
  partyPersonContact?: string;
  supplierDetail: string;
  material: string;
  weight: number;
  dimensions: string;
  freight: number;
  rtoAmount?: number;
  advanceAmount: number;
  linkedMemoNo?: string;
  linkedBillNo?: string;
  createdAt: string;
}

export interface Memo {
  id: string;
  memoNo: string;
  loadingDate: string;
  from: string;
  to: string;
  supplierId: string;
  supplierName: string;
  partyName?: string;
  vehicle: string;
  material?: string;
  weight?: number;
  freight: number;
  commission: number;
  mamul: number;
  detention: number;
  rtoAmount: number;
  extraCharge: number;
  advances: Advance[];
  balance: number;
  amountReceived?: number; // Total amount received from bank transactions
  totalMemoAmount?: number; // Calculated: freight + detention
  status: 'pending' | 'paid';
  paidDate?: string;
  notes?: string;
  createdAt: string;
}

export interface Bill {
  id: string;
  billNo: string;
  billDate: string;
  partyId: string;
  partyName: string;
  trips: BillTrip[];
  totalFreight: number;
  mamul: number;
  detention: number;
  rtoAmount: number;
  extraCharges: number;
  advances: Advance[];
  balance: number;
  status: 'pending' | 'fully_paid' | 'settled_with_deductions' | 'received';
  receivedDate?: string;
  receivedNarration?: string;
  podAttached?: boolean;
  podUrl?: string;
  payments: BillPayment[];
  totalDeductions: number;
  netAmountReceived: number;
  notes?: string;
  createdAt: string;
}

export interface BillTrip {
  id: string;
  cnNo: string;
  loadingDate: string;
  from: string;
  to: string;
  vehicle: string;
  weight: number;
  freight: number;
  rtoChallan: string;
  detention?: number;
  mamul?: number;
}

export interface Advance {
  id: string;
  amount: number;
  date: string;
  narration?: string;
}

export interface PaymentDeduction {
  id: string;
  type: 'tds' | 'mamul' | 'payment_charges' | 'commission' | 'other';
  amount: number;
  description?: string;
  percentage?: number; // For TDS, Commission etc.
}

export interface BillPayment {
  id: string;
  billId: string;
  paymentDate: string;
  billAmount: number;
  receivedAmount: number;
  differenceAmount: number;
  deductions: PaymentDeduction[];
  remainingBalance: number;
  paymentMethod?: string;
  reference?: string;
  remarks?: string;
  createdAt: string;
}

export interface BankEntry {
  id: string;
  date: string;
  type: 'credit' | 'debit';
  amount: number;
  narration: string;
  category: 'bill' | 'memo' | 'advance' | 'expense' | 'transfer' | 'other';
  relatedId?: string;
  relatedName?: string;
  senderName?: string;
  receiverName?: string;
  createdAt: string;
}

export interface LedgerEntry {
  id: string;
  date: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
  type: 'bill' | 'memo' | 'advance' | 'expense' | 'payment' | 'other';
  relatedId?: string;
  billNo?: string;
  memoNo?: string;
  tripDetails?: string;
  detentionCharges?: number;
  extraWeightCharges?: number;
  commission?: number;
  mamul?: number;
}

export interface Ledger {
  id: string;
  name: string;
  type: 'party' | 'supplier' | 'expense' | 'other';
  entries: LedgerEntry[];
  balance: number;
  createdAt: string;
}

// Party and Supplier Ledger interfaces
export interface PartyLedgerEntry {
  id: string;
  type: 'bill_credit' | 'advance_debit' | 'payment_debit' | 'deduction_debit';
  entryType: 'credit' | 'debit';
  date: string;
  billNo: string;
  billDate: string;
  particulars: string; // Description of the transaction
  
  // Accounting amounts
  creditAmount: number;
  debitAmount: number;
  runningBalance: number; // Running balance after this entry
  
  // Bill-specific details
  billAmount?: number; // Original bill amount (for bill_credit entries)
  tripDetails?: string; // Trip details (for bill_credit entries)
  
  // Payment-specific fields
  paymentAmount?: number; // Total payment amount (for payment_debit entries)
  paymentMode?: 'bank_transfer' | 'cash' | 'cheque' | 'online' | 'other';
  paymentReference?: string; // Cheque no, transaction ID, etc.
  
  // Advance details (for advance_debit entries)
  advanceAmount?: number;
  
  // Deduction details (for deduction_debit entries)
  deductionType?: 'tds' | 'mamool' | 'payment_charges' | 'commission' | 'other';
  deductionAmount?: number;
  
  // Status and metadata
  status?: 'pending' | 'partially_paid' | 'fully_paid';
  remarks?: string;
  relatedBillId: string;
  relatedPaymentId?: string; // Links deduction entries to payment
  createdAt: string;
}

export interface PartyLedger {
  id: string;
  partyId: string;
  partyName: string;
  entries: PartyLedgerEntry[];
  outstandingBalance: number; // Total pending amount across all bills
  totalBillAmount: number; // Sum of all bill amounts
  totalPaid: number; // Sum of all net payments received
  totalDeductions: number; // Sum of all deductions
  paidBills: number; // Count of fully paid bills
  pendingBills: number; // Count of pending bills
  partiallyPaidBills: number; // Count of partially paid bills
  createdAt: string;
  updatedAt: string;
}

export interface SupplierLedgerEntry {
  id: string;
  date: string;
  memoNo: string;
  tripDetails: string;
  detentionCharges: number;
  extraWeightCharges: number;
  creditAmount: number;
  debitPayment: number;
  debitAdvance: number;
  runningBalance: number;
  remarks: string;
  relatedMemoId: string;
  relatedBankEntryId?: string;
  commission: number;
  mamul: number;
}

export interface SupplierLedger {
  id: string;
  supplierId: string;
  supplierName: string;
  entries: SupplierLedgerEntry[];
  outstandingBalance: number;
  createdAt: string;
}

export interface POD {
  id: string;
  billId: string;
  billNo: string;
  partyName: string;
  fileName: string;
  fileUrl: string;
  uploadDate: string;
}