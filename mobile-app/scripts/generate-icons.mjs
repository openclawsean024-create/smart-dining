// Generates simple PWA icons using sharp.
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// __dirname points to scripts/,so parent is mobile-app/
const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, '..', 'public');
await mkdir(outDir, { recursive: true });

function svgFor(size) {
  const fontSize = Math.round(size * 0.45);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${size * 0.18}" ry="${size * 0.18}" fill="#FF6B35"/>
  <text x="50%" y="55%" text-anchor="middle" dominant-baseline="middle"
        font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang TC', 'Noto Sans TC', Roboto, sans-serif"
        font-weight="800" font-size="${fontSize}" fill="#ffffff">SD</text>
</svg>`;
}

async function make(size, name) {
  const svg = Buffer.from(svgFor(size));
  await sharp(svg).png().toFile(resolve(outDir, name));
  console.log('wrote', resolve(outDir, name));
}

await make(192, 'icon-192.png');
await make(512, 'icon-512.png');

const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
<rect width="64" height="64" rx="12" fill="#FF6B35"/>
<text x="50%" y="56%" text-anchor="middle" dominant-baseline="middle"
      font-family="sans-serif" font-weight="800" font-size="30" fill="#fff">SD</text>
</svg>`;
await sharp(Buffer.from(favicon)).toFile(resolve(outDir, 'favicon.svg'));
console.log('wrote', resolve(outDir, 'favicon.svg'));
