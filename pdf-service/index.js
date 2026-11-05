const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.get('/healthz', (req, res) => {
  res.status(200).send('OK');
});

app.post('/generate-pdf', async (req, res) => {
  const { html, scale } = req.body;
  let browser = null;

  try {
    browser = await puppeteer.launch({
      headless: "new",
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 60000 });
    
    // Beri waktu CSS render
    await new Promise(r => setTimeout(r, 1000));

    const pdfBuffer = await page.pdf({
      format: 'A3',
      landscape: true,
      printBackground: true,
      scale: scale || 1,
      margin: { top: '10mm', right: '10mm', bottom: '15mm', left: '10mm' },
      // 🟢 AKTIFKAN FOOTER UNTUK NOMOR HALAMAN
      displayHeaderFooter: true,
      headerTemplate: '<div></div>', // Kosongkan header default
      footerTemplate: `
        <div style="width: 100%; font-size: 9px; font-family: 'Segoe UI', Arial, sans-serif; color: #64748b; text-align: right; padding-right: 10mm;">
          Page <span class="pageNumber"></span> of <span class="totalPages"></span>
        </div>
      `
    });

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Length': pdfBuffer.length
    });
    res.send(pdfBuffer);

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  } finally {
    if (browser) await browser.close();
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`PDF Server running on port ${PORT}`);
});