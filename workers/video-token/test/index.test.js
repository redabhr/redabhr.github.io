import assert from 'node:assert/strict';
import { generateKeyPairSync, verify } from 'node:crypto';
import { before, describe, it } from 'node:test';

import worker, { signMuxPlaybackJwt } from '../src/index.js';

const allowedOrigin = 'https://reda.bouhaddar.com';
const playbackId = 'landscapePlayback123';
const restrictionId = 'restrictionPlayback123';
const keyId = 'signingKeyIdentifier123';

let encodedPrivateKey;
let publicKey;

before(() => {
    const keyPair = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const privateKeyPem = keyPair.privateKey.export({ type: 'pkcs1', format: 'pem' });

    encodedPrivateKey = Buffer.from(privateKeyPem).toString('base64');
    publicKey = keyPair.publicKey;
});

describe('Mux JWT signing', () => {
    it('signs the claims required by Mux with a base64-encoded PKCS#1 key', async () => {
        const expiresAt = Math.floor(Date.now() / 1000) + 60;
        const token = await signMuxPlaybackJwt({
            playbackId,
            keyId,
            privateKey: encodedPrivateKey,
            restrictionId,
            maxResolution: '1080p',
            expiresAt
        });
        const [encodedHeader, encodedClaims, encodedSignature] = token.split('.');
        const header = JSON.parse(Buffer.from(encodedHeader, 'base64url').toString('utf8'));
        const claims = JSON.parse(Buffer.from(encodedClaims, 'base64url').toString('utf8'));

        assert.deepEqual(header, { alg: 'RS256', typ: 'JWT' });
        assert.deepEqual(claims, {
            sub: playbackId,
            aud: 'v',
            exp: expiresAt,
            kid: keyId,
            playback_restriction_id: restrictionId,
            max_resolution: '1080p'
        });
        assert.equal(verify(
            'RSA-SHA256',
            Buffer.from(`${encodedHeader}.${encodedClaims}`),
            publicKey,
            Buffer.from(encodedSignature, 'base64url')
        ), true);
    });
});

describe('video token endpoint', () => {
    it('returns a short-lived signed landscape URL for the allowed site', async () => {
        let rateLimitKey;
        const env = createEnvironment({
            VIDEO_TOKEN_RATE_LIMITER: {
                async limit({ key }) {
                    rateLimitKey = key;
                    return { success: true };
                }
            }
        });
        const response = await worker.fetch(createRequest(), env);
        const body = await response.json();
        const url = new URL(body.url);

        assert.equal(response.status, 200);
        assert.equal(response.headers.get('Access-Control-Allow-Origin'), allowedOrigin);
        assert.equal(response.headers.get('Cache-Control'), 'no-store, max-age=0');
        assert.equal(response.headers.get('Content-Security-Policy'), "default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
        assert.equal(response.headers.get('Permissions-Policy'), 'camera=(), geolocation=(), microphone=()');
        assert.equal(response.headers.get('X-Frame-Options'), 'DENY');
        assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
        assert.equal(url.origin, 'https://stream.mux.com');
        assert.equal(url.pathname, `/${playbackId}.m3u8`);
        assert.equal(url.searchParams.get('token').split('.').length, 3);
        assert.equal(body.variant, 'landscape');
        assert.equal(body.maxResolution, '1080p');
        assert.ok(body.expiresAt > Math.floor(Date.now() / 1000));
        assert.equal(rateLimitKey, '203.0.113.10');
    });

    it('falls back to the landscape asset until a portrait asset is configured', async () => {
        const response = await worker.fetch(createRequest('?variant=portrait'), createEnvironment());
        const body = await response.json();

        assert.equal(response.status, 200);
        assert.equal(body.variant, 'landscape');
        assert.equal(body.maxResolution, '720p');
        assert.match(body.url, new RegExp(`/${playbackId}\\.m3u8\\?token=`));
    });

    it('returns the dedicated portrait asset when it is configured', async () => {
        const portraitPlaybackId = 'portraitPlayback123';
        const response = await worker.fetch(createRequest('?variant=portrait'), createEnvironment({
            MUX_PLAYBACK_ID_PORTRAIT: portraitPlaybackId
        }));
        const body = await response.json();
        const claims = decodeJwtClaims(new URL(body.url).searchParams.get('token'));

        assert.equal(response.status, 200);
        assert.equal(body.variant, 'portrait');
        assert.equal(body.maxResolution, '720p');
        assert.match(body.url, new RegExp(`/${portraitPlaybackId}\\.m3u8\\?token=`));
        assert.equal(claims.sub, portraitPlaybackId);
        assert.equal(claims.max_resolution, '720p');
    });

    it('issues a restricted token for a configured localhost origin', async () => {
        const localOrigin = 'http://localhost:8000';
        const response = await worker.fetch(createRequest('', localOrigin), createEnvironment({
            ALLOWED_ORIGINS: localOrigin
        }));
        const body = await response.json();
        const claims = decodeJwtClaims(new URL(body.url).searchParams.get('token'));

        assert.equal(response.status, 200);
        assert.equal(response.headers.get('Access-Control-Allow-Origin'), localOrigin);
        assert.equal(claims.playback_restriction_id, restrictionId);
    });

    it('rejects missing browser provenance and invalid variants', async () => {
        const missingOrigin = await worker.fetch(
            new Request('https://token.example/token'),
            createEnvironment()
        );
        const invalidVariant = await worker.fetch(
            createRequest('?variant=square'),
            createEnvironment()
        );

        assert.equal(missingOrigin.status, 403);
        assert.equal(invalidVariant.status, 400);
    });

    it('returns 429 when the Cloudflare binding rejects the client', async () => {
        const response = await worker.fetch(createRequest(), createEnvironment({
            VIDEO_TOKEN_RATE_LIMITER: {
                async limit() {
                    return { success: false };
                }
            }
        }));

        assert.equal(response.status, 429);
        assert.equal(response.headers.get('Retry-After'), '60');
    });
});

function createEnvironment(overrides = {}) {
    return {
        ALLOWED_ORIGINS: allowedOrigin,
        MUX_PLAYBACK_ID_LANDSCAPE: playbackId,
        MUX_PLAYBACK_ID_PORTRAIT: '',
        MUX_PLAYBACK_RESTRICTION_ID: restrictionId,
        MUX_SIGNING_KEY_ID: keyId,
        MUX_SIGNING_PRIVATE_KEY: encodedPrivateKey,
        MAX_LANDSCAPE_RESOLUTION: '1080p',
        MAX_PORTRAIT_RESOLUTION: '720p',
        TOKEN_TTL_SECONDS: '60',
        ...overrides
    };
}

function createRequest(search = '', origin = allowedOrigin) {
    return new Request(`https://token.example/token${search}`, {
        headers: {
            'CF-Connecting-IP': '203.0.113.10',
            Origin: origin,
            Referer: `${origin}/`,
            'User-Agent': 'Test browser'
        }
    });
}

function decodeJwtClaims(token) {
    return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
}
