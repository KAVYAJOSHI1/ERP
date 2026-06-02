import { create } from 'zustand';

interface User {
  id: string;
  email: string;
  role: string;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  setAuth: (user: User, accessToken: string, refreshToken: string) => void;
  updateAccessToken: (accessToken: string) => void;
  clearAuth: () => void;
  loadAuthFromStorage: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,

  setAuth: (user, accessToken, refreshToken) => {
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    set({ user, accessToken, refreshToken, isAuthenticated: true });
  },

  updateAccessToken: (accessToken) => {
    localStorage.setItem('accessToken', accessToken);
    set({ accessToken });
  },

  clearAuth: () => {
    localStorage.removeItem('user');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false });
  },

  loadAuthFromStorage: () => {
    if (typeof window !== 'undefined') {
      const userStr = localStorage.getItem('user');
      const accessToken = localStorage.getItem('accessToken');
      const refreshToken = localStorage.getItem('refreshToken');

      if (userStr && accessToken && refreshToken) {
        try {
          const user = JSON.parse(userStr);
          set({ user, accessToken, refreshToken, isAuthenticated: true });
        } catch (e) {
          localStorage.removeItem('user');
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
        }
      }
    }
  },
}));
