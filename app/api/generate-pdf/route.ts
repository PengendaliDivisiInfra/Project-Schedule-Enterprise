import { NextResponse } from 'next/server';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { html, scale, format, isLandscape, footerTemplate } = body;

    if (!html) {
      return NextResponse.json(
        { error: 'HTML content is required' },
        { status: 400 }
      );
    }

    let PDF_SERVICE_URL = process.env.PDF_SERVICE_URL;
    if (!PDF_SERVICE_URL) {
      throw new Error(
        'PDF_SERVICE_URL belum diset di Environment Variables Vercel (Production/Preview).'
      );
    }

    // Pastikan protokol https:// tersedia dan hapus trailing slash
    if (!PDF_SERVICE_URL.startsWith('http')) {
      PDF_SERVICE_URL = `https://${PDF_SERVICE_URL}`;
    }
    if (PDF_SERVICE_URL.endsWith('/')) {
      PDF_SERVICE_URL = PDF_SERVICE_URL.slice(0, -1);
    }

    const payloadToRailway: Record<string, any> = {
      html,
      scale,
      format,
      isLandscape,
    };

    // Teruskan footerTemplate (tabel paraf & nomor halaman SPK) jika dikirim oleh client
    if (footerTemplate) {
      payloadToRailway.footerTemplate = footerTemplate;
    }

    console.log(`[Proxy PDF] Meneruskan request ke: ${PDF_SERVICE_URL}`);
    console.log(
      `[Proxy PDF] Ukuran HTML payload: ${(html.length / 1024 / 1024).toFixed(2)} MB`
    );

    const controller = new AbortController();
    // Vercel maxDuration 60s, batasi fetch 55s agar error tetap tertangkap rapi
    const timeoutId = setTimeout(() => controller.abort(), 55000);

    let response: Response;
    try {
      response = await fetch(PDF_SERVICE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadToRailway),
        signal: controller.signal,
      });
    } catch (fetchErr: any) {
      if (fetchErr?.name === 'AbortError') {
        throw new Error(
          'Timeout (55 detik): Layanan PDF Railway tidak merespons. Periksa status container Railway atau URL gambar/logo di dokumen.'
        );
      }
      throw new Error(
        `Koneksi ke layanan PDF Railway gagal: ${fetchErr?.message || 'Network error'}`
      );
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Railway Error (${response.status}): ${errorText}`);
    }

    const pdfBuffer = await response.arrayBuffer();

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="Document.pdf"',
      },
    });
  } catch (error: any) {
    console.error('=== PROXY PDF ERROR ===');
    console.error('Message:', error.message);

    return NextResponse.json(
      {
        error: 'Gagal generate PDF',
        details: error.message || 'Unknown server error',
      },
      { status: 500 }
    );
  }
}