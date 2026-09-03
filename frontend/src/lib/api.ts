import { useAuthStore } from './store';
import { useOpStatusStore } from './opStatusStore';

const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:5000/api';

interface RequestOptions extends RequestInit {
  skipAuth?: boolean;
}

/**
 * Error thrown by apiFetch on a non-2xx response. Carries the structured backend
 * error body (which for escalated failures includes `incident` + `correlation_id`
 * + `transaction_id`) and the gateway X-Correlation-ID, so callers can surface a
 * proper failure component instead of a bare message.
 */
export class ApiError extends Error {
  status: number;
  correlationId?: string;
  body: Record<string, unknown>;

  constructor(message: string, opts: { status: number; correlationId?: string; body?: unknown }) {
    super(message);
    this.name = 'ApiError';
    this.status = opts.status;
    this.correlationId = opts.correlationId;
    this.body = (opts.body && typeof opts.body === 'object' ? opts.body : {}) as Record<string, unknown>;
  }
}

export async function apiFetch(endpoint: string, options: RequestOptions = {}) {
  const { accessToken, refreshToken, updateAccessToken, clearAuth } = useAuthStore.getState();

  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');

  if (accessToken && !options.skipAuth) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  const url = `${GATEWAY_URL}${endpoint}`;

  let response = await fetch(url, { ...options, headers });

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
        updateAccessToken(newAccessToken);
        headers.set('Authorization', `Bearer ${newAccessToken}`);
        response = await fetch(url, { ...options, headers });
      } else {
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

  // The gateway echoes the correlation id it generated/propagated for this call.
  const correlationId =
    response.headers.get('X-Correlation-ID') || response.headers.get('x-correlation-id') || undefined;
  if (correlationId) {
    try {
      useOpStatusStore.setState({ lastCorrelationId: correlationId });
    } catch {
      /* store not ready (SSR) — ignore */
    }
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message =
      (errorData as any).message ||
      (errorData as any).error ||
      `HTTP error ${response.status}`;
    throw new ApiError(message, {
      status: response.status,
      correlationId: (errorData as any).correlation_id || correlationId,
      body: errorData,
    });
  }

  return response.json();
}
