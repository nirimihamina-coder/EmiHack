import Dexie, { type Table } from 'dexie';
import type { SyncQueueItem } from '../../interface/Sync';
import type { Product } from '../../interface/Product';

// ─── DATABASE CORE ───────────────────────────────────────

class AppDatabase extends Dexie {
  products!: Table<Product>;
  // orders!: Table<Order>; // 👈 ajout ici
  syncQueue!: Table<SyncQueueItem>;

  constructor() {
    super('offline-first-db');

    this.version(1).stores({
      products: 'id, name',
      // autre_table: 'id, xxx', // 👈 ajout ici
      syncQueue: '++id, localId, action, resource, status, createdAt'
    });
  }
}

export const db = new AppDatabase();
