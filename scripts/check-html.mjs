import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDirectory = join(fileURLToPath(new URL('..', import.meta.url)));
const html = await readFile(join(rootDirectory, 'index.html'), 'utf8');

const assertions = [
  [([...html.matchAll(/<h1\b/gu)].length === 1), 'index.html must contain exactly one h1'],
  [html.includes('rel="canonical"'), 'canonical link is missing'],
  [html.includes('name="description"'), 'meta description is missing'],
  [html.includes('type="application/ld+json"'), 'JSON-LD is missing'],
  [html.includes('href="css/redabhr.css"'), 'current CSS path is missing'],
  [html.includes('src="js/redabhr.js"'), 'current JS path is missing'],
  [!/(?:href|src)="(?:j|s)\//u.test(html), 'legacy j/ or s/ asset path remains'],
  [!html.includes('youtube'), 'YouTube references remain in index.html'],
  [!/(?:MUX_SIGNING|PRIVATE_KEY|BEGIN RSA|Bearer\s)/iu.test(html), 'video signing secret appears in index.html'],
];

for (const [valid, message] of assertions) {
  if (!valid) {
    throw new Error(message);
  }
}

for (const asset of [
  'css/redabhr.css',
  'js/redabhr.js',
  'js/vendor/hls.light.min-1.7.0.js',
  'media/favicon.svg',
  'media/apple-touch-icon.png',
  '.well-known/security.txt',
]) {
  await access(join(rootDirectory, asset));
}

console.log('HTML and published asset checks passed');
