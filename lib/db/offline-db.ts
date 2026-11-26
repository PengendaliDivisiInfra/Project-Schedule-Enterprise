import Dexie, { Table } from 'dexie';

export type SyncQueueStatus = 'pending' | 'failed';

export interface SyncQueueItem {
  id: string;
  table_name: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  payload: any;
  created_at: number;
  status?: SyncQueueStatus;
  retry_count?: number;
  last_error?: string | null;
}

class InfraControlDB extends Dexie {
  syncQueue!: Table<SyncQueueItem, string>;

  constructor() {
    super('InfraControlOfflineDB');
    this.version(1).stores({
      syncQueue: 'id, table_name, action, created_at',
    });
    this.version(2)
      .stores({
        syncQueue: 'id, table_name, action, status, created_at',
      })
      .upgrade((tx) => {
        return tx
          .table('syncQueue')
          .toCollection()
          .modify((item: SyncQueueItem) => {
            if (!item.status) item.status = 'pending';
            if (typeof item.retry_count !== 'number') item.retry_count = 0;
            if (item.last_error === undefined) item.last_error = null;
          });
      });
  }
}

export const db = new InfraControlDB();
