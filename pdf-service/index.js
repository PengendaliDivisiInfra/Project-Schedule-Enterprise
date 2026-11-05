const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');

const app = express();
app.use(cors()); // Izinkan request dari domain Vercel Anda
app.use(express.json({ limit: '50mb' })); // Naikkan limit payload karena HTML bisa besar

app.post('/generate-pdf', async (req, res) => {
  const { html, scale } = req.body;
  let browser = null;

  try {
    // Gunakan Puppeteer standar (bukan serverless)
    browser = await puppeteer.launch({
      headless: "new",
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    
    // Set konten
    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 60000 });
    
    // Beri waktu CSS render
    await new Promise(r => setTimeout(r, 1000));

    // Generate PDF
    const pdfBuffer = await page.pdf({
      format: 'A3',
      landscape: true,
      printBackground: true,
      scale: scale || 1,
      margin: { top: '10mm', right: '10mm', bottom: '15mm', left: '10mm' }
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

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`PDF Server running on port ${PORT}`);
});