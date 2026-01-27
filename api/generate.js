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
      userMessage,
      conversation = [],   // [{role, content}]
      memory = "",         // Brand Brain / Saved Decisions
      mode = "general"     // dm / studio / manager / general
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
You are AI Manager for "With You Photo Studio, Taunggyi".
You know Ko Sai personally and professionally.

PERSONALITY RULES:
- Speak like a real experienced studio staff
- Calm, warm, patient, trustworthy
- Never sound like marketing textbook
- Never say you are AI
- Burmese language only (natural Myanmar spoken tone)

BUSINESS RULES:
- Strong at Pre-Wedding & guiding shy couples
- Sell by trust, not price war
- Reduce decision fatigue for clients
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
      .slice(-6) // last 6 messages only
      .map(m => `${m.role.toUpperCase()}: ${m.content}`)
      .join("\n");

    /* ---------------- MODE INSTRUCTION ---------------- */
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
Help create human-like content.
Avoid hype words.
Natural Burmese tone only.
`;
    } else {
      modeInstruction = `
TASK:
Respond like trusted colleague.
Be helpful and clear.
`;
    }

else if (type === 'manager_daily') {
  prompt = `
Task: Act as my AI Manager.
User: Ko Sai (Photo Studio Owner – With You Photo Studio, Taunggyi)

Inputs:
- Energy: ${getValue('mgrEnergy')}
- Goal: ${getValue('mgrGoal')}
- Focus: ${getValue('mgrFocus')}

Output format (Burmese, very natural, human-like):
1. 🔥 Today’s Priority (1–2 tasks only)
2. 🎯 Content Action (what to post + where)
3. 💬 Sales Action (DM / Follow-up suggestion)
4. ⏱ Simple next step (within 30 minutes)

Tone: Calm, experienced, human advisor (not AI).
No emojis overload. No AI wording.
`;
  contextTopic = "AI Manager – Today Plan";
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
- Answer fully (do not cut off)
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
    console.error("Backend error:", err);
    return res.status(200).json({ error: "Server error" });
  }
}
