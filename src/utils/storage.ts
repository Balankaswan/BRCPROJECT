// Local storage utilities for data persistence
export const saveToStorage = <T>(key: string, data: T): void => {
  localStorage.setItem(key, JSON.stringify(data));
};

export const getFromStorage = <T>(key: string, defaultValue: T): T => {
  const stored = localStorage.getItem(key);
  return stored ? JSON.parse(stored) : defaultValue;
};

export const removeFromStorage = (key: string): void => {
  localStorage.removeItem(key);
};

// Storage keys
export const STORAGE_KEYS = {
  PARTIES: 'brc_parties',
  SUPPLIERS: 'brc_suppliers',
  LOADING_SLIPS: 'brc_loading_slips',
  MEMOS: 'brc_memos',
  BILLS: 'brc_bills',
  PAID_MEMOS: 'brc_paid_memos',
  RECEIVED_BILLS: 'brc_received_bills',
  BANK_ENTRIES: 'brc_bank_entries',
  LEDGERS: 'brc_ledgers',
  PARTY_LEDGERS: 'brc_party_ledgers',
  SUPPLIER_LEDGERS: 'brc_supplier_ledgers',
  PODS: 'brc_pods',
  COUNTERS: 'brc_counters',
  LOCATION_SUGGESTIONS: 'brc_location_suggestions',
  BILL_PAYMENTS: 'brc_bill_payments',
  PAYMENT_DEDUCTIONS: 'brc_payment_deductions'
};
