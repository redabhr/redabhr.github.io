import { mkdir } from 'node:fs/promises';
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

await sharp(sourcePath)
  .resize({ width: 1200, height: 630, fit: 'cover', position: 'centre' })
  .jpeg({ quality: 88, progressive: true, mozjpeg: true })
  .toFile(join(outputDirectory, 'og-enterprise-architect.jpg'));

const touchIconSvg = Buffer.from(`
  <svg xmlns="http://www.w3.org/2000/svg" width="180" height="180" viewBox="0 0 180 180">
    <rect width="180" height="180" rx="32" fill="#0d1726"/>
    <rect x="18" y="18" width="144" height="144" rx="24" fill="none" stroke="#e2b98b" stroke-width="3"/>
    <text x="90" y="108" text-anchor="middle" font-family="Arial, sans-serif" font-size="62" font-weight="600" letter-spacing="2" fill="#f5f7fa">RB</text>
  </svg>
`);
await sharp(touchIconSvg)
  .png({ compressionLevel: 9, palette: true })
  .toFile(join(outputDirectory, 'apple-touch-icon.png'));

console.log('Responsive background images generated in media/.');
