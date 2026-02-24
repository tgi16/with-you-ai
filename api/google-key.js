export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const key = process.env.GEMINI_API_KEY || "";
  if (!key) {
    return res.status(500).json({ error: "GEMINI_API_KEY missing on server" });
  }

  return res.status(200).json({ apiKey: key });
}
