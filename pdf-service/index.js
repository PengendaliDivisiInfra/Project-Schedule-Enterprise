const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const os = require('os');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.get('/healthz', (req, res) => {
  res.status(200).send('OK');
});

app.post('/generate-pdf', async (req, res) => {
  const { html, scale, format = 'A3', isLandscape = true, footerTemplate } = req.body;
  let browser = null;
  let tempFilePath = null;

  // Buat nama file unik di folder temp OS
  tempFilePath = path.join(os.tmpdir(), `pdf-${Date.now()}-${Math.random().toString(36).substring(7)}.html`);

  try {
    // 1. Simpan HTML ke file temporer untuk mengurangi beban memori CDP
    fs.writeFileSync(tempFilePath, html, 'utf-8');

    browser = await puppeteer.launch({
      headless: "new",
      protocolTimeout: 120000, // Naikkan timeout protocol
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--font-render-hinting=none',
        '--js-flags="--max-old-space-size=512"' // Naikkan heap memory
      ]
    });

    const page = await browser.newPage();
    
    // 2. Buka file lokal via protokol file:// (jauh lebih ringan dari setContent)
    await page.goto(`file://${tempFilePath}`, { 
      waitUntil: 'networkidle0', 
      timeout: 60000 
    });
    
    await page.evaluateHandle('document.fonts.ready');
    await new Promise(r => setTimeout(r, 1000));

    const pdfBuffer = await page.pdf({
      format: format,
      landscape: isLandscape,
      printBackground: true,
      scale: scale || 1,
      margin: { top: '10mm', right: '10mm', bottom: '15mm', left: '10mm' },
      displayHeaderFooter: !!footerTemplate,
      headerTemplate: '<div></div>',
      footerTemplate: footerTemplate || '', // Gunakan dari Vercel, atau kosongkan
      timeout: 60000
    });

    console.log(`[Railway] PDF Berhasil dibuat.`);
    
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Length': pdfBuffer.length
    });
    res.send(pdfBuffer);

  } catch (error) {
    console.error('=== RAILWAY PDF ERROR ===');
    console.error(error);
    res.status(500).json({ error: error.message });
  } finally {
    // 3. Selalu hapus file temporer
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try { fs.unlinkSync(tempFilePath); } catch (e) { console.error('Gagal hapus temp file:', e); }
    }
    // 4. Tutup browser dengan aman
    if (browser) {
      try { await browser.close(); } catch (e) { console.error('Gagal tutup browser:', e); }
    }
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`PDF Server running on port ${PORT}`);
});