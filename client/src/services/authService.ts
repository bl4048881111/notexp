import { DEFAULT_CREDENTIALS } from "@shared/types";

// Simple authentication service
export const authService = {
  // Login with username and password
  login: async (username: string, password: string): Promise<boolean> => {
    // For this MVP, we're using hardcoded credentials
    if (username === DEFAULT_CREDENTIALS.username && password === DEFAULT_CREDENTIALS.password) {
      // Store authentication state in localStorage
      localStorage.setItem('auth', JSON.stringify({ 
        username, 
        isAuthenticated: true,
        timestamp: Date.now()
      }));
      return true;
    }
    return false;
  },
  
  // Check if user is authenticated
  isAuthenticated: (): boolean => {
    const auth = localStorage.getItem('auth');
    if (!auth) return false;
    
    try {
      const authData = JSON.parse(auth);
      // Optional: check token expiration
      const isExpired = Date.now() - authData.timestamp > 24 * 60 * 60 * 1000; // 24 hours
      return authData.isAuthenticated && !isExpired;
    } catch (error) {
      return false;
    }
  },
  
  // Logout
  logout: (): void => {
    localStorage.removeItem('auth');
  },
  
  // Get current user
  getCurrentUser: () => {
    const auth = localStorage.getItem('auth');
    if (!auth) return null;
    
    try {
      const authData = JSON.parse(auth);
      return { username: authData.username };
    } catch (error) {
      return null;
    }
  }
};
