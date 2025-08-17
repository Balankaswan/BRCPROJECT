import io from 'socket.io-client';
import { useState, useEffect } from 'react';

// Configuration - Environment-based URLs
// Only use local API if explicitly enabled or running on the standard Vite port (5173).
// This prevents dev preview proxies (e.g., 127.0.0.1:53059) from accidentally targeting localhost backend.
const useLocalApi = typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_USE_LOCAL_API === 'true';
const isViteDefaultPort = window.location.port === '5173';
const isLocalApi = useLocalApi || isViteDefaultPort;

const API_BASE_URL = isLocalApi
  ? 'http://localhost:3001/api'
  : 'https://brcproject.onrender.com/api';

const SOCKET_URL = isLocalApi
  ? 'http://localhost:3001'
  : 'https://brcproject.onrender.com';

console.log('🔍 Debug Info:');
console.log('   - window.location.hostname:', window.location.hostname);
console.log('   - isLocalApi:', isLocalApi);
console.log('🌐 Environment:', isLocalApi ? 'LOCAL' : 'PRODUCTION');
console.log('🌐 API Base URL:', API_BASE_URL);
console.log('🔌 Socket URL:', SOCKET_URL);

// Socket.io connection with secure transport
let socket: any = null;

export const initializeSocket = () => {
  if (!socket) {
    console.log('🔌 Initializing Socket.io connection...');
    
    const socketConfig = isLocalApi ? {
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
      console.log('✅ Connected to server');
      console.log('🔗 Transport:', socket.io.engine.transport.name);
      console.log('🌍 Environment:', isLocalApi ? 'LOCAL' : 'PRODUCTION');
    });
    
    socket.on('disconnect', (reason: string) => {
      console.log('❌ Disconnected from server:', reason);
    });

    socket.on('connect_error', (error: Error) => {
      console.error('❌ Socket connection error:', error.message);
      if (!isLocalApi) {
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

  // Ledger operations
  async getPartyLedgers() {
    return this.getAll('party_ledgers');
  }

  async getSupplierLedgers() {
    return this.getAll('supplier_ledgers');
  }

  async createPartyLedger(data: any) {
    return this.create('party_ledgers', data);
  }

  async createSupplierLedger(data: any) {
    return this.create('supplier_ledgers', data);
  }

  async updatePartyLedger(id: string, data: any) {
    return this.update('party_ledgers', id, data);
  }

  async updateSupplierLedger(id: string, data: any) {
    return this.update('supplier_ledgers', id, data);
  }

  // Specific methods for each entity
  
  // Loading Slips
  async getLoadingSlips() {
    const backendData = await this.getAll('loading_slips');
    // Map backend fields to frontend fields
    return backendData.map((item: any) => ({
      id: item._id || item.id,
      slipNo: item.slipNumber,
      date: item.loadingDate,
      vehicleNo: item.vehicleNumber,
      from: item.from_location,
      to: item.to_location,
      partyName: item.partyName,
      partyPersonName: item.partyPersonName,
      supplierDetail: item.supplierDetail,
      material: item.materialType,
      weight: item.weight,
      dimensions: item.dimensions,
      freight: item.freight,
      rtoAmount: item.rtoAmount,
      advanceAmount: item.advance, // backend uses 'advance'
      linkedMemoNo: item.linkedMemoNo || null,
      linkedBillNo: item.linkedBillNo || null,
      linkedMemoId: item.linkedMemoId || null,
      linkedBillId: item.linkedBillId || null,
      createdAt: item.createdAt
    }));
  }

  async createLoadingSlip(data: any) {
    return this.create('loading_slips', data);
  }

  async updateLoadingSlip(id: string, data: any) {
    return this.update('loading_slips', id, data);
  }

  // Parties
  async getParties() {
    const backendData = await this.getAll('parties');
    // Map backend to frontend shape with safe defaults
    return backendData.map((item: any) => ({
      id: item._id || item.id,
      name: item.name,
      mobile: item.mobile || '',
      address: item.address || '',
      gst: item.gst || '',
      balance: item.balance ?? 0,
      activeTrips: item.activeTrips ?? 0,
      createdAt: item.createdAt
    }));
  }

  async createParty(data: any) {
    return this.create('parties', data);
  }

  async updateParty(id: string, data: any) {
    return this.update('parties', id, data);
  }

  // Memos
  async getMemos() {
    const backendData = await this.getAll('memos');
    // Map to frontend shape expected by components
    return backendData.map((item: any) => ({
      id: item._id || item.id,
      memoNo: item.memoNumber,
      loadingDate: item.loadingDate,
      from: item.from_location,
      to: item.to_location,
      supplierId: item.supplierId, // may be undefined; UI mostly uses supplierName
      supplierName: item.supplierName,
      partyName: item.partyName,
      vehicle: item.vehicleNumber,
      weight: item.weight,
      material: item.materialType,
      freight: item.freight,
      mamul: item.mamul || 0,
      detention: item.detention || 0,
      rtoAmount: item.rtoAmount || 0,
      extraCharge: item.extraCharge || 0,
      commission: item.commission || 0,
      balance: item.balance || 0,
      status: item.status || 'pending',
      paidDate: item.paidDate || null,
      paidAmount: item.paidAmount || 0,
      advances: item.advances || [],
      notes: item.notes || '',
      createdAt: item.createdAt,
      updatedAt: item.updatedAt
    }));
  }

  async createMemo(data: any) {
    return this.create('memos', data);
  }

  async updateMemo(id: string, data: any) {
    return this.update('memos', id, data);
  }

  // Bills
  async getBills() {
    const backendData = await this.getAll('bills');
    // Map to frontend Bill shape expected by components
    return backendData.map((item: any) => ({
      id: item._id || item.id,
      billNo: item.billNumber,
      billDate: item.billDate,
      partyId: item.partyId, // optional
      partyName: item.partyName,
      trips: (item.trips || []).map((t: any) => ({
        id: t.id || `${item._id || item.id}-${t.cnNo || ''}`,
        cnNo: t.cnNo,
        loadingDate: t.loadingDate,
        from: t.from,
        to: t.to,
        vehicle: t.vehicleNumber || t.vehicle, // normalize to 'vehicle'
        weight: t.weight,
        freight: t.freight,
        rtoChallan: t.rtoChallan || '',
        detention: t.detention || 0,
        mamul: t.mamul || 0
      })),
      totalFreight: item.totalFreight ?? item.totalAmount ?? 0,
      mamul: item.mamul || 0,
      detention: item.detention || 0,
      rtoAmount: item.rtoAmount || 0,
      extraCharges: item.extraCharges || item.extraCharge || 0,
      advances: item.advances || [],
      balance: item.balance || 0,
      status: item.status || 'pending',
      receivedDate: item.receivedDate || null,
      receivedAmount: item.receivedAmount || 0,
      payments: item.payments || [],
      totalDeductions: item.totalDeductions || 0,
      netAmountReceived: item.netAmountReceived || 0,
      notes: item.notes || '',
      createdAt: item.createdAt,
      updatedAt: item.updatedAt
    }));
  }

  async createBill(data: any) {
    return this.create('bills', data);
  }

  async updateBill(id: string, data: any) {
    return this.update('bills', id, data);
  }

  // Suppliers
  async getSuppliers() {
    const backendData = await this.getAll('suppliers');
    // Map backend to frontend shape with safe defaults
    return backendData.map((item: any) => ({
      id: item._id || item.id,
      name: item.name,
      mobile: item.mobile || '',
      address: item.address || '',
      balance: item.balance ?? 0,
      activeTrips: item.activeTrips ?? 0,
      createdAt: item.createdAt
    }));
  }

  async createSupplier(data: any) {
    return this.create('suppliers', data);
  }

  async updateSupplier(id: string, data: any) {
    return this.update('suppliers', id, data);
  }

  async deleteLoadingSlip(id: string) {
    return this.delete('loading_slips', id);
  }

  async deleteMemo(id: string) {
    return this.delete('memos', id);
  }

  async deleteBill(id: string) {
    return this.delete('bills', id);
  }

  async deleteSupplier(id: string) {
    return this.delete('suppliers', id);
  }

  // Banking/Cashbook
  async getBankEntries() {
    return this.getAll('bank_entries');
  }

  async createBankEntry(data: any) {
    return this.create('bank_entries', data);
  }

  async createBankEntryWithLedgerUpdate(data: any) {
    // Create bank entry and trigger ledger updates
    const result = await this.create('bank_entries', data);
    
    // Trigger ledger recalculation on backend
    if (data.category === 'bill' && data.relatedId) {
      await this.request(`/ledgers/party/${data.relatedId}/recalculate`, { method: 'POST' });
    } else if (data.category === 'memo' && data.relatedId) {
      await this.request(`/ledgers/supplier/${data.relatedId}/recalculate`, { method: 'POST' });
    }
    
    return result;
  }

  async updateBankEntry(id: string, data: any) {
    return this.update('bank_entries', id, data);
  }

  async deleteBankEntry(id: string) {
    return this.delete('bank_entries', id);
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

  // Force sync data to backend
  async syncToBackend(key: string, data: any[]): Promise<void> {
    const endpointMap: { [key: string]: string } = {
      'loadingSlips': 'loading_slips',
      'memos': 'memos',
      'bills': 'bills',
      'parties': 'parties', 
      'suppliers': 'suppliers',
      'bankEntries': 'bank_entries'
    };

    const endpoint = endpointMap[key];
    if (!endpoint) {
      console.warn(`⚠️ No endpoint mapping found for key: ${key}`);
      return;
    }

    console.log(`🔄 Force syncing ${key} to backend:`, data.length, 'items');

    // Sync each item to backend
    for (const item of data) {
      if (item.id) {
        try {
          await this.update(endpoint, item.id, item);
          console.log(`✅ Synced ${endpoint}:`, item.id);
        } catch (error) {
          try {
            await this.create(endpoint, item);
            console.log(`✅ Created ${endpoint}:`, item.id);
          } catch (createError) {
            console.error(`❌ Failed to sync ${endpoint}:`, createError);
          }
        }
      }
    }
  }
}

export const apiService = new ApiService();

// Enhanced real-time data synchronization hooks with retry mechanism
export const useRealTimeSync = (tableName: string, callback: (data: any[]) => void) => {
  const socket = getSocket();
  
  // Enhanced error handling and retry mechanism
  const refreshDataWithRetry = async (retryCount = 0) => {
    try {
      // Use specific getters to keep frontend mapping consistent
      let data: any[] = [];
      if (tableName === 'loading_slips') data = await apiService.getLoadingSlips();
      else if (tableName === 'memos') data = await apiService.getMemos();
      else if (tableName === 'bills') data = await apiService.getBills();
      else data = await apiService.getAll(tableName);
      callback(data);
      console.log(`✅ Successfully refreshed ${tableName} data`);
    } catch (error) {
      console.error(`❌ Failed to refresh ${tableName} data:`, error);
      if (retryCount < 3) {
        console.log(`🔄 Retrying ${tableName} refresh in 2 seconds... (attempt ${retryCount + 1}/3)`);
        setTimeout(() => refreshDataWithRetry(retryCount + 1), 2000);
      }
    }
  };
  
  // Listen for real-time updates with enhanced logging
  socket.on(`${tableName}_created`, (data: any) => {
    console.log(`📥 New ${tableName} created from another device:`, data);
    refreshDataWithRetry();
  });

  socket.on(`${tableName}_updated`, (data: any) => {
    console.log(`📥 ${tableName} updated from another device:`, data);
    refreshDataWithRetry();
  });

  socket.on(`${tableName}_deleted`, (data: any) => {
    console.log(`📥 ${tableName} deleted from another device:`, data);
    refreshDataWithRetry();
  });

  // Initial data load
  refreshDataWithRetry();

  // Cleanup function
  return () => {
    socket.off(`${tableName}_created`);
    socket.off(`${tableName}_updated`);
    socket.off(`${tableName}_deleted`);
  };
};

// Enhanced sync status monitoring
export const useSyncStatus = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  
  useEffect(() => {
    const socket = getSocket();
    
    const handleConnect = () => {
      setIsConnected(true);
      setLastSyncTime(new Date());
      console.log('✅ Real-time sync connected');
    };
    
    const handleDisconnect = () => {
      setIsConnected(false);
      console.log('❌ Real-time sync disconnected');
    };
    
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    
    // Set initial state
    setIsConnected(socket.connected);
    if (socket.connected) {
      setLastSyncTime(new Date());
    }
    
    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
    };
  }, []);
  
  return { isConnected, lastSyncTime };
};
