/**
 * Generates PWA icons from public/brand.svg using sharp.
 * Run with: node scripts/gen-icons.mjs
 *
 * Outputs:
 *   public/icon-192.png          – 192×192 any
 *   public/icon-512.png          – 512×512 any
 *   public/icon-maskable-512.png – 512×512 maskable (glyph inset ~20% safe area)
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const svgPath = resolve(root, 'public', 'brand.svg');
const svgBuffer = readFileSync(svgPath);

async function generate() {
  // icon-192.png — 192×192 any
  await sharp(svgBuffer)
    .resize(192, 192)
    .png()
    .toFile(resolve(root, 'public', 'icon-192.png'));
  console.log('✓ public/icon-192.png');

  // icon-512.png — 512×512 any
  await sharp(svgBuffer)
    .resize(512, 512)
    .png()
    .toFile(resolve(root, 'public', 'icon-512.png'));
  console.log('✓ public/icon-512.png');

  // icon-maskable-512.png — 512×512 maskable
  // Safe area is the inner 80% circle; glyph inset ~20% means we render the
  // SVG at 80% of 512 = 410px and composite it centered on a 512 full-bleed
  // indigo background.
  const CANVAS = 512;
  const GLYPH_SIZE = Math.round(CANVAS * 0.8); // 410px

  // Create indigo background
  const bgBuffer = await sharp({
    create: {
      width: CANVAS,
      height: CANVAS,
      channels: 4,
      background: { r: 52, g: 87, b: 240, alpha: 1 }, // #3457F0
    },
  })
    .png()
    .toBuffer();

  // Render SVG glyph at reduced size (no rounded corners — full bleed bg is already indigo)
  // We create a version of the SVG with no rect (just the glyph on transparent) for compositing.
  // Since our SVG has a rect background, we instead just render the full SVG smaller and
  // composite onto the bg — the rounded corners will be covered by the indigo bg underneath
  // only if we use blend. Simpler: render the maskable SVG which is a variant with square bg.
  const maskableSvg = svgBuffer.toString('utf8')
    // Make the rect fully fill without rounded corners for full-bleed
    .replace(/rx="96" ry="96"/, 'rx="0" ry="0"');

  // Render smaller (GLYPH_SIZE) centered on CANVAS
  const glyphBuffer = await sharp(Buffer.from(maskableSvg))
    .resize(GLYPH_SIZE, GLYPH_SIZE)
    .png()
    .toBuffer();

  const offset = Math.round((CANVAS - GLYPH_SIZE) / 2);

  await sharp(bgBuffer)
    .composite([{ input: glyphBuffer, left: offset, top: offset }])
    .png()
    .toFile(resolve(root, 'public', 'icon-maskable-512.png'));
  console.log('✓ public/icon-maskable-512.png');

  console.log('\nAll icons generated successfully.');
}

generate().catch((err) => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
