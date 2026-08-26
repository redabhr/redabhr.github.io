import { cp, mkdir, rm } from 'node:fs/promises';
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

for (const directory of ['fonts', 'media']) {
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

await cp(join(rootDirectory, 'js', 'vendor'), join(siteDirectory, 'js', 'vendor'), { recursive: true });

console.log(`Production Pages artifact assembled in ${siteDirectory}`);
