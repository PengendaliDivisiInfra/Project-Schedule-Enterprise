import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

export const maxDuration = 60; 
export const dynamic = 'force-dynamic';

export async function POST(req) {
  let browser = null;
  try {
    const { html, scale } = await req.json();

    // 🟢 OPTIMASI CHROMIUM UNTUK VERCEL
    chromium.setGraphicsMode = false;
    const executablePath = await chromium.executablePath();

    browser = await puppeteer.launch({
      args: [
        ...chromium.args,
        '--disable-gpu',
        '--disable-dev-shm-usage',
        '--disable-setuid-sandbox',
        '--no-sandbox',
        '--single-process', // Krusial untuk mencegah OOM
        '--hide-scrollbars'
      ],
      defaultViewport: chromium.defaultViewport,
      executablePath: executablePath,
      headless: chromium.headless,
    });

    const page = await browser.newPage();
    
    // 🟢 PERBAIKAN UTAMA: Jangan gunakan 'networkidle0'
    // Karena Supabase Realtime (WebSocket) membuat koneksi tidak pernah putus.
    // Cukup tunggu DOM selesai dimuat.
    await page.setContent(html, { 
      waitUntil: 'domcontentloaded', 
      timeout: 30000 
    });

    // Beri waktu tambahan singkat untuk memastikan CSS ter-render
    await new Promise(resolve => setTimeout(resolve, 500));

    // Konversi ke PDF
    const pdfBuffer = await page.pdf({
      format: 'A3',
      landscape: true,
      printBackground: true,
      scale: scale || 1,
      margin: { top: '10mm', right: '10mm', bottom: '15mm', left: '10mm' },
      timeout: 30000 // Timeout untuk proses generate PDF
    });

    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="Master_Report.pdf"',
      },
    });

  } catch (error) {
    console.error('PDF Generation Error:', error);
    
    // Mengembalikan error yang lebih jelas ke frontend
    return new Response(JSON.stringify({ 
      error: 'Gagal generate PDF', 
      details: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}