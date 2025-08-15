import { Bill, BillPayment, PaymentDeduction, PartyLedgerEntry } from '../types';
import { formatDate } from './calculations';

export interface PaymentFormData {
  paymentDate: string;
  receivedAmount: number;
  deductions: {
    tdsDeduction: number;
    mamul: number;
    paymentCharges: number;
    commissionDeduction: number;
    otherDeduction: number;
  };
  paymentMethod?: string;
  reference?: string;
  remarks?: string;
}

/**
 * Process bill payment and calculate deductions
 */
export const processBillPayment = (bill: Bill, paymentData: PaymentFormData): {
  payment: BillPayment;
  updatedBill: Bill;
  ledgerEntry: PartyLedgerEntry;
} => {
  const billAmount = bill.balance;
  const totalDeductions = Object.values(paymentData.deductions).reduce((sum, deduction) => sum + deduction, 0);
  const differenceAmount = billAmount - paymentData.receivedAmount;
  const remainingBalance = Math.max(0, billAmount - paymentData.receivedAmount - totalDeductions);

  // Create payment deductions
  const deductions: PaymentDeduction[] = [];
  if (paymentData.deductions.tdsDeduction > 0) {
    deductions.push({
      id: Date.now().toString() + '_tds',
      type: 'tds',
      amount: paymentData.deductions.tdsDeduction,
      description: 'TDS Deduction',
    });
  }
  if (paymentData.deductions.mamul > 0) {
    deductions.push({
      id: Date.now().toString() + '_mamul',
      type: 'mamul',
      amount: paymentData.deductions.mamul,
      description: 'Mamul Deduction',
    });
  }
  if (paymentData.deductions.paymentCharges > 0) {
    deductions.push({
      id: Date.now().toString() + '_charges',
      type: 'payment_charges',
      amount: paymentData.deductions.paymentCharges,
      description: 'Payment Charges',
    });
  }
  if (paymentData.deductions.commissionDeduction > 0) {
    deductions.push({
      id: Date.now().toString() + '_commission',
      type: 'commission',
      amount: paymentData.deductions.commissionDeduction,
      description: 'Commission Deduction',
    });
  }
  if (paymentData.deductions.otherDeduction > 0) {
    deductions.push({
      id: Date.now().toString() + '_other',
      type: 'other',
      amount: paymentData.deductions.otherDeduction,
      description: 'Other Deduction',
    });
  }

  // Create payment record
  const payment: BillPayment = {
    id: Date.now().toString(),
    billId: bill.id,
    paymentDate: paymentData.paymentDate,
    billAmount,
    receivedAmount: paymentData.receivedAmount,
    differenceAmount,
    deductions,
    remainingBalance,
    paymentMethod: paymentData.paymentMethod,
    reference: paymentData.reference,
    remarks: paymentData.remarks,
    createdAt: new Date().toISOString(),
  };

  // Determine payment status
  let paymentStatus: 'pending' | 'fully_paid' | 'settled_with_deductions' = 'pending';
  let billStatus: Bill['status'] = 'pending';

  if (remainingBalance === 0) {
    if (totalDeductions > 0 || differenceAmount > 0) {
      paymentStatus = 'settled_with_deductions';
      billStatus = 'settled_with_deductions';
    } else {
      paymentStatus = 'fully_paid';
      billStatus = 'fully_paid';
    }
  }

  // Update bill with payment information
  const updatedBill: Bill = {
    ...bill,
    payments: [...(bill.payments || []), payment],
    totalDeductions: (bill.totalDeductions || 0) + totalDeductions,
    netAmountReceived: (bill.netAmountReceived || 0) + paymentData.receivedAmount,
    balance: remainingBalance,
    status: billStatus,
    receivedDate: billStatus !== 'pending' ? paymentData.paymentDate : bill.receivedDate,
    receivedNarration: billStatus !== 'pending' ? 
      `Payment processed with ${totalDeductions > 0 ? 'deductions' : 'no deductions'}. ${paymentData.remarks || ''}`.trim() : 
      bill.receivedNarration,
  };

  // Create party ledger entry
  const tripDetails = bill.trips.map(trip => `${trip.from}-${trip.to} (${trip.vehicle})`).join(', ');
  const ledgerEntry: PartyLedgerEntry = {
    id: Date.now().toString() + '_ledger',
    date: paymentData.paymentDate,
    billNo: bill.billNo,
    tripDetails,
    billAmount,
    receivedAmount: paymentData.receivedAmount,
    deductionBreakdown: paymentData.deductions,
    netReceived: paymentData.receivedAmount,
    remainingBalance,
    remarks: paymentData.remarks || 'Bill payment processed',
    relatedBillId: bill.id,
    relatedPaymentId: payment.id,
    paymentStatus,
  };

  return { payment, updatedBill, ledgerEntry };
};

/**
 * Check if bill amount equals received amount (fully paid)
 */
export const isBillFullyPaid = (billAmount: number, receivedAmount: number): boolean => {
  return Math.abs(billAmount - receivedAmount) < 0.01; // Allow for small floating point differences
};

/**
 * Calculate remaining balance after payment
 */
export const calculateRemainingBalance = (
  billAmount: number, 
  receivedAmount: number, 
  totalDeductions: number
): number => {
  return Math.max(0, billAmount - receivedAmount - totalDeductions);
};

/**
 * Generate payment summary text
 */
export const generatePaymentSummary = (payment: BillPayment): string => {
  const deductionsText = payment.deductions.length > 0 
    ? `Deductions: ${payment.deductions.map(d => `${d.description}: Rs. ${d.amount}`).join(', ')}` 
    : 'No deductions';
  
  return `Payment of Rs. ${payment.receivedAmount} received on ${formatDate(payment.paymentDate)}. ${deductionsText}. Remaining balance: Rs. ${payment.remainingBalance}`;
};

/**
 * Get total deductions by type for reporting
 */
export const getTotalDeductionsByType = (
  payments: BillPayment[], 
  startDate?: string, 
  endDate?: string
): Record<PaymentDeduction['type'], number> => {
  const filtered = payments.filter(payment => {
    if (startDate && payment.paymentDate < startDate) return false;
    if (endDate && payment.paymentDate > endDate) return false;
    return true;
  });

  const totals: Record<PaymentDeduction['type'], number> = {
    tds: 0,
    mamul: 0,
    payment_charges: 0,
    commission: 0,
    other: 0,
  };

  filtered.forEach(payment => {
    payment.deductions.forEach(deduction => {
      totals[deduction.type] += deduction.amount;
    });
  });

  return totals;
};

/**
 * Get payment report data for a date range
 */
export const getPaymentReportData = (
  payments: BillPayment[], 
  startDate?: string, 
  endDate?: string
) => {
  const filteredPayments = payments.filter(payment => {
    if (startDate && payment.paymentDate < startDate) return false;
    if (endDate && payment.paymentDate > endDate) return false;
    return true;
  });

  const totalReceived = filteredPayments.reduce((sum, payment) => sum + payment.receivedAmount, 0);
  const totalBillAmount = filteredPayments.reduce((sum, payment) => sum + payment.billAmount, 0);
  const totalDeductions = filteredPayments.reduce((sum, payment) => 
    sum + payment.deductions.reduce((deductionSum, deduction) => deductionSum + deduction.amount, 0), 0
  );

  const deductionsByType = getTotalDeductionsByType(payments, startDate, endDate);

  return {
    totalPayments: filteredPayments.length,
    totalBillAmount,
    totalReceived,
    totalDeductions,
    deductionsByType,
    netCollected: totalReceived,
    payments: filteredPayments,
  };
};
