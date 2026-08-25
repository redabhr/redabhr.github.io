import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const hlsVersion = '1.7.0';
const sourceUrl = new URL('../node_modules/hls.js/dist/hls.light.min.js', import.meta.url);
const licenseUrl = new URL('../node_modules/hls.js/LICENSE', import.meta.url);
const outputUrl = new URL(`../j/vendor/hls.light.min-${hlsVersion}.js`, import.meta.url);
const outputLicenseUrl = new URL('../j/vendor/hls.js.LICENSE.txt', import.meta.url);

await mkdir(dirname(fileURLToPath(outputUrl)), { recursive: true });

const source = await readFile(sourceUrl, 'utf8');
const withoutSourceMap = source
    .replace(/\r?\n?\/\/# sourceMappingURL=.*$/u, '')
    .trimEnd();

await writeFile(outputUrl, `${withoutSourceMap}\n`, 'utf8');
await copyFile(licenseUrl, outputLicenseUrl);

console.log(`Built ${fileURLToPath(outputUrl)}`);
