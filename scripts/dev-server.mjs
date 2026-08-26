import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDirectory = join(fileURLToPath(new URL('..', import.meta.url)));
const port = Number(process.env.PORT || 8000);
const mimeTypes = {
  '.avif': 'image/avif',
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml; charset=utf-8',
};

function localIndex(html) {
  const muxDataEnvKey = process.env.MUX_DATA_ENV_KEY?.trim() || '';
  return html
    .replace(/\s+data-video-token-endpoint="https:\/\/[^" ]+\/token"/u, '')
    .replace(/data-mux-data-env-key="[^"]*"/u, `data-mux-data-env-key="${muxDataEnvKey.replace(/"/gu, '&quot;')}"`)
    .replace(/https:\/\/reda-background-video-token\.reda-background-video-token\.workers\.dev/gu, 'http://localhost:8787');
}

const server = createServer(async (request, response) => {
  const requestPath = decodeURIComponent((request.url || '/').split('?')[0]);
  const relativePath = requestPath === '/' ? 'index.html' : requestPath.replace(/^\/+/, '');
  const filePath = normalize(join(rootDirectory, relativePath));
  const relativeFilePath = relative(rootDirectory, filePath);

  if (relativeFilePath.startsWith('..') || relativeFilePath.includes(`${String.fromCharCode(92)}..`)) {
    response.writeHead(403).end();
    return;
  }

  try {
    const fileStats = await stat(filePath);
    if (!fileStats.isFile()) {
      response.writeHead(404).end();
      return;
    }

    const contentType = mimeTypes[extname(filePath).toLowerCase()] || 'application/octet-stream';
    response.setHeader('Content-Type', contentType);
    if (relativeFilePath === 'index.html') {
      response.setHeader('Cache-Control', 'no-store');
      response.end(localIndex(await readFile(filePath, 'utf8')));
      return;
    }

    response.setHeader('Cache-Control', 'no-cache');
    createReadStream(filePath).pipe(response);
  } catch {
    response.writeHead(404).end();
  }
});

server.listen(port, 'localhost', () => {
  console.log(`Local site: http://localhost:${port}`);
  console.log('Run the Worker separately on http://localhost:8787 for signed video playback.');
});
