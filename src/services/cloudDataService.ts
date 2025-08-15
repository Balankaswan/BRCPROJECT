// Cloud data synchronization service
import { authService } from './authService';

export interface CloudData {
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
}

class CloudDataService {
  private syncInterval: NodeJS.Timeout | null = null;

  // Initialize cloud sync
  async initializeSync(): Promise<void> {
    const auth = authService.getCurrentAuth();
    if (!auth.isAuthenticated) {
      return;
    }

    // Start periodic sync every 5 minutes (reduced frequency to prevent auto-reload)
    this.syncInterval = setInterval(() => {
      this.syncToCloud();
    }, 300000); // 5 minutes instead of 30 seconds

    // Initial sync
    await this.syncFromCloud();
  }

  // Stop cloud sync
  stopSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  // Sync local data to cloud
  async syncToCloud(): Promise<void> {
    try {
      const auth = authService.getCurrentAuth();
      if (!auth.isAuthenticated) {
        return;
      }

      // Collect all local data
      const cloudData: CloudData = {
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
        lastUpdated: new Date().toISOString()
      };

      // Save to cloud storage (implement your preferred cloud service)
      await this.saveToCloud(auth.token!, cloudData);
      
      console.log('Data synced to cloud successfully');
    } catch (error) {
      console.error('Failed to sync to cloud:', error);
    }
  }

  // Sync cloud data to local
  async syncFromCloud(): Promise<void> {
    try {
      const auth = authService.getCurrentAuth();
      if (!auth.isAuthenticated) {
        return;
      }

      // Get data from cloud
      const cloudData = await this.loadFromCloud(auth.token!);
      
      if (cloudData) {
        // Update local storage with cloud data
        localStorage.setItem('bills', JSON.stringify(cloudData.bills));
        localStorage.setItem('memos', JSON.stringify(cloudData.memos));
        localStorage.setItem('loadingSlips', JSON.stringify(cloudData.loadingSlips));
        localStorage.setItem('parties', JSON.stringify(cloudData.parties));
        localStorage.setItem('suppliers', JSON.stringify(cloudData.suppliers));
        localStorage.setItem('bankEntries', JSON.stringify(cloudData.bankEntries));
        localStorage.setItem('receivedBills', JSON.stringify(cloudData.receivedBills));
        localStorage.setItem('paidMemos', JSON.stringify(cloudData.paidMemos));
        localStorage.setItem('pods', JSON.stringify(cloudData.pods));
        localStorage.setItem('counters', JSON.stringify(cloudData.counters));

        console.log('Data synced from cloud successfully');
        
        // Note: Removed automatic page reload to prevent interrupting user workflow
        // Components will update automatically via localStorage changes
      }
    } catch (error) {
      console.error('Failed to sync from cloud:', error);
    }
  }

  // Force immediate sync
  async forcSync(): Promise<void> {
    await this.syncToCloud();
    await this.syncFromCloud();
  }

  // Private methods for cloud storage implementation
  private async saveToCloud(token: string, data: CloudData): Promise<void> {
    // Implement your cloud storage solution here
    // Options: Firebase, Supabase, AWS S3, Google Drive API, etc.
    
    // For demo purposes, we'll use localStorage with a cloud prefix
    const cloudKey = `cloud_data_${token}`;
    localStorage.setItem(cloudKey, JSON.stringify(data));
    
    // In a real implementation, you would send this to your cloud service:
    /*
    const response = await fetch('your-cloud-api-endpoint', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      throw new Error('Failed to save to cloud');
    }
    */
  }

  private async loadFromCloud(token: string): Promise<CloudData | null> {
    // Implement your cloud storage solution here
    
    // For demo purposes, we'll use localStorage with a cloud prefix
    const cloudKey = `cloud_data_${token}`;
    const stored = localStorage.getItem(cloudKey);
    
    if (stored) {
      return JSON.parse(stored);
    }
    
    return null;
    
    // In a real implementation, you would fetch from your cloud service:
    /*
    const response = await fetch('your-cloud-api-endpoint', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (response.ok) {
      return await response.json();
    }
    
    return null;
    */
  }
}

export const cloudDataService = new CloudDataService();
