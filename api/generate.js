export const config = {
  runtime: "nodejs"
};

function detectIntent(text = "") {
  const t = String(text || "").toLowerCase();

  if (/(mentor|ဓာတ်ပုံဆရာ|ဘယ်သူ|လေ့လာ|inspire|inspiration|artist)/i.test(t)) {
    return "mentor";
  }

  if (/(ဈေး|price|package|booking|ရက်|date|client|dm|sale|campaign)/i.test(t)) {
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
  return Math.min(Math.max(Math.floor(n), 300), 4096);
}

function extractTextFromCandidate(candidate = {}) {
  return candidate?.content?.parts?.[0]?.text || "";
}

function stripCodeFence(text = "") {
  return String(text || "").replace(/```json|```/gi, "").trim();
}

function looksIncomplete(text = "") {
  const trimmed = String(text || "").trim();
  if (!trimmed) return false;

  const lines = trimmed.split("\n").map((x) => x.trim()).filter(Boolean);
  const lastLine = lines[lines.length - 1] || trimmed;
  const endsClean = /[။.!?…]$/.test(lastLine)
    || /[\])}"'”’]$/.test(lastLine)
    || /^#/.test(lastLine)
    || /[:;]$/.test(lastLine);

  return trimmed.length > 1100 && !endsClean;
}

function isStructuredRequest(text = "") {
  const t = String(text || "");
  return /strict json|json only|return json|\{\s*"|\[\s*"/i.test(t);
}

function getSystemPrompt(mode, intent) {
  if (mode === "studio_lite") {
    return `
You are copy engine for "With You Photo Studio, Taunggyi".

Rules:
- Final ready-to-post output only
- Burmese language only
- No greetings, no self-intro, no explanation
- No mentor text, no planning notes
- Keep copy natural, concise, conversion-focused
- If user asks JSON, return strict JSON only
- Do not cut off sections
`;
  }

  const businessPrompt = `
You are AI Manager for "With You Photo Studio, Taunggyi".

Tone:
- Calm
- Warm
- Trustworthy
- Natural Burmese

Rules:
- Focus on bookings, clients, and content
- Reduce decision fatigue
- Do NOT write greetings or self-introduction
- Start directly with deliverable content
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
- Focus on photography skills and direction
- Do NOT write greetings or self-introduction
- Start directly with deliverable content
`;

  const generalPrompt = `
You are a trusted colleague.

Tone:
- Natural
- Friendly
- Clear
- Burmese language only

Rules:
- Do NOT write greetings or self-introduction
- Start directly with deliverable content
`;

  if (intent === "mentor") return mentorPrompt;
  if (intent === "business" || intent === "manager") return businessPrompt;
  return generalPrompt;
}

async function callGemini(geminiUrl, finalPrompt, generationConfig) {
  const res = await fetch(geminiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: finalPrompt }] }],
      generationConfig
    })
  });

  const raw = await res.text();
  let data = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    data = {};
  }

  if (!res.ok) {
    const msg = data?.error?.message || `Gemini API error (${res.status})`;
    const err = new Error(msg);
    err.statusCode = res.status || 502;
    throw err;
  }

  const candidate = data?.candidates?.[0] || {};
  return {
    text: extractTextFromCandidate(candidate),
    finishReason: String(candidate?.finishReason || "").toUpperCase()
  };
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
    const { userMessage, prompt, mode, maxOutputTokens } = req.body || {};
    const inputText = (userMessage || prompt || "").trim();

    if (!inputText) {
      return res.status(400).json({ error: "userMessage or prompt is required" });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "API key missing (GEMINI_API_KEY)" });
    }

    const intent = mode || detectIntent(inputText);
    const systemPrompt = getSystemPrompt(mode, intent);

    const finalPrompt = `
SYSTEM:
${systemPrompt}

STUDIO MEMORY:
With You Photo Studio, Taunggyi

USER:
${inputText}

IMPORTANT:
- Answer fully
- Do not cut off mid sentence
- Output only requested content body
- If request asks strict JSON, return strict JSON only
`;

    const tokenLimit = clampMaxOutputTokens(maxOutputTokens);
    const structured = isStructuredRequest(inputText);

    const geminiUrl = "https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=" + apiKey;
    const generationConfig = {
      temperature: mode === "studio_lite" || structured ? 0.45 : 0.7,
      maxOutputTokens: tokenLimit
    };

    const first = await callGemini(geminiUrl, finalPrompt, generationConfig);
    let result = stripCodeFence(first.text);
    let finishReason = first.finishReason;

    const likelyCut = finishReason === "MAX_TOKENS" || looksIncomplete(result);
    if (likelyCut && result) {
      try {
        const continuationPrompt = `
Continue the unfinished content below.
Rules:
- Return ONLY missing remaining lines.
- Do NOT repeat existing lines.
- Keep same tone/language/format.
- Finish all open sections completely.

Existing content:
${result.slice(-1400)}
`;
        const cont = await callGemini(geminiUrl, continuationPrompt, generationConfig);
        const contText = stripCodeFence(cont.text);
        if (contText) {
          result = `${result}\n${contText}`.trim();
          finishReason = cont.finishReason || finishReason;
        }
      } catch (contErr) {
        console.warn("Continuation pass skipped:", contErr?.message || contErr);
      }
    }

    const trimmed = result.trim();
    const isCut = finishReason === "MAX_TOKENS" ? true : looksIncomplete(trimmed);

    if (!trimmed) {
      return res.status(200).json({
        error: `No content returned from model (finishReason=${finishReason || "UNKNOWN"}). Try a shorter prompt.`,
        finishReason
      });
    }

    return res.status(200).json({
      intent,
      result: trimmed,
      isCut,
      finishReason
    });
  } catch (err) {
    console.error("Backend error:", err);
    return res.status(err?.statusCode || 500).json({
      error: err?.message || "Server error"
    });
  }
}
