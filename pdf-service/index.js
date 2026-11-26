const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');
const net = require('net');

const app = express();

// CORS hardening: batasi origin jika ALLOWED_ORIGINS diset di Railway
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Origin tidak diizinkan oleh kebijakan CORS.'));
    },
  })
);
app.use(express.json({ limit: '20mb' }));

/**
 * Memeriksa apakah hostname/IP termasuk jaringan privat, loopback, atau cloud metadata (anti-SSRF).
 */
function isBlockedHost(hostname) {
  const h = String(hostname || '').toLowerCase().replace(/^\[|\]$/g, '');
  if (!h) return true;

  if (
    h === 'localhost' ||
    h === '0.0.0.0' ||
    h === '::1' ||
    h === '::' ||
    h.endsWith('.local') ||
    h.endsWith('.internal') ||
    h.endsWith('.localhost') ||
    h === 'metadata.google.internal'
  ) {
    return true;
  }

  if (net.isIPv4(h)) {
    const parts = h.split('.').map(Number);
    const [a, b] = parts;
    if (a === 127) return true; // 127.0.0.0/8 loopback
    if (a === 10) return true; // 10.0.0.0/8 private
    if (a === 0) return true; // 0.0.0.0/8
    if (a === 169 && b === 254) return true; // 169.254.0.0/16 cloud metadata / link-local
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12 private
    if (a === 192 && b === 168) return true; // 192.168.0.0/16 private
    if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
  }

  if (net.isIPv6(h)) {
    if (
      h === '::1' ||
      h.startsWith('fc') ||
      h.startsWith('fd') ||
      h.startsWith('fe80') ||
      h.startsWith('::ffff:127.') ||
      h.startsWith('::ffff:10.') ||
      h.startsWith('::ffff:169.254.') ||
      h.startsWith('::ffff:192.168.')
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Validasi URL request subresource dari halaman PDF (anti-LFI file:// & anti-SSRF).
 */
function isAllowedRequestUrl(rawUrl) {
  if (!rawUrl) return false;
  if (rawUrl === 'about:blank' || rawUrl.startsWith('data:') || rawUrl.startsWith('blob:')) {
    return true;
  }
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false; // Blokir file://, javascript:, ftp://, chrome://, dll.
    }
    if (isBlockedHost(parsed.hostname)) {
      return false; // Blokir localhost, metadata AWS/GCP/Railway, & IP privat
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Hapus tag <script> agar HTML mentah tidak dapat mengeksekusi JS berbahaya di Chromium.
 */
function stripScripts(html) {
  return String(html).replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
}

app.get('/healthz', (req, res) => {
  res.status(200).send('OK');
});

app.post('/generate-pdf', async (req, res) => {
  // Verifikasi shared secret dari Vercel jika PDF_SERVICE_SECRET dikonfigurasi di Railway
  const expectedSecret = process.env.PDF_SERVICE_SECRET;
  if (expectedSecret) {
    const providedSecret = req.headers['x-pdf-secret'];
    if (providedSecret !== expectedSecret) {
      return res.status(401).json({ error: 'Unauthorized PDF service request' });
    }
  }

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

  try {
    const safeHtml = stripScripts(html);

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

    // Aktifkan Request Interception: blokir LFI (file://) & SSRF (IP privat/metadata)
    await page.setRequestInterception(true);
    page.on('request', (interceptedReq) => {
      const reqUrl = interceptedReq.url();
      if (isAllowedRequestUrl(reqUrl)) {
        interceptedReq.continue();
      } else {
        console.warn(`[PDF Security] Blocked disallowed URL: ${reqUrl.slice(0, 120)}`);
        interceptedReq.abort('blockedbyclient');
      }
    });

    // Gunakan setContent langsung di memori (TANPA menulis temp file / navigasi file://)
    await page.setContent(safeHtml, {
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

    await new Promise((r) => setTimeout(r, 300));

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
      footerTemplate: hasFooter ? stripScripts(footerTemplate) : '',
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
