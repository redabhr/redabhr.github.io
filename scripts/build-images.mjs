import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const rootDirectory = dirname(dirname(fileURLToPath(import.meta.url)));
const sourcePath = join(rootDirectory, 'scripts', 'assets', 'background-master.jpg');
const outputDirectory = join(rootDirectory, 'media');
const landscapeWidths = [1280, 1920, 2560];
const portraitWidths = [480, 720, 1080];

await mkdir(outputDirectory, { recursive: true });

const metadata = await sharp(sourcePath).metadata();
if (!metadata.width || !metadata.height) {
  throw new Error('Unable to read scripts/assets/background-master.jpg dimensions.');
}

const portraitCropWidth = Math.min(Math.round(metadata.height * 3 / 4), metadata.width);
const portraitBuffer = await sharp(sourcePath)
  .extract({
    left: Math.floor((metadata.width - portraitCropWidth) / 2),
    top: 0,
    width: portraitCropWidth,
    height: metadata.height
  })
  .toBuffer();

async function writeFormats(image, basename, includeJpeg = true) {
  await image.clone()
    .avif({ quality: 62, effort: 6, chromaSubsampling: '4:2:0' })
    .toFile(join(outputDirectory, `${basename}.avif`));

  await image.clone()
    .webp({ quality: 84, effort: 6, smartSubsample: true })
    .toFile(join(outputDirectory, `${basename}.webp`));

  if (includeJpeg) {
    await image.clone()
      .jpeg({ quality: 86, progressive: true, mozjpeg: true })
      .toFile(join(outputDirectory, `${basename}.jpg`));
  }
}

for (const width of landscapeWidths) {
  await writeFormats(
    sharp(sourcePath).resize({ width, withoutEnlargement: true }),
    `background-${width}`,
    width !== 2560
  );
}

for (const width of portraitWidths) {
  await writeFormats(
    sharp(portraitBuffer).resize({ width, withoutEnlargement: true }),
    `background-portrait-${width}`
  );
}

// Keep the social preview faithful to the hero while embedding the key profile
// signals directly in the raster asset used by LinkedIn and other crawlers.
const rbRegularFont = (await readFile(join(rootDirectory, 'scripts', 'assets', 'rb-Regular.ttf'))).toString('base64');
const socialCardOverlay = Buffer.from(`
  <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
    <style>
      @font-face { font-family: RB; src: url(data:font/ttf;base64,${rbRegularFont}) format('truetype'); font-weight: 700; }
    </style>
    <rect x="92" y="174" width="64" height="4" rx="2" fill="#e8b879"/>
    <g font-family="RB, Arial, Helvetica, sans-serif" font-weight="700" stroke="#071321" stroke-opacity="0.7" stroke-width="4" paint-order="stroke">
      <text x="92" y="236" fill="#dbe3ea" font-size="38" letter-spacing="2">Réda BOUHADDAR</text>
      <text x="92" y="302" fill="#ffffff" font-size="50">Enterprise Architect</text>
      <text x="92" y="414" fill="#ffffff" font-size="39">Architecting Coherence.</text>
      <text x="92" y="466" fill="#e8b879" font-size="39">Enabling the Future.</text>
    </g>
  </svg>
`);

await sharp(sourcePath)
  .resize({ width: 1200, height: 630, fit: 'cover', position: 'centre' })
  .composite([{ input: socialCardOverlay }])
  .jpeg({ quality: 95, chromaSubsampling: '4:4:4', progressive: false, mozjpeg: true })
  .toFile(join(outputDirectory, 'og-enterprise-architect-v2.jpg'));

const brandIconSvg = Buffer.from(`
  <svg xmlns="http://www.w3.org/2000/svg" width="180" height="180" viewBox="0 0 180 180">
    <rect width="180" height="180" fill="#0d1726"/>
    <text x="90" y="129" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="126" font-weight="700" font-style="italic" fill="#dbe3ea">R</text>
  </svg>
`);
await writeFile(join(outputDirectory, 'favicon.svg'), brandIconSvg);
await sharp(brandIconSvg)
  .resize(180, 180)
  .png({ compressionLevel: 9, palette: true })
  .toFile(join(outputDirectory, 'apple-touch-icon.png'));
await sharp(brandIconSvg).resize(32, 32).png({ compressionLevel: 9, palette: true }).toFile(join(outputDirectory, 'favicon-32.png'));
await sharp(brandIconSvg).resize(16, 16).png({ compressionLevel: 9, palette: true }).toFile(join(outputDirectory, 'favicon-16.png'));

console.log('Responsive background images generated in media/.');
