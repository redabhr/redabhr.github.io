const TOKEN_PATH = '/token';
const PLAYBACK_ID_PATTERN = /^[A-Za-z0-9_-]{10,255}$/u;
const ALLOWED_RESOLUTIONS = new Set([
    '270p', '360p', '480p', '540p', '720p', '1080p', '1440p', '2160p'
]);
const MIN_TOKEN_TTL_SECONDS = 30;
const MAX_TOKEN_TTL_SECONDS = 300;
const textEncoder = new TextEncoder();
const privateKeyCache = new Map();

export default {
    async fetch(request, env) {
        return handleRequest(request, env);
    }
};

export async function handleRequest(request, env) {
    const requestUrl = new URL(request.url);
    const requestOrigin = normalizeOrigin(request.headers.get('Origin'));
    let allowedOrigins;

    try {
        allowedOrigins = parseAllowedOrigins(env.ALLOWED_ORIGINS);
    } catch (error) {
        console.error('Invalid Worker origin configuration', error);
        return jsonResponse(503, { error: 'Video unavailable' });
    }

    const corsOrigin = allowedOrigins.has(requestOrigin) ? requestOrigin : undefined;

    if (requestUrl.pathname !== TOKEN_PATH) {
        return jsonResponse(404, { error: 'Not found' });
    }

    if (request.method === 'OPTIONS') {
        if (!requestOrigin || !allowedOrigins.has(requestOrigin)) {
            return jsonResponse(403, { error: 'Forbidden' });
        }

        return new Response(null, {
            status: 204,
            headers: responseHeaders(requestOrigin, {
                'Access-Control-Allow-Headers': 'Accept',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Max-Age': '3600'
            })
        });
    }

    if (request.method !== 'GET') {
        return jsonResponse(405, { error: 'Method not allowed' }, corsOrigin, {
            Allow: 'GET, OPTIONS'
        });
    }

    if (!isAllowedBrowserRequest(request, requestOrigin, allowedOrigins)) {
        return jsonResponse(403, { error: 'Forbidden' });
    }

    const variant = requestUrl.searchParams.get('variant') || 'landscape';
    if (!['landscape', 'portrait'].includes(variant)) {
        return jsonResponse(400, { error: 'Invalid video variant' }, requestOrigin);
    }

    try {
        await enforceRateLimit(request, env);
        const config = readConfig(env);
        const playbackId = variant === 'portrait' && config.portraitPlaybackId
            ? config.portraitPlaybackId
            : config.landscapePlaybackId;
        const selectedVariant = playbackId === config.portraitPlaybackId ? 'portrait' : 'landscape';
        const maxResolution = variant === 'portrait'
            ? config.maxPortraitResolution
            : config.maxLandscapeResolution;
        const expiresAt = Math.floor(Date.now() / 1000) + config.tokenTtlSeconds;
        const token = await signMuxPlaybackJwt({
            playbackId,
            keyId: config.signingKeyId,
            privateKey: config.privateKey,
            restrictionId: config.playbackRestrictionId,
            maxResolution,
            expiresAt
        });
        const playbackUrl = new URL(`https://stream.mux.com/${playbackId}.m3u8`);

        playbackUrl.searchParams.set('token', token);

        return jsonResponse(200, {
            url: playbackUrl.toString(),
            expiresAt,
            variant: selectedVariant,
            maxResolution
        }, requestOrigin);
    } catch (error) {
        if (error instanceof RateLimitError) {
            return jsonResponse(429, { error: 'Too many requests' }, requestOrigin, {
                'Retry-After': '60'
            });
        }

        console.error('Unable to issue background video token', error);
        return jsonResponse(503, { error: 'Video unavailable' }, requestOrigin);
    }
}

export async function signMuxPlaybackJwt({
    playbackId,
    keyId,
    privateKey,
    restrictionId,
    maxResolution,
    expiresAt
}) {
    const header = base64UrlEncode(textEncoder.encode(JSON.stringify({
        alg: 'RS256',
        typ: 'JWT'
    })));
    const claims = base64UrlEncode(textEncoder.encode(JSON.stringify({
        sub: playbackId,
        aud: 'v',
        exp: expiresAt,
        kid: keyId,
        playback_restriction_id: restrictionId,
        max_resolution: maxResolution
    })));
    const unsignedToken = `${header}.${claims}`;
    const key = await importMuxPrivateKey(privateKey, keyId);
    const signature = await crypto.subtle.sign(
        'RSASSA-PKCS1-v1_5',
        key,
        textEncoder.encode(unsignedToken)
    );

    return `${unsignedToken}.${base64UrlEncode(new Uint8Array(signature))}`;
}

function readConfig(env) {
    const landscapePlaybackId = requiredIdentifier(
        env.MUX_PLAYBACK_ID_LANDSCAPE,
        'MUX_PLAYBACK_ID_LANDSCAPE'
    );
    const portraitPlaybackId = optionalIdentifier(
        env.MUX_PLAYBACK_ID_PORTRAIT,
        'MUX_PLAYBACK_ID_PORTRAIT'
    );
    const playbackRestrictionId = requiredIdentifier(
        env.MUX_PLAYBACK_RESTRICTION_ID,
        'MUX_PLAYBACK_RESTRICTION_ID'
    );
    const signingKeyId = requiredIdentifier(env.MUX_SIGNING_KEY_ID, 'MUX_SIGNING_KEY_ID');
    const privateKey = requiredValue(env.MUX_SIGNING_PRIVATE_KEY, 'MUX_SIGNING_PRIVATE_KEY');
    const maxLandscapeResolution = readResolution(
        env.MAX_LANDSCAPE_RESOLUTION || '1080p',
        'MAX_LANDSCAPE_RESOLUTION'
    );
    const maxPortraitResolution = readResolution(
        env.MAX_PORTRAIT_RESOLUTION || '720p',
        'MAX_PORTRAIT_RESOLUTION'
    );
    const parsedTtl = Number.parseInt(env.TOKEN_TTL_SECONDS || '60', 10);

    if (!Number.isInteger(parsedTtl)
        || parsedTtl < MIN_TOKEN_TTL_SECONDS
        || parsedTtl > MAX_TOKEN_TTL_SECONDS) {
        throw new Error(
            `TOKEN_TTL_SECONDS must be between ${MIN_TOKEN_TTL_SECONDS} and ${MAX_TOKEN_TTL_SECONDS}`
        );
    }

    return {
        landscapePlaybackId,
        portraitPlaybackId,
        playbackRestrictionId,
        signingKeyId,
        privateKey,
        maxLandscapeResolution,
        maxPortraitResolution,
        tokenTtlSeconds: parsedTtl
    };
}

function isAllowedBrowserRequest(request, requestOrigin, allowedOrigins) {
    if (!requestOrigin || !allowedOrigins.has(requestOrigin)) {
        return false;
    }

    const referer = request.headers.get('Referer');
    const userAgent = request.headers.get('User-Agent');

    if (!referer || !userAgent) {
        return false;
    }

    try {
        return allowedOrigins.has(new URL(referer).origin);
    } catch {
        return false;
    }
}

async function enforceRateLimit(request, env) {
    if (!env.VIDEO_TOKEN_RATE_LIMITER) {
        return;
    }

    const clientAddress = request.headers.get('CF-Connecting-IP') || 'unknown-client';
    const { success } = await env.VIDEO_TOKEN_RATE_LIMITER.limit({ key: clientAddress });

    if (!success) {
        throw new RateLimitError();
    }
}

async function importMuxPrivateKey(encodedPrivateKey, keyId) {
    const cacheKey = `${keyId}:${encodedPrivateKey.length}`;

    if (!privateKeyCache.has(cacheKey)) {
        if (privateKeyCache.size > 1) {
            privateKeyCache.clear();
        }

        const privateKeyDer = decodeMuxPrivateKey(encodedPrivateKey);
        privateKeyCache.set(cacheKey, crypto.subtle.importKey(
            'pkcs8',
            privateKeyDer,
            {
                name: 'RSASSA-PKCS1-v1_5',
                hash: 'SHA-256'
            },
            false,
            ['sign']
        ));
    }

    return privateKeyCache.get(cacheKey);
}

function decodeMuxPrivateKey(value) {
    let pem = requiredValue(value, 'MUX_SIGNING_PRIVATE_KEY');

    if (!pem.includes('-----BEGIN')) {
        pem = bytesToAscii(decodeBase64(pem));
    }

    const pkcs8Match = pem.match(
        /-----BEGIN PRIVATE KEY-----([\s\S]+?)-----END PRIVATE KEY-----/u
    );
    if (pkcs8Match) {
        return decodeBase64(pkcs8Match[1]);
    }

    const pkcs1Match = pem.match(
        /-----BEGIN RSA PRIVATE KEY-----([\s\S]+?)-----END RSA PRIVATE KEY-----/u
    );
    if (pkcs1Match) {
        return wrapPkcs1InPkcs8(decodeBase64(pkcs1Match[1]));
    }

    throw new Error('MUX_SIGNING_PRIVATE_KEY is not a supported RSA PEM key');
}

function wrapPkcs1InPkcs8(pkcs1) {
    const version = new Uint8Array([0x02, 0x01, 0x00]);
    const rsaAlgorithmIdentifier = new Uint8Array([
        0x30, 0x0d,
        0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01,
        0x05, 0x00
    ]);
    const privateKeyOctetString = encodeDer(0x04, pkcs1);

    return encodeDer(0x30, concatBytes(version, rsaAlgorithmIdentifier, privateKeyOctetString));
}

function encodeDer(tag, value) {
    return concatBytes(new Uint8Array([tag]), encodeDerLength(value.length), value);
}

function encodeDerLength(length) {
    if (length < 0x80) {
        return new Uint8Array([length]);
    }

    const bytes = [];
    let remaining = length;
    while (remaining > 0) {
        bytes.unshift(remaining & 0xff);
        remaining >>>= 8;
    }

    return new Uint8Array([0x80 | bytes.length, ...bytes]);
}

function concatBytes(...arrays) {
    const output = new Uint8Array(arrays.reduce((length, value) => length + value.length, 0));
    let offset = 0;

    for (const value of arrays) {
        output.set(value, offset);
        offset += value.length;
    }

    return output;
}

function base64UrlEncode(bytes) {
    let binary = '';
    for (let index = 0; index < bytes.length; index += 1) {
        binary += String.fromCharCode(bytes[index]);
    }

    return btoa(binary)
        .replaceAll('+', '-')
        .replaceAll('/', '_')
        .replace(/=+$/u, '');
}

function decodeBase64(value) {
    const normalized = value.replace(/\s/gu, '');
    let binary;

    try {
        binary = atob(normalized);
    } catch {
        throw new Error('Invalid base64 private key');
    }

    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
    }

    return bytes;
}

function bytesToAscii(bytes) {
    let value = '';
    for (let index = 0; index < bytes.length; index += 1) {
        value += String.fromCharCode(bytes[index]);
    }

    return value;
}

function parseAllowedOrigins(value) {
    const origins = new Set();

    for (const candidate of String(value || '').split(',')) {
        const origin = normalizeOrigin(candidate);
        if (origin) {
            origins.add(origin);
        }
    }

    if (origins.size === 0) {
        throw new Error('ALLOWED_ORIGINS must contain at least one HTTPS origin');
    }

    return origins;
}

function normalizeOrigin(value) {
    if (!value) {
        return undefined;
    }

    try {
        const url = new URL(value.trim());
        if (url.protocol !== 'https:' && url.hostname !== 'localhost') {
            return undefined;
        }

        return url.origin;
    } catch {
        return undefined;
    }
}


function requiredIdentifier(value, name) {
    const identifier = requiredValue(value, name);
    if (!PLAYBACK_ID_PATTERN.test(identifier)) {
        throw new Error(`${name} is invalid`);
    }

    return identifier;
}

function optionalIdentifier(value, name) {
    if (!value) {
        return undefined;
    }

    return requiredIdentifier(value, name);
}

function readResolution(value, name) {
    const resolution = requiredValue(value, name);
    if (!ALLOWED_RESOLUTIONS.has(resolution)) {
        throw new Error(`${name} is invalid`);
    }

    return resolution;
}

function requiredValue(value, name) {
    const normalized = String(value || '').trim();
    if (!normalized) {
        throw new Error(`${name} is required`);
    }

    return normalized;
}

function responseHeaders(origin, extraHeaders = {}) {
    return {
        'Cache-Control': 'no-store, max-age=0',
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
        'Permissions-Policy': 'camera=(), geolocation=(), microphone=()',
        'Referrer-Policy': 'no-referrer',
        'Vary': 'Origin',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        ...(origin ? { 'Access-Control-Allow-Origin': origin } : {}),
        ...extraHeaders
    };
}

function jsonResponse(status, body, origin, extraHeaders) {
    return new Response(JSON.stringify(body), {
        status,
        headers: responseHeaders(origin, extraHeaders)
    });
}

class RateLimitError extends Error {}
