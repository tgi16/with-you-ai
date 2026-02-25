import {
  hasCanvaOAuthEnv,
  readSessionCookie,
  revokeToken,
  clearSessionCookie
} from "../_canva.js";

export const config = {
  runtime: "nodejs"
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!hasCanvaOAuthEnv(req)) {
    clearSessionCookie(res);
    return res.status(200).json({ ok: true, configured: false });
  }

  const session = readSessionCookie(req);
  const token = String(session?.refresh_token || session?.access_token || "");
  if (token) await revokeToken(req, token);
  clearSessionCookie(res);
  return res.status(200).json({ ok: true, configured: true });
}
