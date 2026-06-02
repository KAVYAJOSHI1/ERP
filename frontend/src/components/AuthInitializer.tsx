'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/lib/store';

export default function AuthInitializer() {
  const loadAuthFromStorage = useAuthStore((state) => state.loadAuthFromStorage);

  useEffect(() => {
    loadAuthFromStorage();
  }, [loadAuthFromStorage]);

  return null;
}
