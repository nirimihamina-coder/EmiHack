import axiosInstance from '../api/axios';
import { db } from '../lib/db';
import { getPendingActions, markSynced, markError } from '../lib/db/product.db';

export async function syncQueue() {
  const actions = await getPendingActions();

  for (const action of actions) {
    try {
      if (action.resource === 'products') {
        if (action.action === 'CREATE') {
          const res = await axiosInstance.post('/products', action.payload);

          // remplacer local par serveur
          await db.products.delete(action.localId);
          await db.products.add({
            ...res.data,
            isSynced: true
          });
        }

        if (action.action === 'UPDATE') {
          await axiosInstance.put(`/products/${action.localId}`, action.payload);
        }

        if (action.action === 'DELETE') {
          await axiosInstance.delete(`/products/${action.localId}`);
        }
      }

      await markSynced(action.id!);
    } catch (err: any) {
      await markError(action.id!, err.message);
    }
  }
}
