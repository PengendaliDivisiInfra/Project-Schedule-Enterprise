import Dexie, { Table } from 'dexie';

export interface SyncQueueItem {
  id: string;
  table_name: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  payload: any;
  created_at: number;
}

class InfraControlDB extends Dexie {
  syncQueue!: Table<SyncQueueItem, string>;

  constructor() {
    super('InfraControlOfflineDB');
    this.version(1).stores({
      syncQueue: 'id, table_name, action, created_at'
    });
  }
}

export const db = new InfraControlDB();