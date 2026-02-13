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

function isLikelyCopywritingRequest(text = "") {
  const t = String(text || "");
  return /(caption|post|content|fb|facebook|reel|carousel|ad|ads|promotion|promo|script|ရေး|တင်|စာသား|ကော်ပီ|copy)/i.test(t);
}

function hasEmbeddedInstructionBlock(text = "") {
  const t = String(text || "");
  // The UI often sends a big "system prompt" inside the userMessage.
  // In that case, we should NOT override with our own copywriter system prompt.
  return /(===\s*🎭\s*role\s*&\s*identity\s*===|===\s*✍️\s*writing rules|goal per type|knowledge base|completion rule|system:|important:)/i.test(t);
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

  const copywriterPrompt = `
You are a Myanmar FB copywriter for "With You Photo Studio, Taunggyi".

Tone:
- Natural
- Human
- Short lines
- Local, conversational Burmese (not corporate)

Rules:
- No greetings, no self-intro, no explanations
- Avoid buzzwords and generic marketing clichés
- Be specific and concrete (time/slots/deliverables) when possible
- Ask exactly ONE question
- Include exactly ONE soft CTA to DM (prefer: DM 'BOOK')
- No emojis unless the user explicitly asks
- No hashtags unless the user explicitly asks
- If user asks JSON, return strict JSON only (no markdown, no code fences)
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
  if (intent === "business" || intent === "manager") {
    // When routed into fb_copywriter mode, default to copywriter voice.
    return mode === "fb_copywriter" ? copywriterPrompt : businessPrompt;
  }
  return generalPrompt;
}

function extractFirstJson(text = "") {
  const s = String(text || "");
  const idxObj = s.indexOf("{");
  const idxArr = s.indexOf("[");
  const start = idxObj === -1 ? idxArr : (idxArr === -1 ? idxObj : Math.min(idxObj, idxArr));
  if (start < 0) return "";

  const open = s[start];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (inString) {
      if (escape) {
        escape = false;
      } else if (ch === "\\") {
        escape = true;
      } else if (ch === "\"") {
        inString = false;
      }
      continue;
    }

    if (ch === "\"") {
      inString = true;
      continue;
    }

    if (ch === open) depth++;
    if (ch === close) depth--;
    if (depth === 0) return s.slice(start, i + 1);
  }

  return "";
}

function coerceStrictJson(text = "") {
  const cleaned = stripCodeFence(text);
  try {
    const obj = JSON.parse(cleaned);
    return { ok: true, jsonText: JSON.stringify(obj) };
  } catch {
    // Try extracting the first JSON object/array from mixed text.
    const extracted = extractFirstJson(cleaned);
    if (extracted) {
      try {
        const obj = JSON.parse(extracted);
        return { ok: true, jsonText: JSON.stringify(obj) };
      } catch {
        // fallthrough
      }
    }
    return { ok: false, jsonText: "" };
  }
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
    // Only auto-route to fb_copywriter for plain, short user prompts.
    // If caller already includes a detailed instruction block (UI), don't override it.
    const wantsCopy = isLikelyCopywritingRequest(inputText) && !hasEmbeddedInstructionBlock(inputText);
    const effectiveMode = mode || (wantsCopy ? "fb_copywriter" : "");
    const systemPrompt = getSystemPrompt(effectiveMode, intent);

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

    const structured = isStructuredRequest(inputText);
    const tokenLimitInput = structured ? Math.max(Number(maxOutputTokens || 0), 1200) : maxOutputTokens;
    const tokenLimit = clampMaxOutputTokens(tokenLimitInput);

    const geminiUrl = "https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=" + apiKey;
    const generationConfig = {
      temperature: (mode === "studio_lite" || structured) ? 0.35 : (wantsCopy ? 0.55 : 0.7),
      maxOutputTokens: tokenLimit
    };

    const first = await callGemini(geminiUrl, finalPrompt, generationConfig);
    let result = stripCodeFence(first.text);
    let finishReason = first.finishReason;

    const likelyCut = finishReason === "MAX_TOKENS" || looksIncomplete(result);
    if (!structured && likelyCut && result) {
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

    // Enforce strict JSON when requested.
    if (structured && result) {
      const coerced = coerceStrictJson(result);
      if (coerced.ok) {
        result = coerced.jsonText;
      } else {
        // Ask the model to repair into valid JSON only.
        const repairPrompt = `
Return ONLY valid JSON.
Rules:
- No markdown, no code fences, no commentary.
- Preserve the intended meaning and keys as much as possible.

Bad output to repair:
${result.slice(0, 6000)}
`;
        const repaired = await callGemini(geminiUrl, repairPrompt, {
          temperature: 0.2,
          maxOutputTokens: tokenLimit
        });
        const repairedText = stripCodeFence(repaired.text);
        const repairedCoerced = coerceStrictJson(repairedText);
        result = repairedCoerced.ok ? repairedCoerced.jsonText : repairedText.trim();
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
