export const config = {
  runtime: "nodejs"
};

export default async function handler(req, res) {
  /* ---------- CORS ---------- */
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { userMessage = "", memory = "" } = req.body || {};

    if (!userMessage.trim()) {
      return res.status(400).json({ error: "userMessage is required" });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "API key missing" });
    }

    /* =====================================================
       1️⃣ INTENT DETECTION (AUTO-SWITCH BRAIN)
    ===================================================== */
    const intentPrompt = `
You are an intent classifier.

Classify the user's message into ONE category only:
- business (sales, client, content, booking, studio operation)
- mentor (photography learning, inspiration, skill, art, famous photographers)
- general (casual chat, unclear, mixed)

Reply with ONLY one word:
business OR mentor OR general

User message:
"${userMessage}"
`;

    const intentRes = await fetch(
      "https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=" +
        apiKey,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: intentPrompt }] }],
          generationConfig: { temperature: 0 }
        })
      }
    );

    const intentData = await intentRes.json();
    let intent =
      intentData?.candidates?.[0]?.content?.parts?.[0]?.text
        ?.toLowerCase()
        ?.trim() || "general";

    if (!["business", "mentor", "general"].includes(intent)) {
      intent = "general";
    }

    /* =====================================================
       2️⃣ SYSTEM PROMPTS (AUTO SWITCH)
    ===================================================== */

    const businessPrompt = `
You are AI Manager for "With You Photo Studio, Taunggyi".

You speak to Ko Sai (studio owner).

Tone:
- Calm
- Warm
- Patient
- Trustworthy
- Natural Burmese (spoken Myanmar)

Rules:
- Focus on bookings, clients, content, daily studio actions
- Sell by trust, not price
- Reduce decision fatigue
- ONE clear suggestion at a time
- Never sound like marketing textbook
`;

    const mentorPrompt = `
You are a photography mentor and senior artist.

You speak to Ko Sai, a photographer from Taunggyi.

Tone:
- Calm
- Inspiring
- Experienced
- Human (never say you are AI)
- Burmese language only

Rules:
- NO selling
- NO business advice unless asked
- Focus on photography skills, art, emotion, light, composition
- Mention famous photographers when helpful
- Encourage learning and curiosity
`;

    const generalPrompt = `
You are a trusted colleague and thinking partner.

Tone:
- Natural
- Friendly
- Clear
- Burmese language only
`;

    let systemPrompt = generalPrompt;
    if (intent === "business") systemPrompt = businessPrompt;
    if (intent === "mentor") systemPrompt = mentorPrompt;

    /* =====================================================
       3️⃣ FINAL GENERATION
    ===================================================== */
    const finalPrompt = `
SYSTEM:
${systemPrompt}

STUDIO MEMORY:
${memory || "With You Photo Studio, Taunggyi"}

USER:
${userMessage}

IMPORTANT:
- Answer fully
- Do NOT cut off
- Sound human
`;

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
            maxOutputTokens: 3500
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

    return res.status(200).json({
      intent,      // 👈 FRONTEND က သိနိုင်အောင်
      result
    });

  } catch (err) {
    console.error("❌ Backend error:", err);
    return res.status(200).json({ error: "Server error" });
  }
}
