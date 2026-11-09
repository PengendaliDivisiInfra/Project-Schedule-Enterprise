import puppeteer, { Browser } from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import { NextResponse } from 'next/server';
import fs from 'fs';

export const maxDuration = 60; 
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let browser: Browser | null = null;
  
  try {
    const { html, scale, format = 'A3', isLandscape = true, footerTemplate = '' } = await req.json();

    let executablePath: string;
    let args: string[] = [];

    if (process.env.NODE_ENV === 'development') {
      const winChrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
      const winEdge = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
      const winEdge64 = 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe';
      
      if (fs.existsSync(winChrome)) {
        executablePath = winChrome;
      } else if (fs.existsSync(winEdge64)) {
        executablePath = winEdge64;
      } else if (fs.existsSync(winEdge)) {
        executablePath = winEdge;
      } else {
        throw new Error('Chrome atau Edge tidak ditemukan di Windows.');
      }
      args = ['--no-sandbox', '--disable-setuid-sandbox'];
    } else {
      chromium.setGraphicsMode = false;
      executablePath = await chromium.executablePath();
      args = [
        ...chromium.args,
        '--disable-gpu',
        '--disable-dev-shm-usage',
        '--disable-setuid-sandbox',
        '--no-sandbox',
        '--single-process',
        '--hide-scrollbars'
      ];
    }

    browser = await puppeteer.launch({
      args,
      defaultViewport: { width: 1920, height: 1080 },
      executablePath: executablePath,
      headless: true, 
    });

    const page = await browser.newPage();
    
    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 500));

    const pdfBuffer = await page.pdf({
      format: format,
      landscape: isLandscape,
      printBackground: true,
      scale: scale || 1,
      displayHeaderFooter: footerTemplate ? true : false,
      headerTemplate: '<div></div>',
      footerTemplate: footerTemplate,
      // MARGIN BAWAH 45mm MUTLAK
      margin: format === 'A4' 
        ? { top: '20mm', right: '20mm', bottom: '45mm', left: '20mm' } 
        : { top: '10mm', right: '10mm', bottom: '15mm', left: '10mm' },
      timeout: 30000
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
    console.error('PDF Generation Error:', error);
    return new NextResponse(JSON.stringify({ error: 'Gagal generate PDF', details: error.message }), { status: 500 });
  } finally {
    if (browser) { await browser.close(); }
  }
}