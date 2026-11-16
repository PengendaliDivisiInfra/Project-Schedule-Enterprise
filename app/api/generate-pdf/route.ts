import puppeteer, { Browser } from 'puppeteer-core';
import chromium from '@sparticuz/chromium-min';
import { NextResponse } from 'next/server';
import fs from 'fs';

export const maxDuration = 60; 
export const dynamic = 'force-dynamic';

let cachedExecutablePath: string | null = null;

export async function POST(req: Request) {
  let browser: Browser | null = null;
  
  try {
    const { html, scale, format = 'A4', isLandscape = true, footerTemplate = '' } = await req.json();

    if (!html) {
      return new NextResponse(JSON.stringify({ error: 'HTML content is required' }), { status: 400 });
    }

    let executablePath: string;
    let args: string[] = [];

    if (process.env.NODE_ENV === 'development') {
      const winChrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
      const winEdge = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
      const winEdge64 = 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe';
      
      if (fs.existsSync(winChrome)) { executablePath = winChrome; }
      else if (fs.existsSync(winEdge64)) { executablePath = winEdge64; }
      else if (fs.existsSync(winEdge)) { executablePath = winEdge; }
      else { throw new Error('Chrome atau Edge tidak ditemukan di Windows.'); }
      
      args = ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'];
    } else {
      chromium.setGraphicsMode = false;
      
      if (!cachedExecutablePath) {
        const urlsToTry: string[] = [];
        
        if (process.env.VERCEL_URL) {
          urlsToTry.push(`https://${process.env.VERCEL_URL}/chromium-pack.tar`);
        }
        
        const requestUrl = new URL(req.url);
        urlsToTry.push(`${requestUrl.origin}/chromium-pack.tar`);

        let lastError: any = null;
        for (const tarUrl of urlsToTry) {
          try {
            console.log(`[PDF Engine] Mencoba mengekstrak Chromium dari: ${tarUrl}`);
            // Pastikan menggunakan chromium dari @sparticuz/chromium-min
            cachedExecutablePath = await chromium.executablePath(tarUrl);
            console.log(`[PDF Engine] Berhasil mengekstrak Chromium.`);
            break; 
          } catch (err: any) {
            console.warn(`[PDF Engine] Gagal mengekstrak dari ${tarUrl}:`, err.message);
            lastError = err;
          }
        }

        if (!cachedExecutablePath) {
          throw new Error(`Gagal mengekstrak Chromium dari semua URL. Error terakhir: ${lastError?.message}`);
        }
      }
      
      executablePath = cachedExecutablePath;
      
      args = [
        ...chromium.args,
        '--disable-gpu',
        '--disable-dev-shm-usage',
        '--disable-setuid-sandbox',
        '--no-sandbox',
        '--no-zygote',
        '--single-process',
        '--hide-scrollbars',
        '--font-render-hinting=none'
      ];
    }

    console.log(`[PDF Engine] Meluncurkan browser dengan executablePath: ${executablePath}`);
    
    browser = await puppeteer.launch({
      args,
      defaultViewport: { width: 1920, height: 1080 },
      executablePath: executablePath,
      headless: true, 
    });

    const page = await browser.newPage();
    await page.emulateMediaType('print');
    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForNetworkIdle({ idleTime: 500, timeout: 45000 });
    await page.evaluateHandle('document.fonts.ready');
    await new Promise(resolve => setTimeout(resolve, 1000));

    const pdfBuffer = await page.pdf({
      format: format,
      landscape: isLandscape,
      printBackground: true,
      scale: scale || 1,
      displayHeaderFooter: !!footerTemplate,
      headerTemplate: '<div></div>',
      footerTemplate: footerTemplate,
      margin: format === 'A4' 
        ? { top: '20mm', right: '15mm', bottom: '45mm', left: '15mm' } 
        : { top: '10mm', right: '10mm', bottom: '15mm', left: '10mm' },
      timeout: 45000
    });

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="Document.pdf"',
        'Content-Length': pdfBuffer.length.toString(),
      },
    });

  } catch (error: any) {
    console.error('=== PDF GENERATION ERROR ===');
    console.error('Message:', error.message);
    console.error('Stack:', error.stack);
    console.error('============================');

    return new NextResponse(JSON.stringify({ 
      error: 'Gagal generate PDF', 
      details: error.message 
    }), { status: 500 });
  } finally {
    if (browser) { 
      await browser.close(); 
    }
  }
}