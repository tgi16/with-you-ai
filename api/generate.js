export const config = {
  runtime: "nodejs"
};

/* ===============================
   AUTO INTENT DETECTOR
================================ */
function detectIntent(text = "") {
  const t = String(text || "").toLowerCase();

  if (/(mentor|ဓာတ်ပုံဆရာ|ဘယ်သူ|လေ့လာ|inspire|inspiration|artist)/i.test(t)) {
    return "mentor";
  }

  if (/(ဈေး|price|package|booking|ရက်|date|client|dm)/i.test(t)) {
    return "business";
  }

  if (/(ဒီနေ့|ဘာလုပ်|plan|လုပ်သင့်|today)/i.test(t)) {
    return "manager";
  }

  return "general";
}

function clampMaxOutputTokens(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 1200;
  return Math.min(Math.max(Math.floor(n), 500), 3000);
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
    const { userMessage, prompt, mode, maxOutputTokens } = req.body || {};
    const inputText = (userMessage || prompt || "").trim();

    if (!inputText) {
      return res.status(400).json({ error: "userMessage or prompt is required" });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "API key missing" });
    }

    /* ===============================
       FINAL MODE (AUTO SWITCH)
    ================================ */
    const intent = mode || detectIntent(inputText);

    /* ===============================
       SYSTEM PROMPTS
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
- Burmese language only

Rules:
- NO selling
- NO business advice unless asked
- Focus on photography skills, light, emotion, composition
- Mention famous photographers when helpful
`;

    const generalPrompt = `
You are a trusted colleague.

Tone:
- Natural
- Friendly
- Clear
- Burmese language only
`;

    let systemPrompt = generalPrompt;
    if (intent === "business" || intent === "manager") systemPrompt = businessPrompt;
    if (intent === "mentor") systemPrompt = mentorPrompt;

    /* ===============================
       FINAL PROMPT
    ================================ */
    const finalPrompt = `
SYSTEM:
${systemPrompt}

STUDIO MEMORY:
With You Photo Studio, Taunggyi

USER:
${inputText}

IMPORTANT:
- Answer fully
- Sound human
- Do not cut off mid sentence
`;

    const tokenLimit = clampMaxOutputTokens(maxOutputTokens);

    /* ===============================
       GEMINI CALL
    ================================ */
    const genRes = await fetch(
      "https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=" + apiKey,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: finalPrompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: tokenLimit
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

    const result = genData?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    /* ===============================
       CUT-OFF DETECTION
    ================================ */
    const isCut = result.length > 700 && !/[။.!?]$/.test(result.trim());

    return res.status(200).json({
      intent,
      result,
      isCut
    });
  } catch (err) {
    console.error("Backend error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
