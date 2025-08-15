import io from 'socket.io-client';

// Configuration - Use Node.js backend on LAN IP for multi-device access
const API_BASE_URL = 'http://192.168.1.3:3001/api';
const SOCKET_URL = 'http://192.168.1.3:3001';

console.log('🌐 API Base URL:', API_BASE_URL);
console.log('🔌 Socket URL:', SOCKET_URL);

// Socket.io connection
let socket: any = null;

export const initializeSocket = () => {
  if (!socket) {
    socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling']
    });
    
    socket.on('connect', () => {
      console.log('✅ Connected to server');
    });
    
    socket.on('disconnect', () => {
      console.log('❌ Disconnected from server');
    });
  }
  return socket;
};

export const getSocket = () => {
  if (!socket) {
    return initializeSocket();
  }
  return socket;
};

// Generic API functions
class ApiService {
  private async request(endpoint: string, options: RequestInit = {}) {
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  // Generic CRUD operations
  async getAll(tableName: string) {
    return this.request(`/${tableName}`);
  }

  async getById(tableName: string, id: string) {
    return this.request(`/${tableName}/${id}`);
  }

  async create(tableName: string, data: any) {
    return this.request(`/${tableName}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async update(tableName: string, id: string, data: any) {
    return this.request(`/${tableName}/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async delete(tableName: string, id: string) {
    return this.request(`/${tableName}/${id}`, {
      method: 'DELETE',
    });
  }

  // Specific methods for each entity
  
  // Loading Slips
  async getLoadingSlips() {
    return this.getAll('loading_slips');
  }

  async createLoadingSlip(data: any) {
    return this.create('loading_slips', data);
  }

  async updateLoadingSlip(id: string, data: any) {
    return this.update('loading_slips', id, data);
  }

  async deleteLoadingSlip(id: string) {
    return this.delete('loading_slips', id);
  }

  // Memos
  async getMemos() {
    return this.getAll('memos');
  }

  async createMemo(data: any) {
    return this.create('memos', data);
  }

  async updateMemo(id: string, data: any) {
    return this.update('memos', id, data);
  }

  async deleteMemo(id: string) {
    return this.delete('memos', id);
  }

  // Bills
  async getBills() {
    return this.getAll('bills');
  }

  async createBill(data: any) {
    return this.create('bills', data);
  }

  async updateBill(id: string, data: any) {
    return this.update('bills', id, data);
  }

  async deleteBill(id: string) {
    return this.delete('bills', id);
  }

  // Banking/Cashbook
  async getBankEntries() {
    return this.getAll('bank_entries');
  }

  async createBankEntry(data: any) {
    return this.create('bank_entries', data);
  }

  async updateBankEntry(id: string, data: any) {
    return this.update('bank_entries', id, data);
  }

  async deleteBankEntry(id: string) {
    return this.delete('bank_entries', id);
  }

  // Parties
  async getParties() {
    return this.getAll('parties');
  }

  async createParty(data: any) {
    return this.create('parties', data);
  }

  async updateParty(id: string, data: any) {
    return this.update('parties', id, data);
  }

  async deleteParty(id: string) {
    return this.delete('parties', id);
  }

  // Suppliers
  async getSuppliers() {
    return this.getAll('suppliers');
  }

  async createSupplier(data: any) {
    return this.create('suppliers', data);
  }

  async updateSupplier(id: string, data: any) {
    return this.update('suppliers', id, data);
  }

  async deleteSupplier(id: string) {
    return this.delete('suppliers', id);
  }

  // Counters
  async getCounters() {
    return this.request('/counters');
  }

  async updateCounter(id: string, value: number) {
    return this.request(`/counters/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ value }),
    });
  }

  // File upload
  async uploadFile(file: File) {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE_URL}/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Upload failed! status: ${response.status}`);
    }

    return await response.json();
  }

  // Health check
  async healthCheck() {
    return this.request('/health');
  }
}

export const apiService = new ApiService();

// Real-time data synchronization hooks
export const useRealTimeSync = (tableName: string, callback: (data: any[]) => void) => {
  const socket = getSocket();
  
  // Listen for real-time updates
  socket.on(`${tableName}_created`, (data: any) => {
    console.log(`New ${tableName} created:`, data);
    // Refresh data
    apiService.getAll(tableName).then(callback);
  });

  socket.on(`${tableName}_updated`, (data: any) => {
    console.log(`${tableName} updated:`, data);
    // Refresh data
    apiService.getAll(tableName).then(callback);
  });

  socket.on(`${tableName}_deleted`, (data: any) => {
    console.log(`${tableName} deleted:`, data);
    // Refresh data
    apiService.getAll(tableName).then(callback);
  });

  // Cleanup function
  return () => {
    socket.off(`${tableName}_created`);
    socket.off(`${tableName}_updated`);
    socket.off(`${tableName}_deleted`);
  };
};
