import { db, type SyncQueueItem, type OfflinePhotoItem } from '../db/offline-db';
import { supabase } from '../supabase';
import { dataUrlToBlob } from '../utils/image-compressor';

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

export async function queueOfflinePhoto(photo: Omit<OfflinePhotoItem, 'id' | 'created_at' | 'status' | 'retry_count' | 'last_error'>) {
  const id = crypto.randomUUID();
  await db.offlinePhotos.add({
    ...photo,
    id,
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
          message: `Foto terkompresi (${Math.round(photo.compressed_size / 1024)} KB) disimpan offline, otomatis diunggah saat online.`,
        },
      })
    );
  }
  return id;
}

export async function getPendingOfflineCount(): Promise<{ records: number; photos: number; total: number }> {
  const [records, photos] = await Promise.all([
    db.syncQueue.where('status').equals('pending').count(),
    db.offlinePhotos.where('status').equals('pending').count(),
  ]);
  return { records, photos, total: records + photos };
}

export async function processSyncQueue() {
  if (typeof window === 'undefined' || !navigator.onLine || isProcessingQueue) return;

  isProcessingQueue = true;
  try {
    let successCount = 0;
    let permanentlyFailedCount = 0;

    // 1. Sinkronisasi Foto Terkompresi Offline terlebih dahulu agar path file tersedia
    const allPhotos = await db.offlinePhotos.orderBy('created_at').toArray();
    const pendingPhotos = allPhotos.filter(
      (p) => (p.status || 'pending') === 'pending' && (p.retry_count || 0) < MAX_SYNC_RETRIES
    );

    for (const photo of pendingPhotos) {
      try {
        const blob = dataUrlToBlob(photo.data_url);
        const { error: uploadErr } = await supabase.storage
          .from(photo.bucket)
          .upload(photo.storage_path, blob, {
            contentType: photo.mime_type || 'image/jpeg',
            upsert: true,
          });

        if (uploadErr) throw new Error(uploadErr.message);

        await db.offlinePhotos.delete(photo.id);
        successCount++;
      } catch (err: any) {
        const nextRetry = (photo.retry_count || 0) + 1;
        const reachedMax = nextRetry >= MAX_SYNC_RETRIES;
        await db.offlinePhotos.update(photo.id, {
          retry_count: nextRetry,
          last_error: err?.message || 'Gagal unggah foto offline',
          status: reachedMax ? 'failed' : 'pending',
        });
        if (reachedMax) permanentlyFailedCount++;
      }
    }

    // 2. Sinkronisasi Antrean Data Transaksi Offline
    const allItems = await db.syncQueue.orderBy('created_at').toArray();
    const pendingItems = allItems.filter(
      (item) => (item.status || 'pending') === 'pending' && (item.retry_count || 0) < MAX_SYNC_RETRIES
    );

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
            message: `${successCount} data/foto offline berhasil disinkronisasi ke server.`,
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
  const [failedItems, failedPhotos] = await Promise.all([
    getFailedSyncItems(),
    db.offlinePhotos.where('status').equals('failed').toArray(),
  ]);
  for (const item of failedItems) {
    await db.syncQueue.update(item.id, {
      status: 'pending',
      retry_count: 0,
      last_error: null,
    });
  }
  for (const photo of failedPhotos) {
    await db.offlinePhotos.update(photo.id, {
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
