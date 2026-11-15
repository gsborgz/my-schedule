// Gera os ícones PNG do PWA (sem dependências): um calendário com um "check".
import fs from 'node:fs';
import zlib from 'node:zlib';

const BG = [79, 70, 229]; // #4f46e5
const FG = [255, 255, 255];

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};

function distToSegment(px, py, [ax, ay], [bx, by]) {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function inRoundRect(x, y, x0, y0, x1, y1, r) {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const cx = Math.max(x0 + r, Math.min(x1 - r, x));
  const cy = Math.max(y0 + r, Math.min(y1 - r, y));
  return Math.hypot(x - cx, y - cy) <= r;
}

// Cor de um ponto (coordenadas normalizadas 0..1).
function color(x, y) {
  const ring = (cx) => inRoundRect(x, y, cx - 0.03, 0.22, cx + 0.03, 0.34, 0.03);
  if (ring(0.38) || ring(0.62)) return FG;
  if (inRoundRect(x, y, 0.24, 0.28, 0.76, 0.76, 0.06)) {
    if (y > 0.385 && y < 0.415) return BG; // divisória do cabeçalho
    const check = Math.min(
      distToSegment(x, y, [0.38, 0.58], [0.47, 0.66]),
      distToSegment(x, y, [0.47, 0.66], [0.63, 0.49]),
    );
    if (check < 0.035) return BG;
    return FG;
  }
  return BG;
}

function png(size) {
  const SS = 3; // supersampling para suavizar as bordas
  const raw = Buffer.alloc(size * (size * 3 + 1));
  for (let py = 0; py < size; py++) {
    raw[py * (size * 3 + 1)] = 0;
    for (let px = 0; px < size; px++) {
      const acc = [0, 0, 0];
      for (let sy = 0; sy < SS; sy++)
        for (let sx = 0; sx < SS; sx++) {
          const c = color((px + (sx + 0.5) / SS) / size, (py + (sy + 0.5) / SS) / size);
          for (let i = 0; i < 3; i++) acc[i] += c[i];
        }
      const o = py * (size * 3 + 1) + 1 + px * 3;
      for (let i = 0; i < 3; i++) raw[o + i] = Math.round(acc[i] / (SS * SS));
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const out = 'client/public/icons';
fs.mkdirSync(out, { recursive: true });
for (const [name, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180], ['badge-72.png', 72]]) {
  fs.writeFileSync(`${out}/${name}`, png(size));
}
console.log('Ícones gerados em', out);
