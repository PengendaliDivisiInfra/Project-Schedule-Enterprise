const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { pathToFileURL } = require('url');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.get('/healthz', (req, res) => {
  res.status(200).send('OK');
});

app.post('/generate-pdf', async (req, res) => {
  const {
    html,
    scale,
    format = 'A3',
    isLandscape = true,
    footerTemplate,
    margin,
  } = req.body || {};

  if (!html || typeof html !== 'string') {
    return res.status(400).json({ error: 'HTML content is required' });
  }

  let browser = null;
  const tempFilePath = path.join(
    os.tmpdir(),
    `pdf-${Date.now()}-${Math.random().toString(36).substring(2, 9)}.html`
  );

  try {
    fs.writeFileSync(tempFilePath, html, 'utf-8');

    browser = await puppeteer.launch({
      headless: 'new',
      protocolTimeout: 120000,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--font-render-hinting=none',
        '--js-flags="--max-old-space-size=512"',
      ],
    });

    const page = await browser.newPage();

    await page.goto(pathToFileURL(tempFilePath).href, {
      waitUntil: 'networkidle0',
      timeout: 60000,
    });

    await page.evaluateHandle('document.fonts.ready');
    await page.evaluate(async () => {
      const images = Array.from(document.querySelectorAll('img'));
      await Promise.all(
        images.map((img) => {
          if (img.complete) return Promise.resolve();
          return new Promise((resolve) => {
            const timer = setTimeout(resolve, 10000);
            img.addEventListener('load', () => {
              clearTimeout(timer);
              resolve();
            });
            img.addEventListener('error', () => {
              clearTimeout(timer);
              resolve();
            });
          });
        })
      );
    });

    await new Promise((r) => setTimeout(r, 400));

    const hasFooter = Boolean(footerTemplate && footerTemplate.trim());
    const pdfMargin = {
      top: margin?.top || '12mm',
      right: margin?.right || '12mm',
      bottom: margin?.bottom || (hasFooter ? '24mm' : '15mm'),
      left: margin?.left || '12mm',
    };

    const pdfBuffer = await page.pdf({
      format: format,
      landscape: Boolean(isLandscape),
      printBackground: true,
      preferCSSPageSize: false,
      scale: Number(scale) || 1,
      margin: pdfMargin,
      displayHeaderFooter: hasFooter,
      headerTemplate: '<div style="font-size:0;margin:0;padding:0;"></div>',
      footerTemplate: hasFooter ? footerTemplate : '',
      timeout: 60000,
    });

    console.log(
      `[Railway] PDF Berhasil dibuat (${format}, ${isLandscape ? 'Landscape' : 'Portrait'}, footer=${hasFooter}).`
    );

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Length': pdfBuffer.length,
    });
    res.send(pdfBuffer);
  } catch (error) {
    console.error('=== RAILWAY PDF ERROR ===');
    console.error(error);
    res.status(500).json({ error: error.message || 'Failed to generate PDF' });
  } finally {
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
      } catch (e) {
        console.error('Gagal hapus temp file:', e);
      }
    }
    if (browser) {
      try {
        await browser.close();
      } catch (e) {
        console.error('Gagal tutup browser:', e);
      }
    }
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`PDF Server running on port ${PORT}`);
});