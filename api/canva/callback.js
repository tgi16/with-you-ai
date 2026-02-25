import {
  hasCanvaOAuthEnv,
  readPkceCookie,
  clearPkceCookie,
  verifyStateToken,
  exchangeAuthCode,
  normalizeSessionFromToken,
  setSessionCookie
} from "../_canva.js";

export const config = {
  runtime: "nodejs"
};

function renderHtml({ ok, message, returnTo = "/" }) {
  const safeMsg = String(message || "").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const safeReturn = String(returnTo || "/").replace(/"/g, "");
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Canva OAuth</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; padding: 20px; background: #020617; color: #e2e8f0; }
    .card { max-width: 520px; margin: 6vh auto; border: 1px solid #334155; border-radius: 12px; padding: 18px; background: #0f172a; }
    .ok { color: #34d399; font-weight: 700; }
    .err { color: #f87171; font-weight: 700; }
    .msg { margin-top: 8px; line-height: 1.4; color: #cbd5e1; }
  </style>
</head>
<body>
  <div class="card">
    <div class="${ok ? "ok" : "err"}">${ok ? "Canva connected" : "Connection failed"}</div>
    <div class="msg">${safeMsg}</div>
  </div>
  <script>
    (function() {
      const payload = { type: "canva_oauth_result", ok: ${ok ? "true" : "false"}, message: ${JSON.stringify(String(message || ""))} };
      try { if (window.opener) window.opener.postMessage(payload, window.location.origin); } catch (_) {}
      setTimeout(function() {
        try {
          if (window.opener) window.close();
          else window.location.href = ${JSON.stringify(safeReturn)};
        } catch (_) {
          window.location.href = ${JSON.stringify(safeReturn)};
        }
      }, 700);
    })();
  </script>
</body>
</html>`;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).send("Method not allowed");
  }

  if (!hasCanvaOAuthEnv(req)) {
    return res.status(500).send(renderHtml({ ok: false, message: "Canva OAuth env missing.", returnTo: "/" }));
  }

  const oauthError = String(req.query?.error || "").trim();
  const oauthDesc = String(req.query?.error_description || "").trim();
  const code = String(req.query?.code || "").trim();
  const state = String(req.query?.state || "").trim();

  const pkce = readPkceCookie(req);
  clearPkceCookie(res);

  const parsedState = verifyStateToken(req, state);
  const returnTo = parsedState?.payload?.returnTo || "/";

  if (oauthError) {
    const msg = oauthDesc || oauthError;
    return res.status(400).send(renderHtml({ ok: false, message: msg, returnTo }));
  }
  if (!pkce?.state || !pkce?.verifier || !code || !state) {
    return res.status(400).send(renderHtml({ ok: false, message: "Missing OAuth payload.", returnTo }));
  }
  if (pkce.state !== state) {
    return res.status(400).send(renderHtml({ ok: false, message: "State mismatch.", returnTo }));
  }
  if (!parsedState.ok) {
    return res.status(400).send(renderHtml({ ok: false, message: parsedState.reason || "Invalid state.", returnTo }));
  }

  try {
    const token = await exchangeAuthCode(req, code, pkce.verifier);
    const session = normalizeSessionFromToken(token);
    setSessionCookie(req, res, session);
    return res.status(200).send(renderHtml({ ok: true, message: "Canva OAuth linked successfully.", returnTo }));
  } catch (err) {
    return res.status(500).send(renderHtml({ ok: false, message: err?.message || "Token exchange failed.", returnTo }));
  }
}
