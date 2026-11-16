const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');

// URL resmi Sparticuz Chromium (v131.0.0 kompatibel dengan puppeteer-core v25+)
const CHROMIUM_PACK_URL = "https://github.com/Sparticuz/chromium/releases/download/v131.0.0/chromium-v131.0.0-pack.tar";
const DEST_PATH = path.join(process.cwd(), 'public', 'chromium-pack.tar');

async function download() {
  if (fs.existsSync(DEST_PATH)) {
    console.log('✅ Chromium binary sudah ada di public/chromium-pack.tar');
    return;
  }

  console.log('⏳ Mengunduh Chromium binary (~50MB). Mohon tunggu...');
  
  try {
    const response = await fetch(CHROMIUM_PACK_URL);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    // Konversi Web Stream ke Node Stream
    const fileStream = fs.createWriteStream(DEST_PATH);
    const stream = Readable.fromWeb(response.body);
    
    stream.pipe(fileStream);
    
    await new Promise((resolve, reject) => {
      fileStream.on('finish', resolve);
      fileStream.on('error', reject);
      stream.on('error', reject);
    });
    
    console.log('✅ Berhasil: Chromium binary disimpan di public/chromium-pack.tar');
  } catch (error) {
    console.error('❌ Gagal mengunduh Chromium:', error.message);
    if (fs.existsSync(DEST_PATH)) fs.unlinkSync(DEST_PATH); // Bersihkan file rusak
    process.exit(1); // Hentikan proses jika gagal
  }
}

download();