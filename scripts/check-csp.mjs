import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const indexUrl = new URL('../index.html', import.meta.url);
const html = await readFile(indexUrl, 'utf8');
const cspMatch = html.match(
    /<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]+)">/u
);
const jsonLdMatch = html.match(
    /<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/u
);
const endpointMatch = html.match(
    /<script\s+src="js\/redabhr\.js"[\s\S]*?data-video-token-endpoint="([^"]+)"/u
);

if (!cspMatch || !jsonLdMatch || !endpointMatch) {
    throw new Error('CSP, JSON-LD, or video token endpoint is missing from index.html');
}

const csp = cspMatch[1];
const jsonLd = jsonLdMatch[1].replace(/\r\n?/gu, '\n');
const jsonLdHash = createHash('sha256').update(jsonLd, 'utf8').digest('base64');
const hashSource = `'sha256-${jsonLdHash}'`;
const endpointOrigin = new URL(endpointMatch[1]).origin;

if (!csp.includes(hashSource)) {
    throw new Error(`CSP is missing the current JSON-LD hash: ${hashSource}`);
}

if (!csp.includes(endpointOrigin)) {
    throw new Error(`CSP does not allow the video token endpoint: ${endpointOrigin}`);
}

for (const requiredOrigin of ['https://static.cloudflareinsights.com', 'https://cloudflareinsights.com']) {
    if (!csp.includes(requiredOrigin)) {
        throw new Error(`CSP does not allow Cloudflare Web Analytics: ${requiredOrigin}`);
    }
}

if (csp.includes('localhost')) {
    throw new Error('Production CSP must not allow localhost');
}

console.log('CSP checks passed');
