// Real Firebase Authentication Service for Bhavishya Road Carrier
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  User,
  updateProfile
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db, isDemoMode } from '../config/firebase';

export interface FirebaseAuthState {
  isAuthenticated: boolean;
  user: {
    uid: string;
    email: string;
    displayName: string;
    companyName?: string;
  } | null;
  token: string | null;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  companyName: string;
  createdAt: string;
  lastLogin: string;
}

class FirebaseAuthService {
  private currentAuthState: FirebaseAuthState = {
    isAuthenticated: false,
    user: null,
    token: null
  };

  constructor() {
    // Listen for authentication state changes - runs once at app start to restore session
    console.log('🔥 Setting up persistent auth state listener');
    onAuthStateChanged(auth, async (user) => {
      console.log('🔄 Auth state changed:', user ? 'User logged in' : 'User logged out');
      
      if (user) {
        // User is logged in — fetch user data and restore session
        console.log('👤 Restoring user session for:', user.email);
        const token = await user.getIdToken();
        const userProfile = await this.getUserProfile(user.uid);
        
        this.currentAuthState = {
          isAuthenticated: true,
          user: {
            uid: user.uid,
            email: user.email || '',
            displayName: user.displayName || userProfile?.displayName || '',
            companyName: userProfile?.companyName || user.uid // Use uid as fallback companyId
          },
          token
        };
        
        // Notify app that user session is restored
        window.dispatchEvent(new CustomEvent('authStateRestored', {
          detail: this.currentAuthState
        }));
      } else {
        // User is logged out — clear session
        console.log('🚪 User logged out, clearing session');
        this.currentAuthState = {
          isAuthenticated: false,
          user: null,
          token: null
        };
        
        // Notify app that user is logged out
        window.dispatchEvent(new CustomEvent('authStateCleared'));
      }
    });
  }

  // Register new user
  async register(email: string, password: string, companyName: string): Promise<FirebaseAuthState> {
    // Force Firebase registration - bypassing demo mode check
    console.log('🔥 FORCING Firebase user registration');

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Update user profile
      await updateProfile(user, {
        displayName: companyName
      });

      // Save user profile to Firestore
      const userProfile: UserProfile = {
        uid: user.uid,
        email: user.email || '',
        displayName: companyName,
        companyName,
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString()
      };

      await setDoc(doc(db, 'users', user.uid), userProfile);

      const token = await user.getIdToken();
      
      this.currentAuthState = {
        isAuthenticated: true,
        user: {
          uid: user.uid,
          email: user.email || '',
          displayName: companyName,
          companyName
        },
        token
      };

      return this.currentAuthState;
    } catch (error: any) {
      throw new Error(error.message || 'Registration failed');
    }
  }

  // Login user
  async login(email: string, password: string): Promise<FirebaseAuthState> {
    // Force Firebase login - bypassing demo mode check
    console.log('🔥 FORCING Firebase user login');

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Update last login
      await this.updateLastLogin(user.uid);

      const userProfile = await this.getUserProfile(user.uid);
      const token = await user.getIdToken();

      this.currentAuthState = {
        isAuthenticated: true,
        user: {
          uid: user.uid,
          email: user.email || '',
          displayName: user.displayName || userProfile?.displayName || '',
          companyName: userProfile?.companyName || ''
        },
        token
      };

      return this.currentAuthState;
    } catch (error: any) {
      throw new Error(error.message || 'Login failed');
    }
  }

  // Logout user
  async logout(): Promise<void> {
    // Force Firebase logout - bypassing demo mode check
    console.log('🔥 FORCING Firebase user logout');

    try {
      await signOut(auth);
      this.currentAuthState = {
        isAuthenticated: false,
        user: null,
        token: null
      };
    } catch (error: any) {
      throw new Error(error.message || 'Logout failed');
    }
  }

  // Get current authentication state
  getCurrentAuth(): FirebaseAuthState {
    return this.currentAuthState;
  }

  // Get user profile from Firestore
  private async getUserProfile(uid: string): Promise<UserProfile | null> {
    try {
      const userDoc = await getDoc(doc(db, 'users', uid));
      if (userDoc.exists()) {
        return userDoc.data() as UserProfile;
      }
      return null;
    } catch (error) {
      console.error('Error fetching user profile:', error);
      return null;
    }
  }

  // Update last login timestamp
  private async updateLastLogin(uid: string): Promise<void> {
    try {
      await setDoc(doc(db, 'users', uid), {
        lastLogin: new Date().toISOString()
      }, { merge: true });
    } catch (error) {
      console.error('Error updating last login:', error);
    }
  }

  // Check if user is authenticated
  isAuthenticated(): boolean {
    return this.currentAuthState.isAuthenticated;
  }

  // Get current user
  getCurrentUser(): FirebaseAuthState['user'] {
    return this.currentAuthState.user;
  }

  // Get current token
  getCurrentToken(): string | null {
    return this.currentAuthState.token;
  }
}

export const firebaseAuthService = new FirebaseAuthService();
export default firebaseAuthService;
