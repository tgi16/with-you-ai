export const config = {
  runtime: "nodejs"
};

export default async function handler(req, res) {
  /* ---------------- CORS ---------------- */
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
    /* ---------------- INPUT ---------------- */
    const {
      userMessage = "",
      conversation = [],   // [{role, content}]
      memory = "",         // Brand Brain
      mode = "general"     // dm | manager | studio | general
    } = req.body || {};

    if (!userMessage) {
      return res.status(400).json({ error: "userMessage is required" });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "API key missing" });
    }

    /* ---------------- SYSTEM PROMPT ---------------- */
    const systemPrompt = `
You are the trusted AI partner of "With You Photo Studio, Taunggyi".
You know Ko Sai personally and professionally.

PERSONALITY:
- Sound like a real experienced human
- Calm, patient, warm, trustworthy
- Never sound like AI or marketing copy
- Burmese language only (natural spoken Myanmar)

BUSINESS STYLE:
- Strong in Pre-Wedding & guiding couples
- Sell with trust, not price war
- Reduce decision fatigue
- One clear suggestion at a time
`;

    /* ---------------- MEMORY ---------------- */
    const memoryBlock = memory
      ? `STUDIO MEMORY:\n${memory}`
      : `STUDIO MEMORY:
Studio: With You Photo Studio, Taunggyi
Strength: Pre-Wedding, patient guiding
Client feedback: trustworthy, calm, detailed
`;

    /* ---------------- CONVERSATION ---------------- */
    const convoBlock = conversation
      .slice(-6)
      .map(m => `${m.role.toUpperCase()}: ${m.content}`)
      .join("\n");

    /* ---------------- MODE ---------------- */
    let modeInstruction = "";

    if (mode === "dm") {
      modeInstruction = `
TASK:
Reply to client DM naturally.
If price asked → explain value, invite discussion.
If date asked → guide next step.
End with warm polite closing.
`;
    } else if (mode === "manager") {
      modeInstruction = `
TASK:
Act as daily AI Manager.
Give ONE clear direction for today.
Focus on what brings booking or trust.
`;
    } else if (mode === "studio") {
      modeInstruction = `
TASK:
Create natural human-like studio content.
Avoid hype or AI tone.
`;
    } else {
      modeInstruction = `
TASK:
Respond like a trusted colleague.
Be clear and helpful.
`;
    }

    /* ---------------- FINAL PROMPT ---------------- */
    const finalPrompt = `
SYSTEM:
${systemPrompt}

${memoryBlock}

CONVERSATION:
${convoBlock || "None"}

${modeInstruction}

USER:
${userMessage}

IMPORTANT:
- Answer fully
- Short but complete
- Sound human
`;

    /* ---------------- GEMINI CALL ---------------- */
    const url =
      "https://generativelanguage.googleapis.com/v1/models/" +
      "gemini-2.5-flash:generateContent?key=" + apiKey;

    const geminiRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: finalPrompt }]
          }
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 800
        }
      })
    });

    const data = await geminiRes.json();

    if (!geminiRes.ok) {
      console.error("Gemini error:", data);
      return res.status(200).json({
        error: data?.error?.message || "Gemini API error"
      });
    }

    const text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    return res.status(200).json({ result: text });

  } catch (err) {
    console.error("Backend crash:", err);
    return res.status(200).json({
      error: "Server error",
      detail: err.message
    });
  }
}
