// Quick migration utility to replace localStorage with backend API calls
import { apiService } from '../services/apiService';

// Override localStorage methods to use backend API
const originalSetItem = localStorage.setItem;
const originalGetItem = localStorage.getItem;

// Map localStorage keys to backend endpoints
const keyToEndpoint: { [key: string]: string } = {
  'loadingSlips': 'loading_slips',
  'memos': 'memos',
  'bills': 'bills',
  'parties': 'parties',
  'suppliers': 'suppliers',
  'bankEntries': 'bank_entries',
  'counters': 'counters'
};

// Cache for quick access
const cache: { [key: string]: any } = {};

// Override localStorage.setItem to sync with backend
localStorage.setItem = function(key: string, value: string) {
  // Call original localStorage first for immediate UI updates
  originalSetItem.call(this, key, value);
  
  // Sync with backend if it's a tracked key
  const endpoint = keyToEndpoint[key];
  if (endpoint) {
    // Use setTimeout to make this async without blocking
    setTimeout(async () => {
      try {
        const data = JSON.parse(value);
        cache[key] = data;
        
        console.log(`🔄 Syncing ${key} to backend:`, data);
        
        // For arrays, sync each item properly
        if (Array.isArray(data)) {
          for (const item of data) {
            if (item.id) {
              try {
                // Try to update first, if fails then create
                await apiService.update(endpoint, item.id, item);
                console.log(`✅ Updated ${endpoint}:`, item.id);
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
        } else {
          // For single objects like counters
          for (const id of Object.keys(data)) {
            try {
              await apiService.update('counters', id, { value: data[id] });
              console.log(`✅ Updated counter ${id}:`, data[id]);
            } catch (error) {
              try {
                await apiService.create('counters', { id, value: data[id] });
                console.log(`✅ Created counter ${id}:`, data[id]);
              } catch (createError) {
                console.error(`❌ Failed to sync counter ${id}:`, createError);
              }
            }
          }
        }
      } catch (error) {
        console.error('Error syncing to backend:', error);
      }
    }, 0);
  }
};

// Override localStorage.getItem to fetch from backend if not in cache
localStorage.getItem = function(key: string) {
  const endpoint = keyToEndpoint[key];
  
  if (endpoint && !cache[key]) {
    // Fetch from backend asynchronously and update localStorage
    apiService.getAll(endpoint).then(data => {
      const jsonData = JSON.stringify(data);
      originalSetItem.call(localStorage, key, jsonData);
      cache[key] = data;
      
      // Trigger a storage event to update components
      window.dispatchEvent(new StorageEvent('storage', {
        key,
        newValue: jsonData,
        storageArea: localStorage
      }));
    }).catch(error => {
      console.error(`Error fetching ${endpoint} from backend:`, error);
    });
  }
  
  // Return from original localStorage for immediate response
  return originalGetItem.call(this, key);
};

// Initialize data from backend
export const initializeBackendSync = async () => {
  console.log('🔄 Initializing backend sync...');
  
  try {
    // Fetch all data from backend and populate localStorage
    for (const [key, endpoint] of Object.entries(keyToEndpoint)) {
      try {
        const data = await apiService.getAll(endpoint);
        const jsonData = JSON.stringify(data);
        originalSetItem.call(localStorage, key, jsonData);
        cache[key] = data;
        console.log(`✅ Synced ${key}: ${data.length} items`);
      } catch (error) {
        console.error(`❌ Error syncing ${key}:`, error);
      }
    }
    
    console.log('✅ Backend sync initialized successfully!');
    
    // Trigger storage events to update all components
    Object.keys(keyToEndpoint).forEach(key => {
      window.dispatchEvent(new StorageEvent('storage', {
        key,
        newValue: localStorage.getItem(key),
        storageArea: localStorage
      }));
    });
    
  } catch (error) {
    console.error('❌ Failed to initialize backend sync:', error);
  }
};

// Real-time sync setup
export const setupRealTimeSync = () => {
  console.log('🔄 Setting up real-time sync listeners...');
  
  const { getSocket } = require('../services/apiService');
  const socket = getSocket();
  
  // Map backend table names to localStorage keys
  const endpointToKey: { [key: string]: string } = {
    'loading_slips': 'loadingSlips',
    'memos': 'memos',
    'bills': 'bills',
    'parties': 'parties',
    'suppliers': 'suppliers',
    'bank_entries': 'bankEntries'
  };
  
  // Listen for data updates from other devices
  Object.entries(endpointToKey).forEach(([endpoint, localKey]) => {
    socket.on(`${endpoint}_created`, (data: any) => {
      console.log(`📥 Received ${endpoint} created:`, data);
      updateLocalStorageFromBackend(localKey, endpoint);
    });
    
    socket.on(`${endpoint}_updated`, (data: any) => {
      console.log(`📥 Received ${endpoint} updated:`, data);
      updateLocalStorageFromBackend(localKey, endpoint);
    });
    
    socket.on(`${endpoint}_deleted`, (data: any) => {
      console.log(`📥 Received ${endpoint} deleted:`, data);
      updateLocalStorageFromBackend(localKey, endpoint);
    });
  });
  
  console.log('✅ Real-time sync listeners active!');
};

// Update localStorage from backend data
async function updateLocalStorageFromBackend(localKey: string, endpoint: string) {
  try {
    const { apiService } = require('../services/apiService');
    const data = await apiService.getAll(endpoint);
    const jsonData = JSON.stringify(data);
    
    // Update localStorage and cache
    originalSetItem.call(localStorage, localKey, jsonData);
    cache[localKey] = data;
    
    // Trigger storage event to update UI
    window.dispatchEvent(new StorageEvent('storage', {
      key: localKey,
      newValue: jsonData,
      storageArea: localStorage
    }));
    
    console.log(`✅ Updated ${localKey} from backend: ${data.length} items`);
  } catch (error) {
    console.error(`❌ Failed to update ${localKey} from backend:`, error);
  }
}
