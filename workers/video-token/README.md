# Signed background video token Worker

This Worker issues short-lived Mux playback URLs to the portfolio page. It does
not upload media and it never exposes the Mux signing private key.

## Mux setup

1. Upload `media/enterprise_architect_background_loop.mp4` directly from the
   workstation to Mux. Do not copy the master into a public Git repository.
2. Create only a `signed` playback ID. Do not create a `public` playback ID or
   enable static MP4 renditions.
3. The current Development asset uses Mux Plus quality and the 2160p resolution
   tier. Leave `master_access` set to `none` and do not configure
   `static_renditions`.
4. Keep 2160p available in the signed landscape manifest. The player caps the
   initial rendition to 1080p, 1440p, or 2160p according to rendered display
   width and known connection constraints.
5. Create a playback restriction with this configuration:

```json
{
  "referrer": {
    "allowed_domains": ["reda.bouhaddar.com"],
    "allow_no_referrer": false
  },
  "user_agent": {
    "allow_no_user_agent": false,
    "allow_high_risk_user_agent": false
  }
}
```

6. Create a Mux signing key and retain its key ID and base64-encoded private key.
   Mux returns the private key only once.

## Worker setup

Replace the placeholder IDs in `wrangler.jsonc`, then install dependencies and
store both signing values as encrypted Worker secrets:

```powershell
npm install
npx wrangler secret put MUX_SIGNING_KEY_ID
npx wrangler secret put MUX_SIGNING_PRIVATE_KEY
npm test
npm run deploy
```

The signing private key may be the base64 value returned by Mux or its decoded
PKCS#1/PKCS#8 PEM representation. Never put either value in `wrangler.jsonc`, a
`.dev.vars` file committed to Git, the page HTML, or browser JavaScript.

`MAX_PORTRAIT_RESOLUTION` and `MAX_LANDSCAPE_RESOLUTION` are encoded into each
signed JWT. Development currently uses 720p for portrait and 2160p for
landscape so the player can select 1080p, 1440p, or 2160p without another
token request.

After deployment, set `data-video-token-endpoint` on the portfolio script to the
Worker's HTTPS `/token` URL. The endpoint intentionally rejects missing
`Origin`, `Referer`, or `User-Agent` headers; affected privacy browsers keep the
local poster instead of receiving a weaker token.

## Local test

The unit tests generate an ephemeral RSA key and verify the RS256 signature,
claims, origin/referrer checks, portrait fallback, and rate-limit response. They
do not require real Mux credentials.

For a real local playback test, create an ignored `.dev.vars` file in this
directory with the Development environment's signed playback ID and signing
key. Use these local-only values:

```dotenv
ALLOWED_ORIGINS="http://localhost:8000"
MUX_PLAYBACK_ID_LANDSCAPE="<development-signed-playback-id>"
MUX_PLAYBACK_ID_PORTRAIT=""
MUX_PLAYBACK_RESTRICTION_ID="<development-playback-restriction-id>"
MAX_LANDSCAPE_RESOLUTION="2160p"
MAX_PORTRAIT_RESOLUTION="720p"
TOKEN_TTL_SECONDS="60"
MUX_SIGNING_KEY_ID="<development-signing-key-id>"
MUX_SIGNING_PRIVATE_KEY="<development-base64-private-key>"
```

Then run the Worker and the static site in separate terminals:

```powershell
cd workers/video-token
npm run dev

cd ../..
python -m http.server 8000
```

Open `http://localhost:8000`. When the HTML attribute has no configured
production endpoint, the player automatically uses `http://localhost:8787/token`
on the exact `localhost` hostname. It does not enable this fallback for `file:`,
LAN addresses, or the production site.

The Development playback restriction must include `localhost`; the Production
restriction should include only `reda.bouhaddar.com`. Both environments require
a restriction ID.
