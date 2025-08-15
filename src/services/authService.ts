// Simple authentication service for cloud data sync
export interface User {
  id: string;
  username: string;
  companyName: string;
  createdAt: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;
}

class AuthService {
  private baseUrl = 'https://api.jsonbin.io/v3'; // Free cloud storage service
  private apiKey = 'your-api-key'; // User will need to get this

  // Simple login with username/password
  async login(username: string, password: string): Promise<AuthState> {
    try {
      // For demo purposes, we'll use a simple hash-based auth
      const userHash = btoa(username + password);
      
      // Check if user exists in cloud storage
      const userData = await this.getUserData(userHash);
      
      if (userData) {
        const authState: AuthState = {
          isAuthenticated: true,
          user: userData,
          token: userHash
        };
        
        // Store auth state locally
        localStorage.setItem('auth_state', JSON.stringify(authState));
        return authState;
      } else {
        throw new Error('Invalid credentials');
      }
    } catch (error) {
      throw new Error('Login failed: ' + (error as Error).message);
    }
  }

  // Register new user
  async register(username: string, password: string, companyName: string): Promise<AuthState> {
    try {
      const userHash = btoa(username + password);
      
      // Check if user already exists
      const existingUser = await this.getUserData(userHash);
      if (existingUser) {
        throw new Error('User already exists');
      }

      // Create new user
      const newUser: User = {
        id: userHash,
        username,
        companyName,
        createdAt: new Date().toISOString()
      };

      // Save user data to cloud
      await this.saveUserData(userHash, newUser);

      const authState: AuthState = {
        isAuthenticated: true,
        user: newUser,
        token: userHash
      };

      localStorage.setItem('auth_state', JSON.stringify(authState));
      return authState;
    } catch (error) {
      throw new Error('Registration failed: ' + (error as Error).message);
    }
  }

  // Get current auth state
  getCurrentAuth(): AuthState {
    const stored = localStorage.getItem('auth_state');
    if (stored) {
      return JSON.parse(stored);
    }
    return {
      isAuthenticated: false,
      user: null,
      token: null
    };
  }

  // Logout
  logout(): void {
    localStorage.removeItem('auth_state');
  }

  // Private methods for cloud storage
  private async getUserData(userHash: string): Promise<User | null> {
    try {
      // This would connect to your cloud storage
      // For now, return null (user doesn't exist)
      return null;
    } catch (error) {
      return null;
    }
  }

  private async saveUserData(userHash: string, userData: User): Promise<void> {
    try {
      // This would save to your cloud storage
      console.log('Saving user data to cloud:', userData);
    } catch (error) {
      throw new Error('Failed to save user data');
    }
  }
}

export const authService = new AuthService();
