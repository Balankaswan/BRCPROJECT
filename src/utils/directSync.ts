// Direct sync solution - bypasses localStorage completely for real-time sync
import { apiService, getSocket } from '../services/apiService';

// Direct sync manager that works with backend API immediately
class DirectSyncManager {
  private socket: any;
  private isInitialized = false;

  async initialize() {
    if (this.isInitialized) return;
    
    console.log('🚀 Initializing Direct Sync Manager...');
    
    // Initialize socket connection
    this.socket = getSocket();
    
    // Setup real-time listeners
    this.setupRealTimeListeners();
    
    // Load initial data from backend
    await this.loadInitialData();
    
    this.isInitialized = true;
    console.log('✅ Direct Sync Manager initialized successfully!');
  }

  private setupRealTimeListeners() {
    const tables = ['loading_slips', 'memos', 'bills', 'parties', 'suppliers', 'bank_entries'];
    
    // Enhanced connection logging
    this.socket.on('connect', () => {
      console.log('🔌 Socket.io connected to server for real-time sync');
    });
    
    this.socket.on('disconnect', () => {
      console.log('❌ Socket.io disconnected from server');
    });
    
    tables.forEach(table => {
      this.socket.on(`${table}_created`, (data: any) => {
        console.log(`📥 Cross-device sync: ${table} created from another device`, data);
        this.triggerUIUpdate(table);
      });
      
      this.socket.on(`${table}_updated`, (data: any) => {
        console.log(`📥 Cross-device sync: ${table} updated from another device`, data);
        this.triggerUIUpdate(table);
      });
      
      this.socket.on(`${table}_deleted`, (data: any) => {
        console.log(`📥 Cross-device sync: ${table} deleted from another device`, data);
        this.triggerUIUpdate(table);
      });
    });
    
    console.log('✅ Real-time listeners set up for cross-device sync');
  }

  private async loadInitialData() {
    const keyMappings = {
      'loading_slips': 'loadingSlips',
      'memos': 'memos', 
      'bills': 'bills',
      'parties': 'parties',
      'suppliers': 'suppliers',
      'bank_entries': 'bankEntries',
      'counters': 'counters'
    };

    for (const [endpoint, localKey] of Object.entries(keyMappings)) {
      try {
        const data = await apiService.getAll(endpoint);
        localStorage.setItem(localKey, JSON.stringify(data));
        console.log(`✅ Loaded ${localKey}: ${data.length} items`);
      } catch (error) {
        console.error(`❌ Failed to load ${localKey}:`, error);
      }
    }
  }

  private triggerUIUpdate(table: string) {
    const keyMappings: { [key: string]: string } = {
      'loading_slips': 'loadingSlips',
      'memos': 'memos',
      'bills': 'bills', 
      'parties': 'parties',
      'suppliers': 'suppliers',
      'bank_entries': 'bankEntries'
    };

    const localKey = keyMappings[table];
    if (localKey) {
      // Fetch fresh data and update localStorage
      apiService.getAll(table).then(data => {
        localStorage.setItem(localKey, JSON.stringify(data));
        
        // Trigger storage event to update UI
        window.dispatchEvent(new StorageEvent('storage', {
          key: localKey,
          newValue: JSON.stringify(data),
          storageArea: localStorage
        }));
      }).catch(error => {
        console.error(`❌ Failed to update ${localKey}:`, error);
      });
    }
  }

  // Direct sync methods for immediate backend sync
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
    if (!endpoint) return;

    console.log(`🔄 Direct sync ${key} to backend:`, data.length, 'items');

    // Sync each item to backend
    for (const item of data) {
      if (item.id) {
        try {
          await apiService.update(endpoint, item.id, item);
          console.log(`✅ Synced ${endpoint}:`, item.id);
        } catch (error) {
          try {
            await apiService.create(endpoint, item);
            console.log(`✅ Created ${endpoint}:`, item.id);
          } catch (createError) {
            console.error(`❌ Failed to sync ${endpoint}:`, createError);
          }
        }
      }
    }
  }
}

// Global instance
export const directSyncManager = new DirectSyncManager();

// Override localStorage.setItem for immediate sync
const originalSetItem = localStorage.setItem;
localStorage.setItem = function(key: string, value: string) {
  // Call original first
  originalSetItem.call(this, key, value);
  
  // Immediate backend sync for tracked keys
  const trackedKeys = ['loadingSlips', 'memos', 'bills', 'parties', 'suppliers', 'bankEntries'];
  if (trackedKeys.includes(key)) {
    console.log(`🔄 localStorage updated for ${key}, triggering backend sync...`);
    try {
      const data = JSON.parse(value);
      if (Array.isArray(data)) {
        // Immediate sync without delay for cross-device updates
        directSyncManager.syncToBackend(key, data).then(() => {
          console.log(`✅ Successfully synced ${key} to backend for cross-device access`);
        }).catch(error => {
          console.error(`❌ Failed to sync ${key} to backend:`, error);
        });
      }
    } catch (error) {
      console.error('Error in direct sync:', error);
    }
  }
};

export default directSyncManager;
