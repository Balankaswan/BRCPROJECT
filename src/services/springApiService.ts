import SockJS from 'sockjs-client';
import { Client } from '@stomp/stompjs';

// Configuration - Use Spring Boot backend on LAN IP for multi-device access
const API_BASE_URL = 'http://192.168.1.3:8081/api';
const WEBSOCKET_URL = 'http://192.168.1.3:8081/ws';

console.log('🌐 API Base URL:', API_BASE_URL);
console.log('🔌 WebSocket URL:', WEBSOCKET_URL);

// WebSocket connection for real-time sync
let stompClient: Client | null = null;

export const initializeWebSocket = () => {
  if (!stompClient) {
    stompClient = new Client({
      webSocketFactory: () => new SockJS(WEBSOCKET_URL),
      connectHeaders: {},
      debug: (str) => {
        console.log('WebSocket Debug:', str);
      },
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
    });

    stompClient.onConnect = (frame) => {
      console.log('✅ Connected to WebSocket server:', frame);
    };

    stompClient.onDisconnect = () => {
      console.log('❌ Disconnected from WebSocket server');
    };

    stompClient.onStompError = (frame) => {
      console.error('WebSocket Error:', frame.headers['message']);
      console.error('Additional details:', frame.body);
    };

    stompClient.activate();
  }
  return stompClient;
};

export const getWebSocketClient = () => {
  if (!stompClient) {
    return initializeWebSocket();
  }
  return stompClient;
};

// Spring Boot API Service
class SpringBootApiService {
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
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  // Loading Slips API - matches Spring Boot endpoints
  async getLoadingSlips() {
    return this.request('/loading-slips');
  }

  async getLoadingSlipById(id: string) {
    return this.request(`/loading-slips/${id}`);
  }

  async createLoadingSlip(data: any) {
    return this.request('/loading-slips', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateLoadingSlip(id: string, data: any) {
    return this.request(`/loading-slips/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteLoadingSlip(id: string) {
    return this.request(`/loading-slips/${id}`, {
      method: 'DELETE',
    });
  }

  async searchLoadingSlips(query: string) {
    return this.request(`/loading-slips/search?query=${encodeURIComponent(query)}`);
  }

  // Generic CRUD operations (backwards compatibility)
  async getAll(tableName: string) {
    // Map table names to Spring Boot endpoints
    const endpointMap: { [key: string]: string } = {
      'loading_slips': '/loading-slips',
      'loading-slips': '/loading-slips',
      'memos': '/memos',
      'bills': '/bills',
      'parties': '/parties',
      'suppliers': '/suppliers',
      'bank_entries': '/bank-entries',
    };

    const endpoint = endpointMap[tableName] || `/${tableName}`;
    return this.request(endpoint);
  }

  async create(tableName: string, data: any) {
    const endpointMap: { [key: string]: string } = {
      'loading_slips': '/loading-slips',
      'loading-slips': '/loading-slips',
      'memos': '/memos',
      'bills': '/bills', 
      'parties': '/parties',
      'suppliers': '/suppliers',
      'bank_entries': '/bank-entries',
    };

    const endpoint = endpointMap[tableName] || `/${tableName}`;
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async update(tableName: string, id: string, data: any) {
    const endpointMap: { [key: string]: string } = {
      'loading_slips': '/loading-slips',
      'loading-slips': '/loading-slips',
      'memos': '/memos',
      'bills': '/bills',
      'parties': '/parties', 
      'suppliers': '/suppliers',
      'bank_entries': '/bank-entries',
    };

    const endpoint = endpointMap[tableName] || `/${tableName}`;
    return this.request(`${endpoint}/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async delete(tableName: string, id: string) {
    const endpointMap: { [key: string]: string } = {
      'loading_slips': '/loading-slips',
      'loading-slips': '/loading-slips',
      'memos': '/memos',
      'bills': '/bills',
      'parties': '/parties',
      'suppliers': '/suppliers',
      'bank_entries': '/bank-entries',
    };

    const endpoint = endpointMap[tableName] || `/${tableName}`;
    return this.request(`${endpoint}/${id}`, {
      method: 'DELETE',
    });
  }

  // Health check
  async healthCheck() {
    return this.request('/health');
  }

  // File upload (if needed)
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
}

export const apiService = new SpringBootApiService();

// Real-time data synchronization using STOMP WebSocket
export const useRealTimeSync = (tableName: string, callback: (data: any[]) => void) => {
  const client = getWebSocketClient();
  
  if (client && client.connected) {
    // Subscribe to topic for the specific table
    const subscription1 = client.subscribe(`/topic/${tableName}/created`, (message) => {
      console.log(`New ${tableName} created:`, JSON.parse(message.body));
      // Refresh data
      apiService.getAll(tableName).then(callback).catch(console.error);
    });

    const subscription2 = client.subscribe(`/topic/${tableName}/updated`, (message) => {
      console.log(`${tableName} updated:`, JSON.parse(message.body));
      // Refresh data
      apiService.getAll(tableName).then(callback).catch(console.error);
    });

    const subscription3 = client.subscribe(`/topic/${tableName}/deleted`, (message) => {
      console.log(`${tableName} deleted:`, JSON.parse(message.body));
      // Refresh data
      apiService.getAll(tableName).then(callback).catch(console.error);
    });

    // Cleanup function
    return () => {
      subscription1.unsubscribe();
      subscription2.unsubscribe();
      subscription3.unsubscribe();
    };
  } else {
    console.warn('WebSocket not connected, real-time sync not available');
    return () => {};
  }
};
