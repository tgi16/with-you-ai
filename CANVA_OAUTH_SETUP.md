# Canva OAuth Setup

## Environment Variables (Vercel)
Set these in Project Settings -> Environment Variables:

- `CANVA_CLIENT_ID`
- `CANVA_CLIENT_SECRET`
- `CANVA_REDIRECT_URI`
- `CANVA_STATE_SECRET`
- `CANVA_TOKEN_SECRET`
- `CANVA_SCOPES` (optional, default: `asset:read design:content:write design:meta:read`)

Optional overrides:
- `CANVA_AUTH_BASE` (default: `https://www.canva.com`)
- `CANVA_API_BASE` (default: `https://api.canva.com`)
- `CANVA_AUTHORIZE_PATH` (default: `/api/oauth/authorize`)
- `CANVA_TOKEN_PATH` (default: `/rest/v1/oauth/token`)
- `CANVA_REVOKE_PATH` (default: `/rest/v1/oauth/revoke`)

## OAuth Callback URL
Set Canva app callback URL to:

- `https://with-you-ai.vercel.app/api/canva/callback`

Or your own domain equivalent.

## Implemented Endpoints
- `GET /api/canva/connect` -> creates state + PKCE cookie and returns `authorizeUrl`
- `GET /api/canva/callback` -> exchanges code, stores encrypted token session cookie
- `GET /api/canva/status` -> returns `{ connected, configured, expiresAt, scope }`
- `POST /api/canva/disconnect` -> revokes token (best effort) and clears session cookie

## Security Model
- OAuth state is signed with HMAC (`CANVA_STATE_SECRET`).
- PKCE verifier is stored in short-lived HttpOnly cookie.
- Access/refresh tokens are encrypted and stored in HttpOnly cookie (`CANVA_TOKEN_SECRET`).
- No raw token is exposed to frontend JS.
