import { env } from "../config/env";
import { ApiError } from "./ApiError";

// gemini-2.5-flash is retired for newer API keys. gemini-3.6-flash is the current
// recommended model. Override with GEMINI_MODEL in .env if Google changes this again.
const MODEL = process.env.GEMINI_MODEL ?? "gemini-3.6-flash";
const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export async function askGemini(prompt: string): Promise<string> {
  if (!env.gemini.isConfigured) {
    throw ApiError.internal("AI features are not configured. Set GEMINI_API_KEY in .env.");
  }

  let response: Response;
  try {
    response = await fetch(`${BASE}/${MODEL}:generateContent?key=${env.gemini.apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        // Note: temperature/top_p/top_k are deprecated and ignored on Gemini 3.x
        // models. Sending them can cause a 400. Only set maxOutputTokens here.
        generationConfig: { maxOutputTokens: 800 },
      }),
    });
  } catch (err: any) {
    // Node <18 has no global fetch; also covers DNS/network failures.
    throw ApiError.internal(
      `Could not reach the Gemini API (${err?.message ?? "network error"}). Node 18+ is required.`
    );
  }

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    // eslint-disable-next-line no-console
    console.error(`[Gemini] ${response.status} on model "${MODEL}":`, errText.slice(0, 400));
    throw ApiError.internal(
      `Gemini API error ${response.status} using model "${MODEL}". ${
        response.status === 404
          ? "That model name may not be available for your key — try setting GEMINI_MODEL in .env."
          : response.status === 400 || response.status === 403
          ? "Check that GEMINI_API_KEY is valid and the Generative Language API is enabled."
          : ""
      }`
    );
  }

  const data = (await response.json()) as any;
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    // Usually means the response was blocked by safety filters.
    const reason =
      data?.candidates?.[0]?.finishReason ?? data?.promptFeedback?.blockReason ?? "unknown";
    throw ApiError.internal(`Gemini returned no text (reason: ${reason}).`);
  }
  return text as string;
}
