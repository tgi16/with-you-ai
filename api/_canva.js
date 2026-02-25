import crypto from "crypto";

const PKCE_COOKIE = "wy_canva_pkce";
const SESSION_COOKIE = "wy_canva_session";

const CANVA_AUTH_BASE = (process.env.CANVA_AUTH_BASE || "https://www.canva.com").replace(/\/$/, "");
const CANVA_API_BASE = (process.env.CANVA_API_BASE || "https://api.canva.com").replace(/\/$/, "");
const CANVA_AUTHORIZE_PATH = process.env.CANVA_AUTHORIZE_PATH || "/api/oauth/authorize";
const CANVA_TOKEN_PATH = process.env.CANVA_TOKEN_PATH || "/rest/v1/oauth/token";
const CANVA_REVOKE_PATH = process.env.CANVA_REVOKE_PATH || "/rest/v1/oauth/revoke";

const DEFAULT_SCOPE = "asset:read design:content:write design:meta:read";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30;
const PKCE_MAX_AGE = 60 * 10;

function b64urlEncode(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(String(input || ""), "utf8");
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function b64urlDecode(input = "") {
  const normalized = String(input || "").replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "===".slice((normalized.length + 3) % 4);
  return Buffer.from(padded, "base64");
}

function parseJsonSafe(value, fallback = null) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function getProto(req) {
  return String(req.headers["x-forwarded-proto"] || "https").split(",")[0].trim() || "https";
}

function getHost(req) {
  return String(req.headers["x-forwarded-host"] || req.headers.host || "").split(",")[0].trim();
}

function getCookieMap(req) {
  const raw = String(req.headers.cookie || "");
  const out = {};
  raw.split(";").forEach((pair) => {
    const idx = pair.indexOf("=");
    if (idx < 0) return;
    const key = pair.slice(0, idx).trim();
    if (!key) return;
    out[key] = decodeURIComponent(pair.slice(idx + 1).trim());
  });
  return out;
}

function appendSetCookie(res, value) {
  const prev = res.getHeader("Set-Cookie");
  if (!prev) {
    res.setHeader("Set-Cookie", [value]);
    return;
  }
  const next = Array.isArray(prev) ? prev.concat(value) : [String(prev), value];
  res.setHeader("Set-Cookie", next);
}

function serializeCookie(name, value, opts = {}) {
  const {
    maxAge,
    path = "/",
    httpOnly = true,
    secure = true,
    sameSite = "Lax"
  } = opts;

  const parts = [`${name}=${encodeURIComponent(value)}`, `Path=${path}`, `SameSite=${sameSite}`];
  if (Number.isFinite(maxAge)) parts.push(`Max-Age=${Math.max(0, Math.floor(maxAge))}`);
  if (httpOnly) parts.push("HttpOnly");
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

function hashSha256(text) {
  return crypto.createHash("sha256").update(String(text || ""), "utf8").digest();
}

function hmacHex(secret, value) {
  return crypto.createHmac("sha256", String(secret || "")).update(String(value || ""), "utf8").digest("hex");
}

function deriveAesKey(secret) {
  return hashSha256(String(secret || ""));
}

function encryptJson(payload, secret) {
  const iv = crypto.randomBytes(12);
  const key = deriveAesKey(secret);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const raw = Buffer.from(JSON.stringify(payload), "utf8");
  const encrypted = Buffer.concat([cipher.update(raw), cipher.final()]);
  const tag = cipher.getAuthTag();
  return b64urlEncode(Buffer.concat([iv, tag, encrypted]));
}

function decryptJson(serialized, secret) {
  try {
    const raw = b64urlDecode(serialized);
    if (raw.length < 29) return null;
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const body = raw.subarray(28);
    const key = deriveAesKey(secret);
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const out = Buffer.concat([decipher.update(body), decipher.final()]).toString("utf8");
    return parseJsonSafe(out, null);
  } catch {
    return null;
  }
}

export function getCanvaConfig(req) {
  const clientId = String(process.env.CANVA_CLIENT_ID || "").trim();
  const clientSecret = String(process.env.CANVA_CLIENT_SECRET || "").trim();
  const stateSecret = String(process.env.CANVA_STATE_SECRET || process.env.CANVA_CLIENT_SECRET || "").trim();
  const tokenSecret = String(process.env.CANVA_TOKEN_SECRET || process.env.CANVA_CLIENT_SECRET || "").trim();
  const host = getHost(req);
  const proto = getProto(req);
  const redirectUri = String(process.env.CANVA_REDIRECT_URI || `${proto}://${host}/api/canva/callback`).trim();
  const scope = String(process.env.CANVA_SCOPES || DEFAULT_SCOPE).trim();
  return {
    clientId,
    clientSecret,
    stateSecret,
    tokenSecret,
    redirectUri,
    scope
  };
}

export function hasCanvaOAuthEnv(req) {
  const cfg = getCanvaConfig(req);
  return Boolean(cfg.clientId && cfg.clientSecret && cfg.stateSecret && cfg.tokenSecret && cfg.redirectUri);
}

export function createPkceVerifier() {
  return b64urlEncode(crypto.randomBytes(48));
}

export function createPkceChallenge(verifier) {
  return b64urlEncode(hashSha256(verifier));
}

export function createStateToken(req, data = {}) {
  const cfg = getCanvaConfig(req);
  const payload = {
    nonce: b64urlEncode(crypto.randomBytes(12)),
    ts: Date.now(),
    uid: String(data.uid || "").trim().slice(0, 128),
    returnTo: String(data.returnTo || "/").trim().startsWith("/") ? String(data.returnTo || "/").trim() : "/"
  };
  const payloadEncoded = b64urlEncode(JSON.stringify(payload));
  const sig = hmacHex(cfg.stateSecret, payloadEncoded);
  return `${payloadEncoded}.${sig}`;
}

export function verifyStateToken(req, token = "") {
  const cfg = getCanvaConfig(req);
  const parts = String(token || "").split(".");
  if (parts.length !== 2) return { ok: false, reason: "Malformed state" };
  const [payloadEncoded, sig] = parts;
  const expected = hmacHex(cfg.stateSecret, payloadEncoded);
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return { ok: false, reason: "State signature mismatch" };
  }
  const payloadRaw = b64urlDecode(payloadEncoded).toString("utf8");
  const payload = parseJsonSafe(payloadRaw, null);
  if (!payload || !payload.ts) return { ok: false, reason: "Invalid state payload" };
  if (Date.now() - Number(payload.ts || 0) > PKCE_MAX_AGE * 1000) {
    return { ok: false, reason: "State expired" };
  }
  return { ok: true, payload };
}

export function buildAuthorizeUrl(req, { state, codeChallenge }) {
  const cfg = getCanvaConfig(req);
  const url = new URL(`${CANVA_AUTH_BASE}${CANVA_AUTHORIZE_PATH}`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", cfg.clientId);
  url.searchParams.set("redirect_uri", cfg.redirectUri);
  url.searchParams.set("scope", cfg.scope);
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

export function setPkceCookie(res, payload) {
  const value = b64urlEncode(JSON.stringify(payload));
  appendSetCookie(res, serializeCookie(PKCE_COOKIE, value, { maxAge: PKCE_MAX_AGE }));
}

export function clearPkceCookie(res) {
  appendSetCookie(res, serializeCookie(PKCE_COOKIE, "", { maxAge: 0 }));
}

export function readPkceCookie(req) {
  const cookie = getCookieMap(req)[PKCE_COOKIE];
  if (!cookie) return null;
  const decoded = b64urlDecode(cookie).toString("utf8");
  return parseJsonSafe(decoded, null);
}

export function setSessionCookie(req, res, sessionObj) {
  const cfg = getCanvaConfig(req);
  const enc = encryptJson(sessionObj, cfg.tokenSecret);
  appendSetCookie(res, serializeCookie(SESSION_COOKIE, enc, { maxAge: SESSION_MAX_AGE }));
}

export function clearSessionCookie(res) {
  appendSetCookie(res, serializeCookie(SESSION_COOKIE, "", { maxAge: 0 }));
}

export function readSessionCookie(req) {
  const cfg = getCanvaConfig(req);
  const raw = getCookieMap(req)[SESSION_COOKIE];
  if (!raw) return null;
  return decryptJson(raw, cfg.tokenSecret);
}

export async function exchangeAuthCode(req, code, codeVerifier) {
  const cfg = getCanvaConfig(req);
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: String(code || ""),
    redirect_uri: cfg.redirectUri,
    code_verifier: String(codeVerifier || "")
  });

  const basic = Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString("base64");
  const response = await fetch(`${CANVA_API_BASE}${CANVA_TOKEN_PATH}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basic}`
    },
    body
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    const msg = json?.error_description || json?.message || `Canva token exchange failed (${response.status})`;
    throw new Error(msg);
  }
  return json;
}

export async function refreshAccessToken(req, refreshToken) {
  const cfg = getCanvaConfig(req);
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: String(refreshToken || "")
  });
  const basic = Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString("base64");
  const response = await fetch(`${CANVA_API_BASE}${CANVA_TOKEN_PATH}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basic}`
    },
    body
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    const msg = json?.error_description || json?.message || `Canva token refresh failed (${response.status})`;
    throw new Error(msg);
  }
  return json;
}

export async function revokeToken(req, token) {
  const cfg = getCanvaConfig(req);
  if (!token) return;
  const body = new URLSearchParams({ token: String(token) });
  const basic = Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString("base64");
  await fetch(`${CANVA_API_BASE}${CANVA_REVOKE_PATH}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basic}`
    },
    body
  }).catch(() => {});
}

export function normalizeSessionFromToken(tokenJson = {}) {
  const expiresInSec = Number(tokenJson.expires_in || 3600);
  const now = Date.now();
  return {
    access_token: String(tokenJson.access_token || ""),
    refresh_token: String(tokenJson.refresh_token || ""),
    scope: String(tokenJson.scope || ""),
    token_type: String(tokenJson.token_type || "Bearer"),
    expires_at: now + Math.max(60, expiresInSec) * 1000,
    updated_at: now
  };
}

export function sessionMeta(session) {
  if (!session || !session.access_token) return { connected: false };
  return {
    connected: true,
    expiresAt: Number(session.expires_at || 0),
    scope: String(session.scope || "")
  };
}
