import { access, readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDirectory = join(fileURLToPath(new URL('..', import.meta.url)), '_site');

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walk(path));
    } else {
      files.push(path);
    }
  }
  return files;
}

await access(join(rootDirectory, 'index.html'));
const files = await walk(rootDirectory);
const textExtensions = new Set(['.html', '.css', '.js', '.json', '.txt', '.xml', '.webmanifest']);
const forbiddenPath = /(?:^|[\\/])(scripts|workers|node_modules|\.env|.*\.map)(?:$|[\\/])/iu;
const secretPattern = /(?:BEGIN (?:RSA|OPENSSH|EC) PRIVATE KEY|MUX_SIGNING|PRIVATE_KEY|Bearer\s+[A-Za-z0-9._-]{20,})/iu;
const mixedContentPattern = /(?:src|href|url\()\s*[:=]\s*["']?http:\/\//iu;

for (const file of files) {
  const relativePath = relative(rootDirectory, file);
  if (forbiddenPath.test(relativePath)) {
    throw new Error(`Forbidden file in Pages artifact: ${relativePath}`);
  }

  const extension = relativePath.slice(relativePath.lastIndexOf('.')).toLowerCase();
  if (!textExtensions.has(extension)) {
    continue;
  }

  const contents = await readFile(file, 'utf8');
  if (secretPattern.test(contents)) {
    throw new Error(`Potential secret in Pages artifact: ${relativePath}`);
  }
  if (mixedContentPattern.test(contents)) {
    throw new Error(`Mixed-content URL in Pages artifact: ${relativePath}`);
  }
}

console.log(`Pages artifact checks passed (${files.length} files)`);
