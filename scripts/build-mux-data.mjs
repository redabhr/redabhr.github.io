import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const version = '5.18.0';
const sourceUrl = new URL('../node_modules/mux-embed/dist/mux.js', import.meta.url);
const outputUrl = new URL(`../js/vendor/mux-embed-${version}.js`, import.meta.url);

await mkdir(dirname(fileURLToPath(outputUrl)), { recursive: true });

const source = await readFile(sourceUrl, 'utf8');
const withoutSourceMap = source
    .split(/\r?\n/u)
    .filter((line) => !line.startsWith('//# sourceMappingURL='))
    .join('\n')
    .trimEnd();

await writeFile(outputUrl, `${withoutSourceMap}\n`, 'utf8');
console.log(`Built ${fileURLToPath(outputUrl)}`);
