import { db } from './index';
import type { SyncAction } from '../../interface/Sync';
import type { Product } from '../../interface/Product';

// ─── QUEUE HELPERS ─────────────────────────────────────

export async function enqueueAction(
  action: SyncAction,
  resource: string,
  payload: unknown,
  localId: string
): Promise<void> {
  await db.syncQueue.add({
    localId,
    resourceId: localId,
    action,
    resource,
    payload,
    createdAt: new Date().toISOString(),
    status: 'pending',
    retries: 0
  });
}

export async function getPendingActions() {
  return db.syncQueue.where('status').equals('pending').sortBy('createdAt');
}

// ─── PRODUCT OFFLINE CRUD ─────────────────────────────

// CREATE
export async function createProductOffline(data: Omit<Product, 'id'>) {
  const localId = crypto.randomUUID();

  const product: Product = {
    ...data,
    id: localId,
    isLocal: true,
    isSynced: false
  };

  await db.products.add(product);

  await enqueueAction('CREATE', 'products', product, localId);

  return product;
}

// UPDATE
export async function updateProductOffline(id: string, data: Partial<Product>) {
  await db.products.update(id, {
    ...data,
    isSynced: false
  });

  await enqueueAction('UPDATE', 'products', data, id);
}

// DELETE
export async function deleteProductOffline(id: string) {
  await db.products.delete(id);

  await enqueueAction('DELETE', 'products', { id }, id);
}

// ─── SYNC HELPERS ─────────────────────────────────────

export async function markSynced(id: number) {
  await db.syncQueue.delete(id);
}

export async function markError(id: number, message: string) {
  const item = await db.syncQueue.get(id);

  await db.syncQueue.update(id, {
    status: 'error',
    errorMessage: message,
    retries: (item?.retries ?? 0) + 1
  });
}

export async function retryErrors() {
  await db.syncQueue.where('status').equals('error').modify({ status: 'pending', errorMessage: undefined });
}
