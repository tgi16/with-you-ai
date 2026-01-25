export const config = {
  runtime: "nodejs"
};

export default async function handler(req, res) {

  /* -------- CORS -------- */
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  console.log("✅ /api/generate called");

  try {
    const { prompt } = req.body || {};

    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "API key missing" });
    }

    // ✅ CORRECT ENDPOINT + MODEL
    const url =
      "https://generativelanguage.googleapis.com/v1/models/" +
      "gemini-2.5-flash:generateContent?key=" + apiKey;

    const geminiRes = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }]
          }
        ],
        generationConfig: {
-  temperature: 0.7,
-  maxOutputTokens: 600
+  temperature: 0.65,
+  maxOutputTokens: 1400
}
      })
    });

    const data = await geminiRes.json();
    console.log("📦 Gemini response:", data);

    if (!geminiRes.ok) {
      return res.status(500).json({
        error: data?.error?.message || "Gemini API error"
      });
    }

    const text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    return res.status(200).json({ result: text });

  } catch (err) {
    console.error("❌ Backend error:", err);
    return res.status(500).json({
      error: "Server error"
    });
  }
}
