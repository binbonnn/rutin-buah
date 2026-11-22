/* Generate Liquid Glass studio PWA icons — no external dependencies. */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT = path.join(__dirname, '..', 'icons');

/* ---------- minimal PNG writer ---------- */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}
function writePNG(file, size, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const png = Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
  fs.writeFileSync(file, png);
}

/* ---------- drawing helpers (3x supersampled) ---------- */
const SS = 3;
function mix(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
    a[3] + (b[3] - a[3]) * t
  ];
}
function over(dst, src) {
  const a = src[3];
  if (a <= 0) return dst;
  const o = [0, 0, 0, 0];
  for (let i = 0; i < 3; i++) o[i] = Math.round(src[i] * a + dst[i] * (1 - a));
  o[3] = a + dst[3] * (1 - a);
  return o;
}
function render(size, maskable) {
  const S = size * SS;
  const buf = new Float32Array(S * S * 4);
  const set = (x, y, c) => {
    const i = (y * S + x) * 4;
    const a = c[3];
    for (let k = 0; k < 3; k++) buf[i + k] = c[k] * a + buf[i + k] * (1 - a);
    buf[i + 3] = 255 * a + buf[i + 3] * (1 - a);
  };
  const get = (x, y) => {
    const i = (y * S + x) * 4;
    return [buf[i], buf[i + 1], buf[i + 2], buf[i + 3] / 255];
  };
  const top = [203, 210, 220, 1], bottom = [166, 176, 190, 1];
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const t = (x / S + y / S) / 2;
      const c = mix(top, bottom, t);
      const shaft = Math.max(0, 1 - Math.abs((x / S) - (1.25 - y / S)) * 3.4);
      const glow = shaft * shaft * .36;
      set(x, y, [Math.min(255, c[0] + 255 * glow), Math.min(255, c[1] + 255 * glow), Math.min(255, c[2] + 255 * glow), 1]);
    }
  }
  const unit = S / size;
  const pad = maskable ? size * .18 : size * .13;
  const slabX = pad * unit, slabY = pad * unit, slabW = S - 2 * slabX, slabR = (maskable ? size * .18 : size * .26) * unit;
  // shadow
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const dx = Math.max(slabX + slabR - x, 0, x - (slabX + slabW - slabR));
    const dy = Math.max(slabY + slabR - y, 0, y - (S - slabY - slabR));
    const d = Math.hypot(dx, dy);
    if (d < slabR + 5 * unit && y > slabY && x > slabX) {
      const a = Math.max(0, 1 - d / (slabR + 5 * unit)) * .12;
      set(x, y, over(get(x, y), [34, 42, 56, a]));
    }
  }
  // frosted white slab
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const dx = Math.max(slabX + slabR - x, 0, x - (slabX + slabW - slabR));
    const dy = Math.max(slabY + slabR - y, 0, y - (S - slabY - slabR));
    const d = Math.hypot(dx, dy);
    const cover = d <= slabR - unit ? 1 : d >= slabR + unit ? 0 : (slabR + unit - d) / (2 * unit);
    if (cover > 0) {
      const rim = d > slabR - 2.2 * unit ? .95 : .78;
      set(x, y, over(get(x, y), [255, 255, 255, cover * rim]));
    }
  }
  // multi-petal emblem (reference coords scaled from 28x28 viewBox)
  const cx = S / 2, cy = S / 2;
  const scale = (slabW / (maskable ? 82 : 74));
  const petals = [
    { x: 10.5, y: 10.5, r: 4.5, c: [246, 138, 115, 1] },
    { x: 17.5, y: 10.5, r: 4.5, c: [251, 191, 36, 1] },
    { x: 10.5, y: 17.5, r: 4.5, c: [139, 92, 246, 1] },
    { x: 17.5, y: 17.5, r: 4.5, c: [52, 211, 153, 1] }
  ];
  const disc = (px, py, r, color) => {
    for (let y = Math.max(0, Math.floor(py - r - 2)); y < Math.min(S, Math.ceil(py + r + 2)); y++) {
      for (let x = Math.max(0, Math.floor(px - r - 2)); x < Math.min(S, Math.ceil(px + r + 2)); x++) {
        const d = Math.hypot(x + .5 - px, y + .5 - py);
        const a = d <= r - unit ? 1 : d >= r + unit ? 0 : (r + unit - d) / (2 * unit);
        if (a > 0) set(x, y, over(get(x, y), [color[0], color[1], color[2], color[3] * a]));
      }
    }
  };
  petals.forEach((p) => disc(cx + (p.x - 14) * scale, cy + (p.y - 14) * scale, p.r * scale, p.c));
  disc(cx, cy, 2.2 * scale, [255, 255, 255, 1]);

  // downsample
  const out = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let r = 0, g = 0, b = 0, a = 0;
    for (let j = 0; j < SS; j++) for (let i = 0; i < SS; i++) {
      const c = get(x * SS + i, y * SS + j);
      r += c[0]; g += c[1]; b += c[2]; a += c[3] * 255;
    }
    const n = SS * SS, idx = (y * size + x) * 4;
    out[idx] = Math.round(r / n); out[idx + 1] = Math.round(g / n); out[idx + 2] = Math.round(b / n); out[idx + 3] = Math.round(a / n);
  }
  return out;
}

fs.mkdirSync(OUT, { recursive: true });
const targets = [
  ['icon-192.png', 192, false], ['icon-512.png', 512, false],
  ['icon-maskable-192.png', 192, true], ['icon-maskable-512.png', 512, true]
];
for (const [name, size, maskable] of targets) {
  writePNG(path.join(OUT, name), size, render(size, maskable));
  console.log('generated', name);
}
