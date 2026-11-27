// lib/utils/qr-svg.ts
// Zero-dependency ISO/IEC 18004 QR Code Version 4-L (33x33, max 78 UTF-8 bytes)

const SIZE = 33;
const DATA_CODEWORDS = 80;
const EC_CODEWORDS = 20;

function gfMul(a: number, b: number): number {
  let r = 0;
  let x = a;
  let y = b;
  while (y > 0) {
    if (y & 1) r ^= x;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
    y >>= 1;
  }
  return r;
}

function rsGeneratorPoly(degree: number): number[] {
  let poly = [1];
  let exp = 1;
  for (let i = 0; i < degree; i++) {
    const next = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], exp);
    }
    poly = next;
    exp = gfMul(exp, 2);
  }
  return poly;
}

function rsRemainder(data: number[], ecLen: number): number[] {
  const gen = rsGeneratorPoly(ecLen);
  const rem = [...data, ...new Array(ecLen).fill(0)];
  for (let i = 0; i < data.length; i++) {
    const coef = rem[i];
    if (coef !== 0) {
      for (let j = 1; j < gen.length; j++) {
        rem[i + j] ^= gfMul(gen[j], coef);
      }
    }
  }
  return rem.slice(data.length);
}

function encodeBytes(text: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    }
  }
  return bytes.slice(0, 78);
}

function buildCodewords(text: string): number[] {
  const payload = encodeBytes(text);
  const bits: number[] = [];
  const pushBits = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) {
      bits.push((val >> i) & 1);
    }
  };

  // Mode indicator: Byte (0100) + 8-bit length
  pushBits(0b0100, 4);
  pushBits(payload.length, 8);
  for (const b of payload) pushBits(b, 8);

  const maxBits = DATA_CODEWORDS * 8;
  const termLen = Math.min(4, maxBits - bits.length);
  pushBits(0, termLen);
  while (bits.length % 8 !== 0) bits.push(0);

  const data: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i + j];
    data.push(byte);
  }

  let padIdx = 0;
  const pads = [0xec, 0x11];
  while (data.length < DATA_CODEWORDS) {
    data.push(pads[padIdx % 2]);
    padIdx++;
  }

  const ec = rsRemainder(data, EC_CODEWORDS);
  return [...data, ...ec];
}

/**
 * Menghasilkan matriks boolean QR Code Version 4-L (33x33) standar ISO/IEC 18004
 * yang dapat dipindai oleh kamera smartphone secara offline.
 */
export function generateQrMatrix(text: string): boolean[][] {
  const matrix: boolean[][] = Array.from({ length: SIZE }, () => Array(SIZE).fill(false));
  const isFunction: boolean[][] = Array.from({ length: SIZE }, () => Array(SIZE).fill(false));

  const setFn = (r: number, c: number, dark: boolean) => {
    if (r < 0 || r >= SIZE || c < 0 || c >= SIZE) return;
    matrix[r][c] = dark;
    isFunction[r][c] = true;
  };

  // 1. Finder patterns + separators (top-left, top-right, bottom-left)
  const drawFinder = (tr: number, tc: number) => {
    for (let dr = -1; dr <= 7; dr++) {
      for (let dc = -1; dc <= 7; dc++) {
        const r = tr + dr;
        const c = tc + dc;
        if (r < 0 || r >= SIZE || c < 0 || c >= SIZE) continue;
        const inOuter = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6;
        const onBorder = dr === 0 || dr === 6 || dc === 0 || dc === 6;
        const inInner = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4;
        setFn(r, c, inOuter && (onBorder || inInner));
      }
    }
  };
  drawFinder(0, 0);
  drawFinder(0, SIZE - 7);
  drawFinder(SIZE - 7, 0);

  // 2. Alignment pattern for Version 4 at (26, 26)
  for (let dr = -2; dr <= 2; dr++) {
    for (let dc = -2; dc <= 2; dc++) {
      const dark = Math.max(Math.abs(dr), Math.abs(dc)) !== 1;
      setFn(26 + dr, 26 + dc, dark);
    }
  }

  // 3. Timing patterns
  for (let i = 8; i < SIZE - 8; i++) {
    setFn(6, i, i % 2 === 0);
    setFn(i, 6, i % 2 === 0);
  }

  // 4. Dark module + reserve format info areas
  setFn(SIZE - 8, 8, true);
  for (let i = 0; i <= 8; i++) {
    if (!isFunction[8][i]) setFn(8, i, false);
    if (!isFunction[i][8]) setFn(i, 8, false);
  }
  for (let i = SIZE - 8; i < SIZE; i++) {
    if (!isFunction[8][i]) setFn(8, i, false);
    if (!isFunction[i][8]) setFn(i, 8, false);
  }

  // 5. Place data + EC bits in standard upward/downward zigzag
  const codewords = buildCodewords(text);
  const allBits: number[] = [];
  for (const cw of codewords) {
    for (let b = 7; b >= 0; b--) allBits.push((cw >> b) & 1);
  }

  let bitIdx = 0;
  let upward = true;
  for (let col = SIZE - 1; col >= 1; col -= 2) {
    if (col === 6) col = 5;
    for (let i = 0; i < SIZE; i++) {
      const row = upward ? SIZE - 1 - i : i;
      for (let dc = 0; dc < 2; dc++) {
        const c = col - dc;
        if (!isFunction[row][c]) {
          const bit = bitIdx < allBits.length ? allBits[bitIdx++] === 1 : false;
          // Apply mask pattern 0: (row + col) % 2 === 0
          matrix[row][c] = (row + c) % 2 === 0 ? !bit : bit;
        }
      }
    }
    upward = !upward;
  }

  // 6. Write format info for ECC Level L (01) + Mask 0 (000) -> 0x77C4 (15 bits: 111011111000100)
  const formatBits = 0x77c4;
  const bitAt = (idx: number) => ((formatBits >> idx) & 1) === 1;

  // Around top-left finder
  const tlCoords: Array<[number, number]> = [
    [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8],
    [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8],
  ];
  for (let i = 0; i < 15; i++) {
    const [r, c] = tlCoords[i];
    matrix[r][c] = bitAt(14 - i);
  }

  // Split between bottom-left and top-right
  for (let i = 0; i < 7; i++) {
    matrix[SIZE - 1 - i][8] = bitAt(14 - i);
  }
  for (let i = 7; i < 15; i++) {
    matrix[8][SIZE - 15 + i] = bitAt(14 - i);
  }

  return matrix;
}

/**
 * Mengembalikan markup SVG QR Code bersih (quiet zone 4 modul) siap cetak/tampil.
 */
export function generateQrSvg(text: string, pixelSize: number = 160): string {
  const matrix = generateQrMatrix(text);
  const quiet = 4;
  const total = SIZE + quiet * 2;
  const rects: string[] = [];

  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (matrix[r][c]) {
        rects.push(`<rect x="${c + quiet}" y="${r + quiet}" width="1" height="1"/>`);
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="${pixelSize}" height="${pixelSize}" shape-rendering="crispEdges"><rect width="${total}" height="${total}" fill="#ffffff"/><g fill="#0f172a">${rects.join('')}</g></svg>`;
}
