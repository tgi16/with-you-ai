const GEMINI_BASE = "https://generativelanguage.googleapis.com";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.GEMINI_API_KEY || "";
  if (!apiKey) {
    return res.status(500).json({ error: "Server key missing (GEMINI_API_KEY)" });
  }

  const rawTarget = String(req.query?.target || "");
  if (!rawTarget.startsWith("/v1")) {
    return res.status(400).json({ error: "Invalid target path" });
  }

  const upstreamUrl = `${GEMINI_BASE}${rawTarget}${rawTarget.includes("?") ? "&" : "?"}key=${encodeURIComponent(apiKey)}`;
  const body = typeof req.body === "string" ? req.body : JSON.stringify(req.body || {});

  try {
    const upstream = await fetch(upstreamUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body
    });

    const text = await upstream.text();
    res.status(upstream.status);
    res.setHeader("Content-Type", upstream.headers.get("content-type") || "application/json; charset=utf-8");
    return res.send(text);
  } catch (err) {
    return res.status(502).json({ error: err?.message || "Upstream request failed" });
  }
}
