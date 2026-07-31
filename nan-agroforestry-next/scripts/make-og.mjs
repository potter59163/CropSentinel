/**
 * Generate the Open Graph share image.
 *
 *   node scripts/make-og.mjs
 *
 * Writes src/app/opengraph-image.png, which Next.js picks up by filename convention and
 * serves for both og:image and twitter:image.
 *
 * Rendered to a STATIC png at authoring time rather than generated per request with
 * next/og, for one reason: next/og (satori) needs an embedded font buffer to draw Thai, so
 * a runtime route would mean committing a Noto Sans Thai binary and loading it on every
 * crawler hit. The image never varies, so there is nothing to gain. sharp rasterises the
 * SVG below using system fonts, which handle Thai correctly.
 *
 * The design has to survive being shown at ~250 px wide in a LINE chat — LINE is how this
 * gets shared with farmers and officers — so the brand mark is oversized, the type is few
 * and large, and nothing depends on reading the small print.
 */
import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '..', 'src', 'app', 'opengraph-image.png');

const W = 1200;
const H = 630;

// Brand tokens, matching src/styles/field-override.css so the card and the app agree.
const SUGAR_1 = '#0c6654';
const SUGAR_2 = '#07483e';
const INK = '#062b25';
const OK = '#2f8f5b';
const HONEY = '#dba93a';
const TARO = '#4aa3c7';
const MIST = '#bfe3d6';

/** The 4 agroforestry strata, drawn as stacked bands — the product's core idea in one glance. */
const LAYERS = [
  { th: 'ไม้ยืนต้น', y: 208, h: 60, fill: OK, w: 446 },
  { th: 'ไม้พุ่ม', y: 280, h: 52, fill: '#4f9f5f', w: 386 },
  { th: 'ไม้คลุมดิน', y: 344, h: 46, fill: HONEY, w: 326 },
  { th: 'ไม้ลงดิน', y: 402, h: 46, fill: '#a8763f', w: 266 },
];

const SOURCES = ['NASA POWER', 'GISTDA', 'SoilGrids', 'กรมพัฒนาที่ดิน'];

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${SUGAR_1}"/>
      <stop offset="55%" stop-color="${SUGAR_2}"/>
      <stop offset="100%" stop-color="${INK}"/>
    </linearGradient>
    <linearGradient id="fade" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.10"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <circle cx="1010" cy="120" r="300" fill="url(#fade)"/>

  <!-- brand mark: a stylised canopy over a trunk -->
  <g transform="translate(74,74)">
    <circle cx="34" cy="30" r="30" fill="none" stroke="${MIST}" stroke-width="4" opacity="0.55"/>
    <path d="M34 8 C20 22 20 34 34 46 C48 34 48 22 34 8 Z" fill="${MIST}"/>
    <rect x="31" y="44" width="6" height="20" rx="3" fill="${MIST}"/>
  </g>

  <text x="152" y="118" font-family="Noto Sans Thai, Thonburi, sans-serif" font-size="82" font-weight="700" fill="#ffffff">น่านไง</text>
  <text x="152" y="160" font-family="Helvetica Neue, Arial, sans-serif" font-size="30" font-weight="600" fill="${MIST}" letter-spacing="0.5">Nan Agroforestry Planner</text>

  <text x="74" y="240" font-family="Noto Sans Thai, Thonburi, sans-serif" font-size="40" font-weight="700" fill="#ffffff">ออกแบบระบบวนเกษตร 4 ชั้น</text>
  <text x="74" y="296" font-family="Noto Sans Thai, Thonburi, sans-serif" font-size="30" fill="${MIST}">ให้ตรงกับแปลงของคุณ จากข้อมูลจริง</text>
  <text x="74" y="344" font-family="Noto Sans Thai, Thonburi, sans-serif" font-size="30" fill="${MIST}">พร้อมรายได้ 10 ปี จุดคืนทุน คาร์บอน</text>

  <!-- strata diagram -->
  <g transform="translate(680,0)">
    ${LAYERS.map((l) => `
    <rect x="0" y="${l.y}" width="${l.w}" height="${l.h}" rx="${l.h / 2}" fill="${l.fill}" opacity="0.92"/>
    <text x="26" y="${l.y + l.h / 2 + 11}" font-family="Noto Sans Thai, Thonburi, sans-serif" font-size="27" font-weight="600" fill="${INK}">${l.th}</text>`).join('')}
  </g>

  <!-- data provenance strip: the reason to trust it -->
  <g transform="translate(74,522)">
    ${SOURCES.map((s, i) => {
      const x = i * 268;
      return `<circle cx="${x + 7}" cy="-8" r="5" fill="${TARO}"/>
    <text x="${x + 24}" y="0" font-family="Noto Sans Thai, Helvetica Neue, Arial, sans-serif" font-size="25" fill="${MIST}">${s}</text>`;
    }).join('')}
  </g>

  <rect x="0" y="${H - 10}" width="${W}" height="10" fill="${OK}"/>
</svg>`;

mkdirSync(dirname(OUT), { recursive: true });
const buf = await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
writeFileSync(OUT, buf);
const meta = await sharp(buf).metadata();
console.log(`wrote ${OUT}  ${meta.width}x${meta.height}  ${(buf.length / 1024).toFixed(0)} KB`);
