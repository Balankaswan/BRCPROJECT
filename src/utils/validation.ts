import { getFromStorage, STORAGE_KEYS } from './storage';
import { Bill, Memo, LoadingSlip } from '../types';

export interface ValidationResult {
  isValid: boolean;
  message?: string;
}

/**
 * Check if a memo number is unique
 */
export const validateMemoNumber = (memoNo: string, excludeId?: string): ValidationResult => {
  if (!memoNo.trim()) {
    return { isValid: false, message: 'Memo number is required' };
  }

  const memos: Memo[] = getFromStorage(STORAGE_KEYS.MEMOS, []);
  const paidMemos: Memo[] = getFromStorage(STORAGE_KEYS.PAID_MEMOS, []);
  
  // Check in both active and paid memos
  const allMemos = [...memos, ...paidMemos];
  const existingMemo = allMemos.find(memo => 
    memo.memoNo.toLowerCase() === memoNo.toLowerCase() && memo.id !== excludeId
  );

  if (existingMemo) {
    return { 
      isValid: false, 
      message: `Memo number "${memoNo}" already exists. Please use a different number.` 
    };
  }

  return { isValid: true };
};

/**
 * Check if a bill number is unique
 */
export const validateBillNumber = (billNo: string, excludeId?: string): ValidationResult => {
  if (!billNo.trim()) {
    return { isValid: false, message: 'Bill number is required' };
  }

  const bills: Bill[] = getFromStorage(STORAGE_KEYS.BILLS, []);
  const receivedBills: Bill[] = getFromStorage(STORAGE_KEYS.RECEIVED_BILLS, []);
  
  // Check in both active and received bills
  const allBills = [...bills, ...receivedBills];
  const existingBill = allBills.find(bill => 
    bill.billNo.toLowerCase() === billNo.toLowerCase() && bill.id !== excludeId
  );

  if (existingBill) {
    return { 
      isValid: false, 
      message: `Bill number "${billNo}" already exists. Please use a different number.` 
    };
  }

  return { isValid: true };
};

/**
 * Check if a loading slip number is unique
 */
export const validateLoadingSlipNumber = (slipNo: string, excludeId?: string): ValidationResult => {
  if (!slipNo.trim()) {
    return { isValid: false, message: 'Loading slip number is required' };
  }

  const loadingSlips: LoadingSlip[] = getFromStorage(STORAGE_KEYS.LOADING_SLIPS, []);
  const existingSlip = loadingSlips.find(slip => 
    slip.slipNo.toLowerCase() === slipNo.toLowerCase() && slip.id !== excludeId
  );

  if (existingSlip) {
    return { 
      isValid: false, 
      message: `Loading slip number "${slipNo}" already exists. Please use a different number.` 
    };
  }

  return { isValid: true };
};

/**
 * Validate all required fields for a memo
 */
export const validateMemoForm = (formData: any, excludeId?: string): ValidationResult => {
  // Check memo number uniqueness
  const memoNumberValidation = validateMemoNumber(formData.memoNo, excludeId);
  if (!memoNumberValidation.isValid) {
    return memoNumberValidation;
  }

  // Check other required fields
  if (!formData.from?.trim()) {
    return { isValid: false, message: 'From location is required' };
  }

  if (!formData.to?.trim()) {
    return { isValid: false, message: 'To location is required' };
  }

  if (!formData.vehicle?.trim()) {
    return { isValid: false, message: 'Vehicle number is required' };
  }

  if (!formData.freight || parseFloat(formData.freight) <= 0) {
    return { isValid: false, message: 'Valid freight amount is required' };
  }

  return { isValid: true };
};

/**
 * Validate all required fields for a bill
 */
export const validateBillForm = (formData: any, excludeId?: string): ValidationResult => {
  // Check bill number uniqueness
  const billNumberValidation = validateBillNumber(formData.billNo, excludeId);
  if (!billNumberValidation.isValid) {
    return billNumberValidation;
  }

  if (!formData.partyName?.trim()) {
    return { isValid: false, message: 'Party name is required' };
  }

  return { isValid: true };
};

/**
 * Validate all required fields for a loading slip
 */
export const validateLoadingSlipForm = (formData: any, excludeId?: string): ValidationResult => {
  // Check slip number uniqueness
  const slipNumberValidation = validateLoadingSlipNumber(formData.slipNo, excludeId);
  if (!slipNumberValidation.isValid) {
    return slipNumberValidation;
  }

  if (!formData.vehicleNo?.trim()) {
    return { isValid: false, message: 'Vehicle number is required' };
  }

  if (!formData.from?.trim()) {
    return { isValid: false, message: 'From location is required' };
  }

  if (!formData.to?.trim()) {
    return { isValid: false, message: 'To location is required' };
  }

  if (!formData.partyName?.trim()) {
    return { isValid: false, message: 'Party name is required' };
  }

  if (!formData.freight || parseFloat(formData.freight) <= 0) {
    return { isValid: false, message: 'Valid freight amount is required' };
  }

  return { isValid: true };
};
