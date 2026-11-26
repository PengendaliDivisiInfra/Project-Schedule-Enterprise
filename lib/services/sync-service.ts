import { db, type SyncQueueItem } from '../db/offline-db';
import { supabase } from '../supabase';

const MAX_SYNC_RETRIES = 5;
let isProcessingQueue = false;

export async function queueOfflineAction(
  table_name: string,
  action: 'INSERT' | 'UPDATE' | 'DELETE',
  payload: any
) {
  await db.syncQueue.add({
    id: crypto.randomUUID(),
    table_name,
    action,
    payload,
    created_at: Date.now(),
    status: 'pending',
    retry_count: 0,
    last_error: null,
  });

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('app-toast', {
        detail: {
          type: 'info',
          message: 'Mode Offline: Data disimpan lokal, menunggu sinkronisasi.',
        },
      })
    );
  }
}

export async function processSyncQueue() {
  if (typeof window === 'undefined' || !navigator.onLine || isProcessingQueue) return;

  isProcessingQueue = true;
  try {
    const allItems = await db.syncQueue.orderBy('created_at').toArray();
    const pendingItems = allItems.filter(
      (item) => (item.status || 'pending') === 'pending' && (item.retry_count || 0) < MAX_SYNC_RETRIES
    );

    if (pendingItems.length === 0) return;

    let successCount = 0;
    let permanentlyFailedCount = 0;

    for (const item of pendingItems) {
      try {
        let error;
        if (item.action === 'INSERT') {
          const { error: err } = await supabase.from(item.table_name).insert(item.payload);
          error = err;
        } else if (item.action === 'UPDATE') {
          const { error: err } = await supabase
            .from(item.table_name)
            .update(item.payload)
            .eq('id', item.payload.id);
          error = err;
        } else if (item.action === 'DELETE') {
          const { error: err } = await supabase
            .from(item.table_name)
            .update({ is_deleted: true })
            .eq('id', item.payload.id);
          error = err;
        }

        if (error) throw new Error(error.message);

        // Hapus dari antrean lokal jika sukses terkirim ke server
        await db.syncQueue.delete(item.id);
        successCount++;
      } catch (err: any) {
        const nextRetry = (item.retry_count || 0) + 1;
        const reachedMax = nextRetry >= MAX_SYNC_RETRIES;
        const errMsg = err?.message || 'Unknown sync error';

        console.error(
          `Sync failed for ${item.table_name} (attempt ${nextRetry}/${MAX_SYNC_RETRIES}):`,
          errMsg
        );

        await db.syncQueue.update(item.id, {
          retry_count: nextRetry,
          last_error: errMsg,
          status: reachedMax ? 'failed' : 'pending',
        });

        if (reachedMax) {
          permanentlyFailedCount++;
        }
      }
    }

    if (successCount > 0) {
      window.dispatchEvent(
        new CustomEvent('app-toast', {
          detail: {
            type: 'success',
            message: `${successCount} data offline berhasil disinkronisasi ke server.`,
          },
        })
      );
    }

    if (permanentlyFailedCount > 0) {
      window.dispatchEvent(
        new CustomEvent('app-toast', {
          detail: {
            type: 'error',
            message: `${permanentlyFailedCount} data offline gagal disinkronisasi setelah ${MAX_SYNC_RETRIES} percobaan.`,
          },
        })
      );
    }
  } finally {
    isProcessingQueue = false;
  }
}

export async function getFailedSyncItems(): Promise<SyncQueueItem[]> {
  return db.syncQueue.where('status').equals('failed').toArray();
}

export async function retryFailedSyncItems(): Promise<void> {
  const failedItems = await getFailedSyncItems();
  for (const item of failedItems) {
    await db.syncQueue.update(item.id, {
      status: 'pending',
      retry_count: 0,
      last_error: null,
    });
  }
  await processSyncQueue();
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    void processSyncQueue();
  });
}
