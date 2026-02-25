import {
  hasCanvaOAuthEnv,
  readSessionCookie,
  sessionMeta,
  refreshAccessToken,
  normalizeSessionFromToken,
  setSessionCookie,
  clearSessionCookie
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
    return res.status(200).json({ connected: false, configured: false });
  }

  const session = readSessionCookie(req);
  if (!session?.access_token) {
    return res.status(200).json({ connected: false, configured: true });
  }

  const expiresAt = Number(session.expires_at || 0);
  const now = Date.now();
  const needsRefresh = !expiresAt || expiresAt - now < 90 * 1000;

  if (needsRefresh && session.refresh_token) {
    try {
      const refreshed = await refreshAccessToken(req, session.refresh_token);
      const merged = {
        ...session,
        ...normalizeSessionFromToken(refreshed),
        refresh_token: String(refreshed.refresh_token || session.refresh_token || "")
      };
      setSessionCookie(req, res, merged);
      return res.status(200).json({ configured: true, ...sessionMeta(merged) });
    } catch {
      clearSessionCookie(res);
      return res.status(200).json({ connected: false, configured: true, expired: true });
    }
  }

  return res.status(200).json({ configured: true, ...sessionMeta(session) });
}
