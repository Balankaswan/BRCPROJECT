import io from 'socket.io-client';

// Configuration - Environment-based URLs
const isLocalhost = window.location.hostname === 'localhost' || 
                   window.location.hostname === '127.0.0.1' ||
                   window.location.hostname.startsWith('192.168.') ||
                   window.location.port === '5173';

const API_BASE_URL = isLocalhost 
  ? 'http://192.168.1.13:3001/api'
  : 'https://brcproject.onrender.com/api';

const SOCKET_URL = isLocalhost 
  ? 'http://192.168.1.13:3001'
  : 'https://brcproject.onrender.com';

console.log('🔍 Debug Info:');
console.log('   - window.location.hostname:', window.location.hostname);
console.log('   - isLocalhost:', isLocalhost);
console.log('🌐 Environment:', isLocalhost ? 'LOCAL' : 'PRODUCTION');
console.log('🌐 API Base URL:', API_BASE_URL);
console.log('🔌 Socket URL:', SOCKET_URL);

// Socket.io connection with secure transport
let socket: any = null;

export const initializeSocket = () => {
  if (!socket) {
    console.log('🔌 Initializing Socket.io connection...');
    
    const socketConfig = isLocalhost ? {
      transports: ['websocket', 'polling'],
      timeout: 10000
    } : {
      transports: ['websocket', 'polling'],
      secure: true,
      rejectUnauthorized: false,
      timeout: 10000,
      forceNew: true
    };
    
    socket = io(SOCKET_URL, socketConfig);
    
    socket.on('connect', () => {
      console.log('✅ Connected to server via Socket.io');
      console.log('🔗 Transport:', socket.io.engine.transport.name);
      console.log('🌍 Environment:', isLocalhost ? 'LOCAL' : 'PRODUCTION');
    });
    
    socket.on('disconnect', (reason: string) => {
      console.log('❌ Disconnected from server:', reason);
    });

    socket.on('connect_error', (error: Error) => {
      console.error('❌ Socket connection error:', error.message);
      if (!isLocalhost) {
        console.log('🔄 Falling back to polling transport...');
      }
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
    const fullUrl = `${API_BASE_URL}${endpoint}`;
    console.log(`🔄 API Request: ${options.method || 'GET'} ${fullUrl}`);
    
    try {
      const response = await fetch(fullUrl, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      });

      console.log(`📡 Response Status: ${response.status} ${response.statusText}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ API Error Response:`, errorText);
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
      }

      const data = await response.json();
      console.log(`✅ API Response:`, data);
      return data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      console.error('❌ API request failed:', {
        url: fullUrl,
        method: options.method || 'GET',
        error: errorMessage,
        stack: errorStack
      });
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
