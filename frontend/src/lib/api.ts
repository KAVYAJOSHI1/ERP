import { useAuthStore } from './store';

const GATEWAY_URL = 'http://localhost:8000/api';

interface RequestOptions extends RequestInit {
  skipAuth?: boolean;
}

export async function apiFetch(endpoint: string, options: RequestOptions = {}) {
  const { accessToken, refreshToken, updateAccessToken, clearAuth } = useAuthStore.getState();

  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');

  if (accessToken && !options.skipAuth) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  // Gateway URL mapping
  const url = `${GATEWAY_URL}${endpoint}`;

  let response = await fetch(url, {
    ...options,
    headers,
  });

  // Attempt auto token refresh on 401 Unauthorized
  if (response.status === 401 && refreshToken && !options.skipAuth) {
    console.log('Access token expired, attempting silent refresh...');
    try {
      const refreshResponse = await fetch(`${GATEWAY_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (refreshResponse.ok) {
        const refreshData = await refreshResponse.json();
        const newAccessToken = refreshData.access_token;
        
        // Save new token
        updateAccessToken(newAccessToken);
        
        // Retry initial request with new token
        headers.set('Authorization', `Bearer ${newAccessToken}`);
        response = await fetch(url, {
          ...options,
          headers,
        });
      } else {
        // Refresh token failed/expired -> force logout
        console.warn('Refresh token is invalid, logging out user.');
        clearAuth();
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
      }
    } catch (err) {
      console.error('Network error during token refresh:', err);
      clearAuth();
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || errorData.error || `HTTP error ${response.status}`);
  }

  return response.json();
}
