import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const rootDirectory = join(fileURLToPath(new URL('..', import.meta.url)));
const siteDirectory = join(rootDirectory, '_site');

await rm(siteDirectory, { recursive: true, force: true });
await mkdir(siteDirectory, { recursive: true });

for (const file of ['index.html', 'CNAME', 'favicon.ico', 'robots.txt', 'sitemap.xml']) {
  await cp(join(rootDirectory, file), join(siteDirectory, file));
}

for (const directory of ['fonts', 'media', '.well-known']) {
  await cp(join(rootDirectory, directory), join(siteDirectory, directory), { recursive: true });
}

await esbuild.build({
  entryPoints: [join(rootDirectory, 'js', 'redabhr.js')],
  outfile: join(siteDirectory, 'js', 'redabhr.js'),
  bundle: false,
  minify: true,
  sourcemap: false,
  legalComments: 'none',
});

await esbuild.build({
  entryPoints: [join(rootDirectory, 'css', 'redabhr.css')],
  outfile: join(siteDirectory, 'css', 'redabhr.css'),
  minify: true,
  sourcemap: false,
  legalComments: 'none',
});

const sourceHtml = await readFile(join(rootDirectory, 'index.html'), 'utf8');
const jsonLdMarker = /(<script\s+type="application\/ld\+json">)[\s\S]*?(<\/script>)/u;
const jsonLdBlock = sourceHtml.match(jsonLdMarker)?.[0];
if (!jsonLdBlock) {
  throw new Error('JSON-LD block is missing from index.html.');
}

const muxDataEnvKey = process.env.MUX_DATA_ENV_KEY?.trim() || '';
const htmlWithPublicConfig = sourceHtml.replace(
  /data-mux-data-env-key="[^"]*"/u,
  `data-mux-data-env-key="${muxDataEnvKey.replace(/"/gu, '&quot;')}"`
);
const htmlOutsideJsonLd = htmlWithPublicConfig.replace(jsonLdBlock, '__JSON_LD_BLOCK__');
const minifiedHtml = htmlOutsideJsonLd
  .replace(/<!--[\s\S]*?-->/gu, '')
  .replace(/>\s+</gu, '><')
  .trim()
  .replace('__JSON_LD_BLOCK__', jsonLdBlock);
await writeFile(join(siteDirectory, 'index.html'), `${minifiedHtml}\n`, 'utf8');

await cp(join(rootDirectory, 'js', 'vendor'), join(siteDirectory, 'js', 'vendor'), { recursive: true });

console.log(`Production Pages artifact assembled in ${siteDirectory}`);
