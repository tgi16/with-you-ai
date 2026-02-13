export const config = {
  runtime: "nodejs"
};

async function readJsonSafe(res) {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { platform, text } = req.body || {};
    const target = String(platform || "").toLowerCase().trim();
    const message = String(text || "").trim();

    if (!target) {
      return res.status(400).json({ error: "platform is required" });
    }
    if (!message) {
      return res.status(400).json({ error: "text is required" });
    }

    if (target === "facebook") {
      const pageId = process.env.FACEBOOK_PAGE_ID;
      const accessToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;

      if (!pageId || !accessToken) {
        return res.status(400).json({
          error: "Facebook auto publish is not configured. Add FACEBOOK_PAGE_ID and FACEBOOK_PAGE_ACCESS_TOKEN."
        });
      }

      const body = new URLSearchParams({
        message,
        access_token: accessToken
      });

      const fbRes = await fetch(`https://graph.facebook.com/v23.0/${encodeURIComponent(pageId)}/feed`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body
      });

      const fbData = await readJsonSafe(fbRes);
      if (!fbRes.ok || fbData?.error) {
        const msg = fbData?.error?.message || `Facebook API error (${fbRes.status})`;
        return res.status(fbRes.status || 502).json({ error: msg });
      }

      return res.status(200).json({
        ok: true,
        platform: "facebook",
        id: fbData?.id || "posted"
      });
    }

    if (target === "tiktok") {
      return res.status(400).json({
        error: "TikTok auto publish is not configured. TikTok Content Posting API requires approved OAuth app and media upload workflow."
      });
    }

    return res.status(400).json({ error: "Unsupported platform" });
  } catch (err) {
    console.error("Publish API error:", err);
    return res.status(500).json({ error: err?.message || "Server error" });
  }
}
