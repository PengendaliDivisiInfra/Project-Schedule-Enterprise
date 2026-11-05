import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

// 🟢 WAJIB: Memberi tahu Vercel agar mengizinkan proses berjalan hingga 60 detik
export const maxDuration = 60; 
export const dynamic = 'force-dynamic';

export async function POST(req) {
  let browser = null;
  try {
    const { html, scale } = await req.json();

    // 🟢 OPTIMASI CHROMIUM UNTUK VERCEL (Mengurangi penggunaan RAM)
    chromium.setGraphicsMode = false;
    const executablePath = await chromium.executablePath();

    browser = await puppeteer.launch({
      args: [
        ...chromium.args,
        '--disable-gpu',
        '--disable-dev-shm-usage',
        '--disable-setuid-sandbox',
        '--no-sandbox',
        '--single-process' // KRUSIAL: Mencegah OOM (Out of Memory) di Vercel
      ],
      defaultViewport: chromium.defaultViewport,
      executablePath: executablePath,
      headless: chromium.headless,
    });

    const page = await browser.newPage();
    
    // Set konten HTML dan tunggu hingga semua aset (font/gambar) termuat
    await page.setContent(html, { 
      waitUntil: 'networkidle0', 
      timeout: 45000 // Beri waktu 45 detik untuk render DOM
    });

    // Konversi ke PDF
    const pdfBuffer = await page.pdf({
      format: 'A3',
      landscape: true,
      printBackground: true,
      scale: scale || 1,
      margin: { top: '10mm', right: '10mm', bottom: '15mm', left: '10mm' }
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
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  } finally {
    // Pastikan browser selalu ditutup agar memori server kembali lega
    if (browser) {
      await browser.close();
    }
  }
}