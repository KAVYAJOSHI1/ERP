import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { apiFetch, ApiError } from '../lib/api';
import { useAuthStore } from '../lib/store';
import { useOpStatusStore } from '../lib/opStatusStore';

function mockResponse(body: unknown, init: { status?: number; headers?: Record<string, string> } = {}) {
  const headers = new Headers(init.headers || {});
  return {
    ok: (init.status ?? 200) < 400,
    status: init.status ?? 200,
    headers,
    json: async () => body,
  } as unknown as Response;
}

beforeEach(() => {
  useAuthStore.setState({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false });
  useOpStatusStore.setState({ items: [], lastCorrelationId: null });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('apiFetch', () => {
  it('captures the gateway X-Correlation-ID from a successful response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        mockResponse({ ok: true }, { headers: { 'X-Correlation-ID': 'ERP-CORR-OK' } }),
      ),
    );
    await apiFetch('/production/runs');
    expect(useOpStatusStore.getState().lastCorrelationId).toBe('ERP-CORR-OK');
  });

  it('throws an ApiError carrying the structured backend body (incident + correlation id)', async () => {
    const errBody = {
      error: 'Insufficient Materials',
      message: 'Failed to deduct raw material: insufficient stock',
      correlation_id: 'ERP-CORR-FAIL',
      transaction_id: 'run-123',
      incident: { id: 'INC-9', number: 'TKT-9', status: 'OPEN', escalated: true, correlation_id: 'ERP-CORR-FAIL' },
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse(errBody, { status: 400 })));

    let caught: unknown;
    try {
      await apiFetch('/production/runs', { method: 'POST', body: '{}' });
    } catch (e) {
      caught = e;
    }

    expect(caught).toBeInstanceOf(ApiError);
    const err = caught as ApiError;
    expect(err.status).toBe(400);
    expect(err.correlationId).toBe('ERP-CORR-FAIL');
    // The structured body is what the UI reads: `error` -> title, `message` -> detail.
    expect((err.body as any).error).toBe('Insufficient Materials');
    expect((err.body as any).message).toContain('insufficient stock');
    expect((err.body as any).incident.id).toBe('INC-9');
    expect((err.body as any).incident.status).toBe('OPEN');
    expect((err.body as any).transaction_id).toBe('run-123');
  });
});
