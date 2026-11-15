import { db } from '../db/offline-db';
import { supabase } from '../supabase'; // Sesuaikan path jika berbeda

export async function queueOfflineAction(table_name: string, action: 'INSERT' | 'UPDATE' | 'DELETE', payload: any) {
  await db.syncQueue.add({
    id: crypto.randomUUID(), // Gunakan UUID bawaan browser
    table_name,
    action,
    payload,
    created_at: Date.now()
  });
  
  // Notifikasi Custom Toast (Aturan Mutlak: No alert)
  window.dispatchEvent(new CustomEvent('app-toast', { 
    detail: { type: 'info', message: 'Mode Offline: Data disimpan lokal, menunggu sinkronisasi.' } 
  }));
}

export async function processSyncQueue() {
  if (!navigator.onLine) return;
  
  const pendingItems = await db.syncQueue.toArray();
  if (pendingItems.length === 0) return;

  let successCount = 0;
  
  for (const item of pendingItems) {
    try {
      let error;
      if (item.action === 'INSERT') {
        const { error: err } = await supabase.from(item.table_name).insert(item.payload);
        error = err;
      } else if (item.action === 'UPDATE') {
        const { error: err } = await supabase.from(item.table_name).update(item.payload).eq('id', item.payload.id);
        error = err;
      } else if (item.action === 'DELETE') {
         const { error: err } = await supabase.from(item.table_name).update({ is_deleted: true }).eq('id', item.payload.id);
         error = err;
      }

      if (error) throw new Error(error.message);
      
      // Hapus dari antrean lokal jika sukses terkirim ke server
      await db.syncQueue.delete(item.id);
      successCount++;
    } catch (err: any) {
      console.error(`Sync failed for ${item.table_name}:`, err.message);
      // Biarkan data tetap di antrean agar bisa dicoba lagi nanti (misal karena koneksi putus di tengah jalan)
    }
  }

  if (successCount > 0) {
    window.dispatchEvent(new CustomEvent('app-toast', { 
      detail: { type: 'success', message: `${successCount} data offline berhasil disinkronisasi ke server.` } 
    }));
  }
}

// Jalankan otomatis saat koneksi kembali online
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    processSyncQueue();
  });
}