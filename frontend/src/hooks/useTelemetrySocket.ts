'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '@/lib/store';
import { useAlertStore } from '@/lib/alertStore';

const GATEWAY_WS = process.env.NEXT_PUBLIC_GATEWAY_WS_URL || 'ws://localhost:5000';
const RECONNECT_DELAY_MS = 3000;

export function useTelemetrySocket(): void {
  const { accessToken, isAuthenticated } = useAuthStore();
  const addAlert = useAlertStore((s) => s.addAlert);
  const wsRef = useRef<WebSocket | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    if (!accessToken || !isAuthenticated) return;

    const ws = new WebSocket(`${GATEWAY_WS}/ws/alerts?token=${accessToken}`);
    wsRef.current = ws;

    ws.onmessage = (event: MessageEvent) => {
      try {
        const alert = JSON.parse(event.data as string);
        addAlert(alert);
      } catch {
        // malformed message — ignore
      }
    };

    ws.onclose = () => {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      retryTimerRef.current = setTimeout(connect, RECONNECT_DELAY_MS);
    };

    ws.onerror = () => ws.close();
  }, [accessToken, isAuthenticated, addAlert]);

  useEffect(() => {
    connect();
    return () => {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      wsRef.current?.close();
    };
  }, [connect]);
}
