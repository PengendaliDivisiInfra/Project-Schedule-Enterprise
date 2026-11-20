import { NextResponse } from 'next/server';

export const maxDuration = 60; 
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { html, scale, format, isLandscape } = body;

    if (!html) {
      return new NextResponse(JSON.stringify({ error: 'HTML content is required' }), { status: 400 });
    }

    let PDF_SERVICE_URL = process.env.PDF_SERVICE_URL;
    if (!PDF_SERVICE_URL) {
      throw new Error('PDF_SERVICE_URL belum diset di Environment Variables Vercel.');
    }

    // --- PERBAIKAN URL OTOMATIS ---
    // Jika lupa https://, tambahkan otomatis
    if (!PDF_SERVICE_URL.startsWith('http')) {
      PDF_SERVICE_URL = `https://${PDF_SERVICE_URL}`;
    }
    // Hapus trailing slash jika ada
    if (PDF_SERVICE_URL.endsWith('/')) {
      PDF_SERVICE_URL = PDF_SERVICE_URL.slice(0, -1);
    }

    console.log(`[Proxy PDF] Meneruskan request ke: ${PDF_SERVICE_URL}`);
    console.log(`[Proxy PDF] Ukuran HTML payload: ${(html.length / 1024 / 1024).toFixed(2)} MB`);

    const controller = new AbortController();
    // Vercel maxDuration 60s, kita batasi fetch 55s
    const timeoutId = setTimeout(() => controller.abort(), 55000);

    const response = await fetch(PDF_SERVICE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ html, scale, format, isLandscape }), 
      signal: controller.signal
    });

    clearTimeout(timeoutId);

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
    
    return new NextResponse(JSON.stringify({ 
      error: 'Gagal generate PDF', 
      details: error.message 
    }), { status: 500 });
  }
}