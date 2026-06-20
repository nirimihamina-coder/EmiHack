export type SyncAction = 'CREATE' | 'UPDATE' | 'DELETE';
export type SyncStatus = 'pending' | 'syncing' | 'error';

export interface SyncQueueItem {
  id?: number;
  localId: string;
  resourceId?: string;
  action: SyncAction;
  resource: string;
  payload: unknown;
  createdAt: string;
  status: SyncStatus;
  retries: number;
  errorMessage?: string;
}
