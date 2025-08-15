import { apiService, initializeSocket, getSocket } from './apiService';

// Initialize socket connection
const socket = initializeSocket();

// Data service that replaces localStorage with backend API
class BackendDataService {
  private cache: { [key: string]: any[] } = {};
  private listeners: { [key: string]: ((data: any[]) => void)[] } = {};

  constructor() {
    this.setupSocketListeners();
  }

  private setupSocketListeners() {
    // Listen for real-time updates from server
    const tables = ['loading_slips', 'memos', 'bills', 'bank_entries', 'parties', 'suppliers'];
    
    tables.forEach(tableName => {
      socket.on(`${tableName}_created`, (data: any) => {
        this.refreshCache(tableName);
      });

      socket.on(`${tableName}_updated`, (data: any) => {
        this.refreshCache(tableName);
      });

      socket.on(`${tableName}_deleted`, (data: any) => {
        this.refreshCache(tableName);
      });
    });
  }

  private async refreshCache(tableName: string) {
    try {
      const data = await apiService.getAll(tableName);
      this.cache[tableName] = data;
      
      // Notify all listeners
      if (this.listeners[tableName]) {
        this.listeners[tableName].forEach(callback => callback(data));
      }
    } catch (error) {
      console.error(`Error refreshing cache for ${tableName}:`, error);
    }
  }

  // Subscribe to data changes
  subscribe(tableName: string, callback: (data: any[]) => void) {
    if (!this.listeners[tableName]) {
      this.listeners[tableName] = [];
    }
    this.listeners[tableName].push(callback);

    // Return unsubscribe function
    return () => {
      if (this.listeners[tableName]) {
        this.listeners[tableName] = this.listeners[tableName].filter(cb => cb !== callback);
      }
    };
  }

  // Loading Slips
  async getLoadingSlips() {
    if (!this.cache.loading_slips) {
      this.cache.loading_slips = await apiService.getLoadingSlips();
    }
    return this.cache.loading_slips;
  }

  async addLoadingSlip(slip: any) {
    const result = await apiService.createLoadingSlip(slip);
    return result;
  }

  async updateLoadingSlip(id: string, slip: any) {
    const result = await apiService.updateLoadingSlip(id, slip);
    return result;
  }

  async deleteLoadingSlip(id: string) {
    await apiService.deleteLoadingSlip(id);
  }

  // Memos
  async getMemos() {
    if (!this.cache.memos) {
      this.cache.memos = await apiService.getMemos();
    }
    return this.cache.memos;
  }

  async addMemo(memo: any) {
    const result = await apiService.createMemo(memo);
    return result;
  }

  async updateMemo(id: string, memo: any) {
    const result = await apiService.updateMemo(id, memo);
    return result;
  }

  async deleteMemo(id: string) {
    await apiService.deleteMemo(id);
  }

  // Bills
  async getBills() {
    if (!this.cache.bills) {
      this.cache.bills = await apiService.getBills();
    }
    return this.cache.bills;
  }

  async addBill(bill: any) {
    const result = await apiService.createBill(bill);
    return result;
  }

  async updateBill(id: string, bill: any) {
    const result = await apiService.updateBill(id, bill);
    return result;
  }

  async deleteBill(id: string) {
    await apiService.deleteBill(id);
  }

  // Bank Entries
  async getBankEntries() {
    if (!this.cache.bank_entries) {
      this.cache.bank_entries = await apiService.getBankEntries();
    }
    return this.cache.bank_entries;
  }

  async addBankEntry(entry: any) {
    const result = await apiService.createBankEntry(entry);
    return result;
  }

  async updateBankEntry(id: string, entry: any) {
    const result = await apiService.updateBankEntry(id, entry);
    return result;
  }

  async deleteBankEntry(id: string) {
    await apiService.deleteBankEntry(id);
  }

  // Parties
  async getParties() {
    if (!this.cache.parties) {
      this.cache.parties = await apiService.getParties();
    }
    return this.cache.parties;
  }

  async addParty(party: any) {
    const result = await apiService.createParty(party);
    return result;
  }

  async updateParty(id: string, party: any) {
    const result = await apiService.updateParty(id, party);
    return result;
  }

  async deleteParty(id: string) {
    await apiService.deleteParty(id);
  }

  // Suppliers
  async getSuppliers() {
    if (!this.cache.suppliers) {
      this.cache.suppliers = await apiService.getSuppliers();
    }
    return this.cache.suppliers;
  }

  async addSupplier(supplier: any) {
    const result = await apiService.createSupplier(supplier);
    return result;
  }

  async updateSupplier(id: string, supplier: any) {
    const result = await apiService.updateSupplier(id, supplier);
    return result;
  }

  async deleteSupplier(id: string) {
    await apiService.deleteSupplier(id);
  }

  // Counters
  async getCounters() {
    return await apiService.getCounters();
  }

  async updateCounter(id: string, value: number) {
    return await apiService.updateCounter(id, value);
  }
}

export const backendDataService = new BackendDataService();
