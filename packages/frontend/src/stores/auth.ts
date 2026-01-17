import { create } from 'zustand';
import { authApi, setTokens, clearTokens } from '@/lib/api';

interface User {
  id: string;
  email: string;
  name: string | null;
  role: 'admin' | 'viewer';
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,

  login: async (email, password) => {
    const data = await authApi.login(email, password);
    setTokens(data.accessToken, data.refreshToken);
    set({ user: data.user, isAuthenticated: true });
  },

  register: async (email, password, name) => {
    const data = await authApi.register(email, password, name);
    setTokens(data.accessToken, data.refreshToken);
    set({ user: data.user, isAuthenticated: true });
  },

  logout: async () => {
    try {
      await authApi.logout();
    } catch {
      // Ignore errors
    }
    clearTokens();
    set({ user: null, isAuthenticated: false });
  },

  checkAuth: async () => {
    set({ isLoading: true });
    try {
      const user = await authApi.me();
      set({ user: user as User, isAuthenticated: true, isLoading: false });
    } catch {
      clearTokens();
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },
}));
