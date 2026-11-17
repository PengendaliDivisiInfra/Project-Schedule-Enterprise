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

    // Ambil URL Railway dari Environment Variable Vercel
    const PDF_SERVICE_URL = process.env.PDF_SERVICE_URL;

    if (!PDF_SERVICE_URL) {
      throw new Error('PDF_SERVICE_URL belum diset di Environment Variables Vercel.');
    }

    console.log(`[Proxy PDF] Meneruskan request ke: ${PDF_SERVICE_URL}`);

    // Kirim data ke Railway
    const response = await fetch(PDF_SERVICE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ html, scale, format, isLandscape }), 
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Railway Error (${response.status}): ${errorText}`);
    }

    // Terima file PDF dari Railway
    const pdfBuffer = await response.arrayBuffer();

    // Kembalikan ke browser user
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