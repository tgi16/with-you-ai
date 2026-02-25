import {
  hasCanvaOAuthEnv,
  createPkceVerifier,
  createPkceChallenge,
  createStateToken,
  buildAuthorizeUrl,
  setPkceCookie
} from "../_canva.js";

export const config = {
  runtime: "nodejs"
};

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!hasCanvaOAuthEnv(req)) {
    return res.status(500).json({
      error: "Canva OAuth is not configured. Missing one of: CANVA_CLIENT_ID, CANVA_CLIENT_SECRET, CANVA_REDIRECT_URI, CANVA_STATE_SECRET, CANVA_TOKEN_SECRET."
    });
  }

  const returnToRaw = String(req.query?.returnTo || "/").trim();
  const returnTo = returnToRaw.startsWith("/") ? returnToRaw : "/";
  const uid = String(req.query?.uid || "").trim().slice(0, 128);
  const state = createStateToken(req, { uid, returnTo });
  const verifier = createPkceVerifier();
  const challenge = createPkceChallenge(verifier);
  setPkceCookie(res, { state, verifier, createdAt: Date.now() });
  const authorizeUrl = buildAuthorizeUrl(req, { state, codeChallenge: challenge });
  return res.status(200).json({ ok: true, authorizeUrl });
}
