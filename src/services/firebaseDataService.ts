// Real Firebase Data Service for Bhavishya Road Carrier
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage, isDemoMode } from '../config/firebase';
import { firebaseAuthService } from './firebaseAuthService';

// Data types for cloud storage
export interface CloudBusinessData {
  bills: any[];
  memos: any[];
  loadingSlips: any[];
  parties: any[];
  suppliers: any[];
  bankEntries: any[];
  receivedBills: any[];
  paidMemos: any[];
  pods: any[];
  counters: any;
  lastUpdated: string;
  userId: string;
  localUpdateId?: string; // Track which device made the last update
}

class FirebaseDataService {
  private syncInterval: NodeJS.Timeout | null = null;
  private unsubscribers: (() => void)[] = [];

  // Initialize real-time sync
  async initializeSync(): Promise<void> {
    // Force Firebase sync - we have real credentials deployed
    console.log('🔥 FORCING Firebase sync initialization - bypassing demo mode check');

    const auth = firebaseAuthService.getCurrentAuth();
    if (!auth.isAuthenticated || !auth.user) {
      console.log('❌ Cannot initialize sync - user not authenticated');
      return;
    }

    console.log('🚀 Initializing Firebase cloud sync for user:', auth.user.email);

    // Set up real-time listeners for data changes
    this.setupRealtimeListeners(auth.user.uid);

    // Start periodic backup sync every 2 minutes for better responsiveness
    this.syncInterval = setInterval(() => {
      console.log('⏰ Periodic sync triggered');
      this.syncToCloud();
    }, 120000); // 2 minutes

    // Initial sync from cloud
    console.log('📥 Performing initial sync from cloud');
    await this.syncFromCloud();

    // Set up localStorage change listeners for immediate sync
    this.setupLocalStorageListeners();
  }

  // Stop sync and cleanup listeners
  stopSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }

    // Unsubscribe from all real-time listeners
    this.unsubscribers.forEach(unsubscribe => unsubscribe());
    this.unsubscribers = [];
  }

  // Sync local data to Firebase
  async syncToCloud(): Promise<void> {
    // Force Firebase sync - bypassing demo mode check
    console.log('🔄 FORCING syncToCloud - Firebase credentials are configured');

    try {
      const auth = firebaseAuthService.getCurrentAuth();
      if (!auth.isAuthenticated || !auth.user) {
        console.log('User not authenticated, skipping sync');
        return;
      }

      // Collect all local data
      const cloudData: CloudBusinessData = {
        bills: JSON.parse(localStorage.getItem('bills') || '[]'),
        memos: JSON.parse(localStorage.getItem('memos') || '[]'),
        loadingSlips: JSON.parse(localStorage.getItem('loadingSlips') || '[]'),
        parties: JSON.parse(localStorage.getItem('parties') || '[]'),
        suppliers: JSON.parse(localStorage.getItem('suppliers') || '[]'),
        bankEntries: JSON.parse(localStorage.getItem('bankEntries') || '[]'),
        receivedBills: JSON.parse(localStorage.getItem('receivedBills') || '[]'),
        paidMemos: JSON.parse(localStorage.getItem('paidMemos') || '[]'),
        pods: JSON.parse(localStorage.getItem('pods') || '[]'),
        counters: JSON.parse(localStorage.getItem('counters') || '{}'),
        lastUpdated: new Date().toISOString(),
        userId: auth.user.uid
      };

      // Mark this as a local update to prevent sync loops
      const updateTimestamp = Date.now().toString();
      localStorage.setItem('lastLocalUpdate', updateTimestamp);

      // Save to Firestore
      await setDoc(doc(db, 'businessData', auth.user.uid), {
        ...cloudData,
        lastUpdated: serverTimestamp(),
        localUpdateId: updateTimestamp
      });

      console.log('✅ Data synced to Firebase successfully');
      console.log('📊 Synced data counts:', {
        bills: cloudData.bills.length,
        memos: cloudData.memos.length,
        parties: cloudData.parties.length,
        suppliers: cloudData.suppliers.length
      });
    } catch (error) {
      console.error('❌ Failed to sync to Firebase:', error);
    }
  }

  // Sync data from Firebase to local storage
  async syncFromCloud(): Promise<void> {
    // Force Firebase sync - bypassing demo mode check
    console.log('📥 FORCING syncFromCloud - Firebase credentials are configured');

    try {
      const auth = firebaseAuthService.getCurrentAuth();
      if (!auth.isAuthenticated || !auth.user) {
        console.log('User not authenticated, skipping sync from cloud');
        return;
      }

      console.log('📥 Syncing data from Firebase cloud for user:', auth.user.email);
      const docRef = doc(db, 'businessData', auth.user.uid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const cloudData = docSnap.data() as CloudBusinessData;
        console.log('☁️ Found cloud data, updating local storage');
        console.log('📊 Cloud data counts:', {
          bills: cloudData.bills?.length || 0,
          memos: cloudData.memos?.length || 0,
          parties: cloudData.parties?.length || 0,
          suppliers: cloudData.suppliers?.length || 0
        });

        // Update local storage with cloud data
        localStorage.setItem('bills', JSON.stringify(cloudData.bills || []));
        localStorage.setItem('memos', JSON.stringify(cloudData.memos || []));
        localStorage.setItem('loadingSlips', JSON.stringify(cloudData.loadingSlips || []));
        localStorage.setItem('parties', JSON.stringify(cloudData.parties || []));
        localStorage.setItem('suppliers', JSON.stringify(cloudData.suppliers || []));
        localStorage.setItem('bankEntries', JSON.stringify(cloudData.bankEntries || []));
        localStorage.setItem('receivedBills', JSON.stringify(cloudData.receivedBills || []));
        localStorage.setItem('paidMemos', JSON.stringify(cloudData.paidMemos || []));
        localStorage.setItem('pods', JSON.stringify(cloudData.pods || []));
        localStorage.setItem('counters', JSON.stringify(cloudData.counters || {}));

        console.log('✅ Data synced from Firebase successfully');
      } else {
        console.log('📭 No cloud data found, uploading local data to cloud');
        // If no cloud data exists, sync current local data to cloud
        await this.syncToCloud();
      }
    } catch (error) {
      console.error('❌ Failed to sync from Firebase:', error);
    }
  }

  // Set up real-time listeners for data changes
  private setupRealtimeListeners(userId: string): void {
    // Force Firebase real-time listeners - bypassing demo mode check
    console.log('🔄 FORCING Firebase real-time listeners setup');

    console.log('🔄 Setting up Firebase real-time listeners for user:', userId);

    // Listen for changes to business data
    const businessDataRef = doc(db, 'businessData', userId);
    const unsubscribe = onSnapshot(businessDataRef, (doc) => {
      if (doc.exists()) {
        const cloudData = doc.data() as CloudBusinessData;
        
        // Only update if the change came from another device
        const lastLocalUpdate = localStorage.getItem('lastLocalUpdate');
        const cloudUpdateId = cloudData.localUpdateId;
        
        console.log('📡 Firebase data change detected');
        console.log('🔍 Local update ID:', lastLocalUpdate);
        console.log('🔍 Cloud update ID:', cloudUpdateId);
        
        // If the cloud update ID is different from our last local update, it means another device made changes
        if (cloudUpdateId && cloudUpdateId !== lastLocalUpdate) {
          console.log('🔄 Real-time update received from another device - syncing data');
          
          // Update local storage with cloud data
          localStorage.setItem('bills', JSON.stringify(cloudData.bills || []));
          localStorage.setItem('memos', JSON.stringify(cloudData.memos || []));
          localStorage.setItem('loadingSlips', JSON.stringify(cloudData.loadingSlips || []));
          localStorage.setItem('parties', JSON.stringify(cloudData.parties || []));
          localStorage.setItem('suppliers', JSON.stringify(cloudData.suppliers || []));
          localStorage.setItem('bankEntries', JSON.stringify(cloudData.bankEntries || []));
          localStorage.setItem('receivedBills', JSON.stringify(cloudData.receivedBills || []));
          localStorage.setItem('paidMemos', JSON.stringify(cloudData.paidMemos || []));
          localStorage.setItem('pods', JSON.stringify(cloudData.pods || []));
          localStorage.setItem('counters', JSON.stringify(cloudData.counters || {}));
          
          console.log('📊 Updated local data with counts:', {
            bills: cloudData.bills?.length || 0,
            memos: cloudData.memos?.length || 0,
            parties: cloudData.parties?.length || 0,
            suppliers: cloudData.suppliers?.length || 0
          });
          
          // Dispatch custom event to notify components of data changes
          window.dispatchEvent(new CustomEvent('firebaseDataUpdate', {
            detail: { source: 'realtime', data: cloudData }
          }));
          
          // Force page reload to ensure all components update
          setTimeout(() => {
            console.log('🔄 Reloading page to reflect multi-device changes');
            window.location.reload();
          }, 1000);
        } else {
          console.log('📝 Data change from this device - no sync needed');
        }
      } else {
        console.log('📭 No cloud data found for user');
      }
    }, (error) => {
      console.error('❌ Firebase listener error:', error);
    });

    this.unsubscribers.push(unsubscribe);
  }

  // Set up localStorage change listeners for immediate sync
  private setupLocalStorageListeners(): void {
    // Force Firebase localStorage listeners - bypassing demo mode check
    console.log('🔥 FORCING Firebase localStorage listeners setup');

    console.log('👂 Setting up localStorage change listeners for immediate sync');

    // Listen for localStorage changes and trigger immediate sync
    const syncTriggerKeys = ['bills', 'memos', 'loadingSlips', 'parties', 'suppliers', 'bankEntries'];
    
    // Override localStorage setItem to trigger sync
    const originalSetItem = localStorage.setItem;
    localStorage.setItem = (key: string, value: string) => {
      originalSetItem.call(localStorage, key, value);
      
      if (syncTriggerKeys.includes(key)) {
        console.log(`📝 Data changed in ${key} - triggering immediate sync`);
        // Debounce sync calls to avoid excessive API calls
        clearTimeout((this as any).syncDebounceTimer);
        (this as any).syncDebounceTimer = setTimeout(() => {
          this.syncToCloud();
        }, 2000); // 2 second debounce
      }
    };
  }

  // Upload POD file to Firebase Storage
  async uploadPODFile(file: File, billId: string): Promise<string> {
    if (isDemoMode()) {
      // Fallback to base64 for demo mode
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
    }

    try {
      const auth = firebaseAuthService.getCurrentAuth();
      if (!auth.isAuthenticated || !auth.user) {
        throw new Error('User not authenticated');
      }

      const fileName = `${auth.user.uid}/${billId}/${file.name}`;
      const storageRef = ref(storage, `pods/${fileName}`);
      
      const snapshot = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);
      
      return downloadURL;
    } catch (error) {
      console.error('Failed to upload POD file:', error);
      throw error;
    }
  }

  // Delete POD file from Firebase Storage
  async deletePODFile(fileUrl: string): Promise<void> {
    if (isDemoMode() || fileUrl.startsWith('data:')) {
      // Skip deletion for demo mode or base64 files
      return;
    }

    try {
      const storageRef = ref(storage, fileUrl);
      await deleteObject(storageRef);
    } catch (error) {
      console.error('Failed to delete POD file:', error);
    }
  }

  // Force immediate sync
  async forceSync(): Promise<void> {
    await this.syncToCloud();
    await this.syncFromCloud();
  }

  // Get sync status
  getSyncStatus(): { isOnline: boolean; lastSync: string | null } {
    return {
      isOnline: firebaseAuthService.isAuthenticated(),
      lastSync: localStorage.getItem('lastSyncTime')
    };
  }

  // Backup all data to Firebase
  async createBackup(): Promise<void> {
    if (isDemoMode()) {
      throw new Error('Backup not available in demo mode');
    }

    const auth = firebaseAuthService.getCurrentAuth();
    if (!auth.isAuthenticated || !auth.user) {
      throw new Error('User not authenticated');
    }

    const backupData = {
      ...JSON.parse(localStorage.getItem('bills') || '[]'),
      timestamp: new Date().toISOString(),
      userId: auth.user.uid
    };

    const backupRef = doc(collection(db, 'backups'));
    await setDoc(backupRef, backupData);
    
    console.log('Backup created successfully');
  }
}

export const firebaseDataService = new FirebaseDataService();
export default firebaseDataService;
