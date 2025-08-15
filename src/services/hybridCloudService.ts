// Hybrid Cloud Service - Switches between Demo Mode and Firebase
import { isDemoMode, isFirebaseConfigured } from '../config/firebase';
import { authService as demoAuthService, AuthState as DemoAuthState } from './authService';
import { cloudDataService as demoCloudService } from './cloudDataService';
import { firebaseAuthService, FirebaseAuthState } from './firebaseAuthService';
import { firebaseDataService } from './firebaseDataService';

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
  mode: 'demo' | 'firebase';
}

class HybridCloudService {
  private currentMode: 'demo' | 'firebase' = 'demo';

  constructor() {
    // Force Firebase mode since we have real Firebase credentials
    this.currentMode = 'firebase';
    console.log(`🚀 Cloud service FORCED to Firebase mode for production sync`);
    console.log(`📊 Firebase configured: ${isFirebaseConfigured()}`);
    console.log(`🔑 Demo mode disabled: ${!isDemoMode()}`);
  }

  // Authentication methods
  async login(emailOrUsername: string, password: string): Promise<UnifiedAuthState> {
    if (this.currentMode === 'firebase') {
      const firebaseAuth = await firebaseAuthService.login(emailOrUsername, password);
      return this.convertFirebaseAuth(firebaseAuth);
    } else {
      const demoAuth = await demoAuthService.login(emailOrUsername, password);
      return this.convertDemoAuth(demoAuth);
    }
  }

  async register(emailOrUsername: string, password: string, companyName: string): Promise<UnifiedAuthState> {
    if (this.currentMode === 'firebase') {
      const firebaseAuth = await firebaseAuthService.register(emailOrUsername, password, companyName);
      return this.convertFirebaseAuth(firebaseAuth);
    } else {
      const demoAuth = await demoAuthService.register(emailOrUsername, password, companyName);
      return this.convertDemoAuth(demoAuth);
    }
  }

  async logout(): Promise<void> {
    if (this.currentMode === 'firebase') {
      await firebaseAuthService.logout();
      await firebaseDataService.stopSync();
    } else {
      await demoAuthService.logout();
      demoCloudService.stopSync();
    }
  }

  getCurrentAuth(): UnifiedAuthState {
    if (this.currentMode === 'firebase') {
      const firebaseAuth = firebaseAuthService.getCurrentAuth();
      return this.convertFirebaseAuth(firebaseAuth);
    } else {
      const demoAuth = demoAuthService.getCurrentAuth();
      return this.convertDemoAuth(demoAuth);
    }
  }

  // Data sync methods
  async initializeSync(): Promise<void> {
    if (this.currentMode === 'firebase') {
      await firebaseDataService.initializeSync();
    } else {
      await demoCloudService.initializeSync();
    }
  }

  async syncToCloud(): Promise<void> {
    if (this.currentMode === 'firebase') {
      await firebaseDataService.syncToCloud();
    } else {
      await demoCloudService.syncToCloud();
    }
  }

  async syncFromCloud(): Promise<void> {
    if (this.currentMode === 'firebase') {
      await firebaseDataService.syncFromCloud();
    } else {
      await demoCloudService.syncFromCloud();
    }
  }

  async forceSync(): Promise<void> {
    if (this.currentMode === 'firebase') {
      await firebaseDataService.forceSync();
    } else {
      await demoCloudService.forcSync();
    }
  }

  stopSync(): void {
    if (this.currentMode === 'firebase') {
      firebaseDataService.stopSync();
    } else {
      demoCloudService.stopSync();
    }
  }

  // File upload methods
  async uploadPODFile(file: File, billId: string): Promise<string> {
    if (this.currentMode === 'firebase') {
      return await firebaseDataService.uploadPODFile(file, billId);
    } else {
      // Demo mode - convert to base64
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
    }
  }

  async deletePODFile(fileUrl: string): Promise<void> {
    if (this.currentMode === 'firebase') {
      await firebaseDataService.deletePODFile(fileUrl);
    }
    // Demo mode - no action needed for base64 files
  }

  // Utility methods
  getSyncStatus(): { isOnline: boolean; lastSync: string | null; mode: string } {
    if (this.currentMode === 'firebase') {
      const status = firebaseDataService.getSyncStatus();
      return { ...status, mode: 'firebase' };
    } else {
      return {
        isOnline: true,
        lastSync: localStorage.getItem('lastSyncTime'),
        mode: 'demo'
      };
    }
  }

  getCurrentMode(): 'demo' | 'firebase' {
    return this.currentMode;
  }

  isFirebaseMode(): boolean {
    return this.currentMode === 'firebase';
  }

  isDemoMode(): boolean {
    return this.currentMode === 'demo';
  }

  // Backup methods (Firebase only)
  async createBackup(): Promise<void> {
    if (this.currentMode === 'firebase') {
      await firebaseDataService.createBackup();
    } else {
      throw new Error('Backup feature only available in Firebase mode');
    }
  }

  // Private helper methods
  private convertFirebaseAuth(firebaseAuth: FirebaseAuthState): UnifiedAuthState {
    return {
      isAuthenticated: firebaseAuth.isAuthenticated,
      user: firebaseAuth.user ? {
        uid: firebaseAuth.user.uid,
        email: firebaseAuth.user.email,
        displayName: firebaseAuth.user.displayName,
        companyName: firebaseAuth.user.companyName
      } : null,
      token: firebaseAuth.token,
      mode: 'firebase'
    };
  }

  private convertDemoAuth(demoAuth: DemoAuthState): UnifiedAuthState {
    return {
      isAuthenticated: demoAuth.isAuthenticated,
      user: demoAuth.user ? {
        username: demoAuth.user.username,
        displayName: demoAuth.user.companyName,
        companyName: demoAuth.user.companyName
      } : null,
      token: demoAuth.token,
      mode: 'demo'
    };
  }
}

export const hybridCloudService = new HybridCloudService();
export default hybridCloudService;
