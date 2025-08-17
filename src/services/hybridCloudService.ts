// Hybrid Cloud Service - Backend-only (Render + MongoDB) with optional demo fallback
import { authService as demoAuthService, AuthState as DemoAuthState } from './authService';
import { cloudDataService as demoCloudService } from './cloudDataService';
import { apiService } from './apiService';

// Unified auth state interface
export interface UnifiedAuthState {
  isAuthenticated: boolean;
  user: {
    uid?: string;
    email?: string;
    displayName?: string;
    companyName?: string;
    username?: string; // For demo mode compatibility
  } | null;
  token: string | null;
  mode: 'demo' | 'backend';
}

class HybridCloudService {
  private currentMode: 'demo' | 'backend' = 'backend';

  constructor() {
    // Default to backend mode (Render + MongoDB). Demo remains for fallback only.
    this.currentMode = 'backend';
    console.log(`🚀 Cloud service set to Backend mode (Render + MongoDB)`);
  }

  // Authentication methods
  async login(emailOrUsername: string, password: string): Promise<UnifiedAuthState> {
    // Using demoAuthService for simple local auth (no Firebase). Replace with backend auth if available.
    const demoAuth = await demoAuthService.login(emailOrUsername, password);
    return this.convertDemoAuth(demoAuth);
  }

  async register(emailOrUsername: string, password: string, companyName: string): Promise<UnifiedAuthState> {
    const demoAuth = await demoAuthService.register(emailOrUsername, password, companyName);
    return this.convertDemoAuth(demoAuth);
  }

  async logout(): Promise<void> {
    await demoAuthService.logout();
    demoCloudService.stopSync();
  }

  getCurrentAuth(): UnifiedAuthState {
    const demoAuth = demoAuthService.getCurrentAuth();
    return this.convertDemoAuth(demoAuth);
  }

  // Data sync methods
  async initializeSync(): Promise<void> {
    if (this.currentMode === 'backend') {
      // Prime localStorage from backend on app start
      await this.syncFromCloud();
    } else {
      await demoCloudService.initializeSync();
    }
  }

  async syncToCloud(): Promise<void> {
    if (this.currentMode === 'backend') {
      // Push local entities to backend using helper mapping
      const keys = ['loadingSlips','memos','bills','parties','suppliers','bankEntries'];
      for (const key of keys) {
        const data = JSON.parse(localStorage.getItem(key) || '[]');
        await apiService.syncToBackend(key, data);
      }
      localStorage.setItem('lastSyncTime', new Date().toISOString());
    } else {
      await demoCloudService.syncToCloud();
    }
  }

  async syncFromCloud(): Promise<void> {
    if (this.currentMode === 'backend') {
      // Fetch from backend and hydrate localStorage in frontend-friendly shapes
      const [ls, memos, bills, parties, suppliers, bank] = await Promise.all([
        apiService.getLoadingSlips(),
        apiService.getMemos(),
        apiService.getBills(),
        apiService.getParties(),
        apiService.getSuppliers(),
        apiService.getBankEntries()
      ]);
      localStorage.setItem('loadingSlips', JSON.stringify(ls));
      localStorage.setItem('memos', JSON.stringify(memos));
      localStorage.setItem('bills', JSON.stringify(bills));
      localStorage.setItem('parties', JSON.stringify(parties));
      localStorage.setItem('suppliers', JSON.stringify(suppliers));
      localStorage.setItem('bankEntries', JSON.stringify(bank));
      localStorage.setItem('lastSyncTime', new Date().toISOString());
    } else {
      await demoCloudService.syncFromCloud();
    }
  }

  async forceSync(): Promise<void> {
    if (this.currentMode === 'backend') {
      await this.syncToCloud();
      await this.syncFromCloud();
    } else {
      await demoCloudService.forcSync();
    }
  }

  stopSync(): void {
    // No background pollers in backend mode; only demo service has interval
    demoCloudService.stopSync();
  }

  // File upload methods
  async uploadPODFile(file: File, _billId: string): Promise<string> {
    if (this.currentMode === 'backend') {
      const result = await apiService.uploadFile(file);
      // Expecting backend to return a URL
      return result.url || result.path || '';
    } else {
      // Demo mode - convert to base64
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
    }
  }

  async deletePODFile(_fileUrl: string): Promise<void> {
    // Backend endpoint for deletion not defined; no-op for now.
    return;
  }

  // Utility methods
  getSyncStatus(): { isOnline: boolean; lastSync: string | null; mode: string } {
    return {
      isOnline: true,
      lastSync: localStorage.getItem('lastSyncTime'),
      mode: this.currentMode
    };
  }

  getCurrentMode(): 'demo' | 'backend' {
    return this.currentMode;
  }

  isFirebaseMode(): boolean {
    return false;
  }

  isDemoMode(): boolean {
    return this.currentMode === 'demo';
  }

  // Backup methods (no-op without Firebase). Implement via backend if needed.
  async createBackup(): Promise<void> {
    console.warn('Backup not implemented for backend mode');
  }

  // Private helper methods
  private convertDemoAuth(demoAuth: DemoAuthState): UnifiedAuthState {
    return {
      isAuthenticated: demoAuth.isAuthenticated,
      user: demoAuth.user ? {
        username: demoAuth.user.username,
        displayName: demoAuth.user.companyName,
        companyName: demoAuth.user.companyName
      } : null,
      token: demoAuth.token,
      mode: this.currentMode
    };
  }
}

export const hybridCloudService = new HybridCloudService();
export default hybridCloudService;
