// Calls Gemini from the server (so the key stays secret), trying other models when one is busy.
// Structured output means we never parse free text.

type Part = { text: string } | { inline_data: { mime_type: string; data: string } };

export const hasGemini = () => Boolean(process.env.GEMINI_API_KEY);

// Each model has its own free daily quota, so on 429/503/404 we move on to the next one.
const DEFAULT_FALLBACKS = ["gemini-3.6-flash", "gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-3.1-flash-lite"];
const MOVE_ON = [404, 429, 500, 502, 503];

function models() {
  const main = process.env.GEMINI_MODEL || "gemini-3.8-flash";
  const extra = (process.env.GEMINI_FALLBACK_MODELS ?? "").split(",").map((m) => m.trim()).filter(Boolean);
  return [...new Set([main, ...(extra.length ? extra : DEFAULT_FALLBACKS)])];
}

export async function askGemini<T>(parts: Part[], schema: object): Promise<T> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");
  const call = (model: string) =>
    fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { responseMimeType: "application/json", responseSchema: schema, temperature: 0.4 },
      }),
    });

  let lastError = "";
  for (const model of models()) {
    let res = await call(model);
    // A brief 503 "high demand" often clears in a second or two: one quick retry on the same model first.
    if (res.status === 503) {
      await new Promise((r) => setTimeout(r, 1200));
      res = await call(model);
    }
    if (res.ok) {
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) return JSON.parse(text) as T;
      lastError = `Gemini error 502: ${model} returned no answer`;
      continue;
    }
    lastError = `Gemini error ${res.status} (${model}): ${(await res.text()).slice(0, 300)}`;
    if (!MOVE_ON.includes(res.status)) break; // e.g. a bad request: another model won't help
  }
  throw new Error(lastError || "Gemini returned no answer");
}

/** Splits a data URL ("data:image/png;base64,....") into the pieces Gemini wants. */
export function imagePart(dataUrl: string): Part {
  const m = dataUrl.match(/^data:(.+?);base64,(.*)$/);
  if (!m) throw new Error("Not an image");
  return { inline_data: { mime_type: m[1], data: m[2] } };
}
