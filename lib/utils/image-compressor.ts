// lib/utils/image-compressor.ts
import { calculateCompressionStats, type CompressionStats } from '@/lib/utils/hse-workforce-controls';

export interface CompressedPhotoResult {
  file: File;
  dataUrl: string;
  width: number;
  height: number;
  stats: CompressionStats;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Gagal membaca hasil kompresi gambar.'));
    reader.readAsDataURL(blob);
  });
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(',');
  const mimeMatch = header.match(/data:(.*?);base64/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  const binary = atob(base64 || '');
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

/**
 * Mengompresi foto progres lapangan secara otomatis di browser (HTML5 Canvas)
 * agar hemat kuota & cepat tersinkronisasi dari lokasi blank spot.
 */
export async function compressFieldPhoto(
  file: File,
  options?: { maxDimension?: number; quality?: number }
): Promise<CompressedPhotoResult> {
  const maxDim = options?.maxDimension ?? 1280;
  const quality = options?.quality ?? 0.72;

  // Jika bukan gambar (misal PDF), kembalikan langsung tanpa kompresi canvas
  if (!file.type.startsWith('image/')) {
    const dataUrl = await blobToDataUrl(file);
    return {
      file,
      dataUrl,
      width: 0,
      height: 0,
      stats: calculateCompressionStats(file.size, file.size),
    };
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Gagal memuat gambar untuk kompresi otomatis.'));
      el.src = objectUrl;
    });

    let targetW = img.naturalWidth || img.width;
    let targetH = img.naturalHeight || img.height;

    if (targetW > maxDim || targetH > maxDim) {
      if (targetW >= targetH) {
        targetH = Math.round((targetH * maxDim) / targetW);
        targetW = maxDim;
      } else {
        targetW = Math.round((targetW * maxDim) / targetH);
        targetH = maxDim;
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D tidak tersedia pada browser ini.');

    ctx.drawImage(img, 0, 0, targetW, targetH);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('Gagal mengekspor gambar terkompresi.'))),
        'image/jpeg',
        quality
      );
    });

    const baseName = file.name.replace(/\.[^/.]+$/, '');
    const compressedFile = new File([blob], `${baseName}_compressed.jpg`, {
      type: 'image/jpeg',
      lastModified: Date.now(),
    });
    const dataUrl = await blobToDataUrl(compressedFile);

    return {
      file: compressedFile,
      dataUrl,
      width: targetW,
      height: targetH,
      stats: calculateCompressionStats(file.size, compressedFile.size),
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
