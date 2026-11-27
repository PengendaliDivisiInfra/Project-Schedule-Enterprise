// lib/utils/secure-storage.ts
import { supabase } from '@/lib/supabase';

/** Masa berlaku Signed URL dokumen rahasia: 10 menit (600 detik). */
export const SIGNED_URL_EXPIRY_SECONDS = 600;

/**
 * Mengekstrak path relatif objek dari URL Supabase Storage lama (jika data historis masih berupa public URL).
 */
export function extractStorageObjectPath(bucket: string, storedPathOrUrl: string): string {
  const raw = String(storedPathOrUrl || '').trim();
  if (!raw) return '';

  if (!raw.startsWith('http://') && !raw.startsWith('https://')) {
    return raw.replace(/^\/+/, '');
  }

  const markerPublic = `/storage/v1/object/public/${bucket}/`;
  const markerSign = `/storage/v1/object/sign/${bucket}/`;

  if (raw.includes(markerPublic)) {
    return decodeURIComponent(raw.split(markerPublic)[1].split('?')[0]);
  }
  if (raw.includes(markerSign)) {
    return decodeURIComponent(raw.split(markerSign)[1].split('?')[0]);
  }

  return '';
}

/**
 * Mengunggah file ke Private Bucket Supabase Storage dan mengembalikan path relatif (bukan public URL).
 */
export async function uploadPrivateFile(
  bucket: string,
  filePath: string,
  file: File
): Promise<string> {
  const { error } = await supabase.storage.from(bucket).upload(filePath, file, {
    upsert: false,
  });
  if (error) {
    throw new Error(`Gagal mengunggah dokumen ke ${bucket}: ${error.message}`);
  }
  return filePath;
}

/**
 * Menghasilkan Signed URL sementara (default 10 menit / 600 detik) untuk mengunduh/menampilkan file privat.
 * Tetap kompatibel dengan data historis yang masih menyimpan URL penuh.
 */
export async function getSignedFileUrl(
  bucket: string,
  storedPathOrUrl: string | null | undefined,
  expiresInSeconds: number = SIGNED_URL_EXPIRY_SECONDS
): Promise<string> {
  if (!storedPathOrUrl) return '';

  const relativePath = extractStorageObjectPath(bucket, storedPathOrUrl);
  if (!relativePath) {
    // Jika URL berasal dari host eksternal non-Supabase, kembalikan apa adanya
    return storedPathOrUrl;
  }

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(relativePath, expiresInSeconds);

  if (error || !data?.signedUrl) {
    console.error(`Gagal membuat Signed URL (${bucket}/${relativePath}):`, error?.message);
    return '';
  }

  return data.signedUrl;
}
