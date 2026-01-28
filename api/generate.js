export const config = {
  runtime: "nodejs"
};

/* ===============================
   1️⃣ SIMPLE AUTO INTENT DETECTOR
================================ */
function detectIntent(text = "") {
  const t = text.toLowerCase();

  if (/(mentor|ဓာတ်ပုံဆရာ|ဘယ်သူ|လေ့လာ|inspire|inspiration)/i.test(t)) {
    return "mentor";
  }

  if (/(ဈေး|price|package|booking|ရက်|date|ဘယ်နေ့|client)/i.test(t)) {
    return "business";
  }

  if (/(ဒီနေ့|ဘာလုပ်|plan|လုပ်သင့်)/i.test(t)) {
    return "manager";
  }

  return "general";
}

export default async function handler(req, res) {
  /* ---------- CORS ---------- */
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = req.body || {};
    const userMessage = body.userMessage?.trim();
    const mode = body.mode || null;

    if (!userMessage) {
      return res.status(400).json({ error: "userMessage is required" });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "API key missing" });
    }

    /* ===============================
       2️⃣ FINAL MODE (AUTO SWITCH)
    ================================ */
    const intent = mode || detectIntent(userMessage);

    /* ===============================
       3️⃣ SYSTEM PROMPTS
    ================================ */
    const businessPrompt = `
You are AI Manager for "With You Photo Studio, Taunggyi".

Tone:
- Calm
- Warm
- Trustworthy
- Natural Burmese (spoken)

Rules:
- Focus on bookings, clients, content
- Reduce decision fatigue
- ONE clear suggestion at a time
- Never sound like marketing textbook
`;

    const mentorPrompt = `
You are a senior photography mentor.

Tone:
- Calm
- Inspiring
- Experienced
- Burmese only

Rules:
- NO selling
- NO business unless asked
- Focus on photography skills, light, emotion, composition
- Mention famous photographers when useful
`;

    const generalPrompt = `
You are a trusted colleague.

Tone:
- Natural
- Friendly
- Clear
- Burmese only
`;

    let systemPrompt = generalPrompt;
    if (intent === "business" || intent === "manager") systemPrompt = businessPrompt;
    if (intent === "mentor") systemPrompt = mentorPrompt;

    /* ===============================
       4️⃣ FINAL PROMPT
    ================================ */
    const finalPrompt = `
SYSTEM:
${systemPrompt}

STUDIO MEMORY:
With You Photo Studio, Taunggyi

USER:
${userMessage}

IMPORTANT:
- Answer fully
- Sound human
- Do not cut off
`;

    /* ===============================
       5️⃣ GEMINI CALL
    ================================ */
    const genRes = await fetch(
      "https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=" +
        apiKey,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: finalPrompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 3000
          }
        })
      }
    );

    const genData = await genRes.json();

    if (!genRes.ok) {
      return res.status(200).json({
        error: genData?.error?.message || "Gemini API error"
      });
    }

    const result =
      genData?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    /* ===============================
       6️⃣ CUT-OFF DETECTION
    ================================ */
    const isCut =
      result.length > 700 && !result.trim().endsWith("။");

    return res.status(200).json({
      intent,
      result,
      isCut
    });

  } catch (err) {
    console.error("❌ Backend error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
