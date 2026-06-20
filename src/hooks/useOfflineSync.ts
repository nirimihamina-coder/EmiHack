import { useState, useEffect, useCallback, useRef } from 'react';
import { db } from '../lib/db';
import { getPendingActions, markSynced, markError, retryErrors } from '../lib/db/product.db';
import type { SyncQueueItem } from '../interface/Sync';
import { useLiveQuery } from 'dexie-react-hooks';

export type SyncState = 'idle' | 'syncing' | 'success' | 'error';

interface UseOfflineSyncReturn {
  isOnline: boolean;
  syncState: SyncState;
  pendingCount: number;
  pendingItems: SyncQueueItem[];
  triggerSync: () => Promise<void>;
  retryFailed: () => Promise<void>;
}

const BASE_URL = import.meta.env.VITE_API_URL ?? '';

async function executeAction(item: SyncQueueItem): Promise<void> {
  const payload = item.payload as Record<string, unknown>;

  switch (item.action) {
    case 'CREATE': {
      const res = await fetch(`${BASE_URL}/api/${item.resource}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const serverProduct = await res.json();

      // 🔥 remplacer produit temporaire par celui du serveur
      await db.products.delete(item.localId);
      await db.products.put(serverProduct);
      break;
    }

    case 'UPDATE': {
      const id = item.localId;

      const res = await fetch(`${BASE_URL}/api/${item.resource}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      break;
    }

    case 'DELETE': {
      const id = item.localId;

      const res = await fetch(`${BASE_URL}/api/${item.resource}/${id}`, {
        method: 'DELETE'
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      break;
    }
  }
}

export function useOfflineSync(): UseOfflineSyncReturn {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncState, setSyncState] = useState<SyncState>('idle');
  const isSyncingRef = useRef(false);

  const pendingItems =
    useLiveQuery(() => db.syncQueue.where('status').anyOf(['pending', 'error']).sortBy('createdAt'), [], []) ?? [];

  const pendingCount = pendingItems.filter((i) => i.status === 'pending').length;

  const triggerSync = useCallback(async () => {
    if (isSyncingRef.current || !navigator.onLine) return;

    const pending = await getPendingActions();
    if (pending.length === 0) return;

    isSyncingRef.current = true;
    setSyncState('syncing');

    let hasError = false;

    for (const item of pending) {
      await db.syncQueue.update(item.id!, { status: 'syncing' });

      try {
        await executeAction(item);
        await markSynced(item.id!);
      } catch (err) {
        hasError = true;
        const message = err instanceof Error ? err.message : 'Erreur inconnue';
        await markError(item.id!, message);
      }
    }

    isSyncingRef.current = false;
    setSyncState(hasError ? 'error' : 'success');

    setTimeout(() => setSyncState('idle'), 3000);
  }, []);

  const retryFailed = useCallback(async () => {
    await retryErrors();
    await triggerSync();
  }, [triggerSync]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      triggerSync();
    };

    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [triggerSync]);

  return {
    isOnline,
    syncState,
    pendingCount,
    pendingItems,
    triggerSync,
    retryFailed
  };
}
