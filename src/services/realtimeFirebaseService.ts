import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
  orderBy,
  QuerySnapshot,
  writeBatch,
  Timestamp,
  Unsubscribe
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { firebaseAuthService } from './firebaseAuthService';

// Types for real-time sync
export interface SyncEntity {
  id: string;
  companyId: string;
  userId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  [key: string]: any;
}

export interface SyncOperation {
  type: 'create' | 'update' | 'delete';
  collection: string;
  docId: string;
  data?: any;
  linkedUpdates?: Array<{
    collection: string;
    docId: string;
    data: any;
  }>;
}

export interface RealtimeListener {
  unsubscribe: Unsubscribe;
  collection: string;
  callback: (data: any[]) => void;
}

class RealtimeFirebaseService {
  private listeners: Map<string, RealtimeListener> = new Map();
  private offlineQueue: SyncOperation[] = [];
  private isOnline: boolean = navigator.onLine;
  private currentCompanyId: string | null = null;
  private currentUserId: string | null = null;

  constructor() {
    // Listen for online/offline events
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.processOfflineQueue();
    });
    
    window.addEventListener('offline', () => {
      this.isOnline = false;
    });

    // Initialize with current auth state
    this.updateAuthState();
  }

  // Update authentication state
  private updateAuthState(): void {
    const authState = firebaseAuthService.getCurrentAuth();
    if (authState.isAuthenticated && authState.user) {
      this.currentUserId = authState.user.uid;
      this.currentCompanyId = authState.user.companyName || authState.user.uid; // Use companyName or fallback to uid
      console.log('🔥 Real-time sync initialized for:', {
        userId: this.currentUserId,
        companyId: this.currentCompanyId
      });
    } else {
      this.currentUserId = null;
      this.currentCompanyId = null;
      this.cleanup();
    }
  }

  // Set up real-time listener for a collection
  setupRealtimeListener(
    collectionName: string,
    callback: (data: any[]) => void,
    orderByField: string = 'createdAt'
  ): void {
    if (!this.currentUserId) {
      console.error('❌ Cannot setup listener: User not authenticated');
      return;
    }

    // Clean up existing listener for this collection
    this.removeListener(collectionName);

    console.log(`🔄 Setting up real-time listener for ${collectionName} filtered by userId: ${this.currentUserId}`);

    const collectionRef = collection(db, collectionName);
    // Filter by userId to ensure each user sees only their own data
    const q = query(
      collectionRef,
      where('userId', '==', this.currentUserId),
      orderBy(orderByField, 'desc')
    );

    const unsubscribe = onSnapshot(q, 
      (snapshot: QuerySnapshot) => {
        console.log(`📡 Real-time update received for ${collectionName}:`, snapshot.size, 'documents');
        
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        // Update localStorage immediately for UI responsiveness
        localStorage.setItem(this.getLocalStorageKey(collectionName), JSON.stringify(data));
        
        // Call the callback to update UI
        callback(data);
      },
      (error) => {
        console.error(`❌ Real-time listener error for ${collectionName}:`, error);
      }
    );

    // Store the listener
    this.listeners.set(collectionName, {
      unsubscribe,
      collection: collectionName,
      callback
    });
  }

  // Create document with real-time sync
  async createDocument(
    collectionName: string,
    data: any,
    linkedUpdates?: Array<{ collection: string; docId: string; data: any }>
  ): Promise<string> {
    if (!this.currentCompanyId || !this.currentUserId) {
      throw new Error('User not authenticated');
    }

    const operation: SyncOperation = {
      type: 'create',
      collection: collectionName,
      docId: '', // Will be set after creation
      data: {
        ...data,
        companyId: this.currentCompanyId,
        userId: this.currentUserId,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      },
      linkedUpdates
    };

    if (!this.isOnline) {
      console.log('📴 Offline: Queuing create operation');
      this.offlineQueue.push(operation);
      return this.createLocalDocument(collectionName, operation.data);
    }

    return this.executeCreateOperation(operation);
  }

  // Update document with real-time sync
  async updateDocument(
    collectionName: string,
    docId: string,
    data: any,
    linkedUpdates?: Array<{ collection: string; docId: string; data: any }>
  ): Promise<void> {
    if (!this.currentCompanyId || !this.currentUserId) {
      throw new Error('User not authenticated');
    }

    const operation: SyncOperation = {
      type: 'update',
      collection: collectionName,
      docId,
      data: {
        ...data,
        updatedAt: Timestamp.now()
      },
      linkedUpdates
    };

    if (!this.isOnline) {
      console.log('📴 Offline: Queuing update operation');
      this.offlineQueue.push(operation);
      this.updateLocalDocument(collectionName, docId, operation.data);
      return;
    }

    return this.executeUpdateOperation(operation);
  }

  // Delete document with cascade logic
  async deleteDocument(
    collectionName: string,
    docId: string,
    cascadeUpdates?: Array<{ collection: string; docId: string; data: any }>
  ): Promise<void> {
    if (!this.currentCompanyId || !this.currentUserId) {
      throw new Error('User not authenticated');
    }

    const operation: SyncOperation = {
      type: 'delete',
      collection: collectionName,
      docId,
      linkedUpdates: cascadeUpdates
    };

    if (!this.isOnline) {
      console.log('📴 Offline: Queuing delete operation');
      this.offlineQueue.push(operation);
      this.deleteLocalDocument(collectionName, docId);
      return;
    }

    return this.executeDeleteOperation(operation);
  }

  // Execute create operation
  private async executeCreateOperation(operation: SyncOperation): Promise<string> {
    console.log(`🔥 Creating document in ${operation.collection}`);
    
    const batch = writeBatch(db);
    
    // Create main document
    const docRef = doc(collection(db, operation.collection));
    batch.set(docRef, operation.data);
    
    // Handle linked updates
    if (operation.linkedUpdates) {
      for (const update of operation.linkedUpdates) {
        const linkedDocRef = doc(db, update.collection, update.docId);
        batch.update(linkedDocRef, {
          ...update.data,
          updatedAt: Timestamp.now()
        });
      }
    }
    
    await batch.commit();
    console.log(`✅ Document created successfully: ${docRef.id}`);
    return docRef.id;
  }

  // Execute update operation
  private async executeUpdateOperation(operation: SyncOperation): Promise<void> {
    console.log(`🔥 Updating document ${operation.docId} in ${operation.collection}`);
    
    const batch = writeBatch(db);
    
    // Update main document
    const docRef = doc(db, operation.collection, operation.docId);
    batch.update(docRef, operation.data);
    
    // Handle linked updates
    if (operation.linkedUpdates) {
      for (const update of operation.linkedUpdates) {
        const linkedDocRef = doc(db, update.collection, update.docId);
        batch.update(linkedDocRef, {
          ...update.data,
          updatedAt: Timestamp.now()
        });
      }
    }
    
    await batch.commit();
    console.log(`✅ Document updated successfully: ${operation.docId}`);
  }

  // Execute delete operation
  private async executeDeleteOperation(operation: SyncOperation): Promise<void> {
    console.log(`🔥 Deleting document ${operation.docId} from ${operation.collection}`);
    
    const batch = writeBatch(db);
    
    // Delete main document
    const docRef = doc(db, operation.collection, operation.docId);
    batch.delete(docRef);
    
    // Handle cascade updates (restore balances, remove ledger entries, etc.)
    if (operation.linkedUpdates) {
      for (const update of operation.linkedUpdates) {
        const linkedDocRef = doc(db, update.collection, update.docId);
        batch.update(linkedDocRef, {
          ...update.data,
          updatedAt: Timestamp.now()
        });
      }
    }
    
    await batch.commit();
    console.log(`✅ Document deleted successfully: ${operation.docId}`);
  }

  // Process offline queue when back online
  private async processOfflineQueue(): Promise<void> {
    if (this.offlineQueue.length === 0) return;
    
    console.log(`🔄 Processing ${this.offlineQueue.length} offline operations`);
    
    const operations = [...this.offlineQueue];
    this.offlineQueue = [];
    
    for (const operation of operations) {
      try {
        switch (operation.type) {
          case 'create':
            await this.executeCreateOperation(operation);
            break;
          case 'update':
            await this.executeUpdateOperation(operation);
            break;
          case 'delete':
            await this.executeDeleteOperation(operation);
            break;
        }
      } catch (error) {
        console.error(`❌ Failed to sync offline operation:`, error);
        // Re-queue failed operations
        this.offlineQueue.push(operation);
      }
    }
    
    console.log(`✅ Offline queue processed`);
  }

  // Local storage operations for offline support
  private createLocalDocument(collectionName: string, data: any): string {
    const localId = `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const localData = { ...data, id: localId, _isLocal: true };
    
    const existing = this.getLocalData(collectionName);
    existing.unshift(localData);
    localStorage.setItem(this.getLocalStorageKey(collectionName), JSON.stringify(existing));
    
    return localId;
  }

  private updateLocalDocument(collectionName: string, docId: string, data: any): void {
    const existing = this.getLocalData(collectionName);
    const index = existing.findIndex(item => item.id === docId);
    
    if (index !== -1) {
      existing[index] = { ...existing[index], ...data };
      localStorage.setItem(this.getLocalStorageKey(collectionName), JSON.stringify(existing));
    }
  }

  private deleteLocalDocument(collectionName: string, docId: string): void {
    const existing = this.getLocalData(collectionName);
    const filtered = existing.filter(item => item.id !== docId);
    localStorage.setItem(this.getLocalStorageKey(collectionName), JSON.stringify(filtered));
  }

  private getLocalData(collectionName: string): any[] {
    const key = this.getLocalStorageKey(collectionName);
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  }

  private getLocalStorageKey(collectionName: string): string {
    // Map Firestore collection names to localStorage keys
    const keyMap: { [key: string]: string } = {
      'loading_slips': 'loadingSlips',
      'memos': 'memos',
      'bills': 'bills',
      'bank_transactions': 'bankEntries',
      'cashbook_transactions': 'cashbookEntries',
      'parties': 'parties',
      'suppliers': 'suppliers',
      'party_ledger': 'partyLedger',
      'supplier_ledger': 'supplierLedger'
    };
    
    return keyMap[collectionName] || collectionName;
  }

  // Remove specific listener
  removeListener(collectionName: string): void {
    const listener = this.listeners.get(collectionName);
    if (listener) {
      listener.unsubscribe();
      this.listeners.delete(collectionName);
      console.log(`🔇 Removed listener for ${collectionName}`);
    }
  }

  // Clean up all listeners
  cleanup(): void {
    console.log('🧹 Cleaning up all real-time listeners');
    this.listeners.forEach(listener => listener.unsubscribe());
    this.listeners.clear();
    this.offlineQueue = [];
  }

  // Get sync status
  getSyncStatus(): { isOnline: boolean; queuedOperations: number; activeListeners: string[] } {
    return {
      isOnline: this.isOnline,
      queuedOperations: this.offlineQueue.length,
      activeListeners: Array.from(this.listeners.keys())
    };
  }

  // Initialize all listeners for the app
  initializeAllListeners(callbacks: { [collection: string]: (data: any[]) => void }): void {
    console.log('🚀 Initializing all real-time listeners');
    this.updateAuthState();
    
    if (!this.currentCompanyId) {
      console.error('❌ Cannot initialize listeners: User not authenticated');
      return;
    }

    // Set up listeners for all collections
    Object.entries(callbacks).forEach(([collection, callback]) => {
      this.setupRealtimeListener(collection, callback);
    });
  }
}

// Export singleton instance
export const realtimeFirebaseService = new RealtimeFirebaseService();
