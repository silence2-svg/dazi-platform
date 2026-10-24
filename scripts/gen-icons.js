// 生成 PWA 图标（无外部依赖，手写 PNG 编码）
const zlib = require("zlib");
const fs = require("fs");
const path = require("path");

function crc32(buf) {
  let c, t = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = t[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function png(w, h, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = Buffer.alloc(h * (w * 4 + 1));
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function makeIcon(size, maskable) {
  const buf = Buffer.alloc(size * size * 4);
  const cx = size / 2;
  const cy = size / 2;
  const R = maskable ? size * 0.5 : size * 0.22;
  const inner = size * (maskable ? 0.72 : 0.86);
  const c1 = [28, 101, 241];
  const c2 = [21, 80, 222];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const dx = Math.max(R - x, x - (size - R), 0);
      const dy = Math.max(R - y, y - (size - R), 0);
      if (dx * dx + dy * dy > R * R) {
        buf[i + 3] = 0;
        continue;
      }
      const t = (x + y) / (size * 2);
      let r = Math.round(c1[0] + (c2[0] - c1[0]) * t);
      let g = Math.round(c1[1] + (c2[1] - c1[1]) * t);
      let b = Math.round(c1[2] + (c2[2] - c1[2]) * t);

      // 白色图形：两个圆 + 中间连接条（象征"连接/搭子"）
      const rr = inner * 0.2;
      const d1 = Math.hypot(cx - inner * 0.2, cy);
      const d2 = Math.hypot(cx + inner * 0.2, cy);
      const barHalfH = inner * 0.09;
      const inCircle = d1 < rr || d2 < rr;
      const inBar = Math.abs(y - cy) <= barHalfH && Math.abs(x - cx) <= inner * 0.2;
      if (inCircle || inBar) {
        r = 255;
        g = 255;
        b = 255;
      }

      buf[i] = r;
      buf[i + 1] = g;
      buf[i + 2] = b;
      buf[i + 3] = 255;
    }
  }
  return png(size, size, buf);
}

const ROOT = path.join(__dirname, "..");
const outDir = path.join(ROOT, "public", "icons");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "icon-192.png"), makeIcon(192, false));
fs.writeFileSync(path.join(outDir, "icon-512.png"), makeIcon(512, false));
fs.writeFileSync(path.join(outDir, "icon-maskable-512.png"), makeIcon(512, true));
fs.writeFileSync(path.join(ROOT, "public", "favicon.ico"), makeIcon(32, false));
console.log("icons generated ok ->", outDir);
