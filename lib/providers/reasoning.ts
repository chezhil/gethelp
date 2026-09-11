// Severity-assessment adapters. Every function takes normalized input and
// returns a SeverityResult — swapping providers never touches the UI.

import { getApiKey } from "../store/settings";
import type { SeverityResult } from "../types";
import { describeHttpError, fetchWithRetry } from "./http";

export { ReasoningError, type AssessInput } from "./reasoning-core";
import {
  ReasoningError,
  extractJson,
  normalize,
  systemPromptFor,
  userMessageFor,
  type AssessInput,
} from "./reasoning-core";


export async function assessWithGroq(input: AssessInput): Promise<SeverityResult> {
  const apiKey = await getApiKey("groq");
  if (!apiKey) throw new ReasoningError("No Groq API key set. Add one in Settings.");

  const resp = await fetchWithRetry("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "openai/gpt-oss-120b",
      temperature: 0.3,
      max_tokens: 900,
      // gpt-oss is a reasoning model: it spends completion tokens on an
      // internal "reasoning" pass before writing the final `content`. Low
      // effort keeps that pass short — high effort has burned the whole
      // token budget on reasoning before, leaving `content` empty.
      reasoning_effort: "low",
      messages: [
        { role: "system", content: systemPromptFor(input) },
        { role: "user", content: userMessageFor(input) },
      ],
    }),
  }, { service: "Groq" });

  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    throw new ReasoningError(describeHttpError("Groq", resp.status, body, "Groq API key"));
  }
  const data = await resp.json();
  const text = data?.choices?.[0]?.message?.content;
  if (typeof text !== "string" || !text.trim()) {
    // gpt-oss ran out of its token budget mid-reasoning and never wrote a
    // final answer.
    throw new ReasoningError(
      "Groq ran out of room before it finished answering. Try again — this is usually a one-off."
    );
  }
  return normalize(extractJson(text), Boolean(input.skipClarification));
}

/** Gemini 3.6 Flash — supports an optional photo alongside the text description. */
export async function assessWithGemini(input: AssessInput): Promise<SeverityResult> {
  const apiKey = await getApiKey("gemini");
  if (!apiKey) throw new ReasoningError("No Gemini API key set. Add one in Settings.");

  const parts: Record<string, unknown>[] = [{ text: userMessageFor(input) }];
  if (input.photoBase64) {
    // Use the picker's own reported type. Hardcoding image/jpeg rejects with
    // a 400 whenever the picked file is actually a PNG — common on Android
    // for screenshots and plenty of gallery images.
    parts.push({
      inlineData: { mimeType: input.photoMimeType || "image/jpeg", data: input.photoBase64 },
    });
  }

  const resp = await fetchWithRetry(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent",
    {
      method: "POST",
      headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPromptFor(input) }] },
        contents: [{ role: "user", parts }],
        generationConfig: {
          temperature: 0.3,
          // Gemini 3.x always thinks before answering — it can't be turned
          // off — and that thinking is charged to this same budget. Keep it
          // generous so thinking can't eat the whole allowance and leave a
          // candidate with no text at all (the gpt-oss trap above).
          maxOutputTokens: 2048,
          responseMimeType: "application/json",
        },
      }),
    },
    { service: "Gemini" }
  );

  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    throw new ReasoningError(describeHttpError("Gemini", resp.status, body, "Gemini API key"));
  }
  const data = await resp.json();
  const candidate = data?.candidates?.[0];
  const responseParts = candidate?.content?.parts;
  const text = Array.isArray(responseParts)
    ? responseParts.map((p: { text?: string }) => p.text ?? "").join("")
    : "";
  if (!text) {
    // Translate Gemini's own reason codes into something actionable rather
    // than showing "MAX_TOKENS" or "SAFETY" to someone who's just been hurt.
    const reason = candidate?.finishReason ?? data?.promptFeedback?.blockReason;
    if (reason === "SAFETY" || reason === "PROHIBITED_CONTENT" || reason === "BLOCKED") {
      throw new ReasoningError(
        "Gemini declined to assess this description. Try rephrasing it, or switch to Groq in Settings."
      );
    }
    if (reason === "MAX_TOKENS") {
      throw new ReasoningError(
        "Gemini ran out of room before it finished answering. Try a shorter description."
      );
    }
    throw new ReasoningError(
      `Gemini returned an empty response${reason ? ` (${reason})` : ""}. Try again.`
    );
  }
  return normalize(extractJson(text), Boolean(input.skipClarification));
}

export async function assessSeverity(
  provider: "groq" | "gemini",
  input: AssessInput
): Promise<SeverityResult> {
  return provider === "gemini" ? assessWithGemini(input) : assessWithGroq(input);
}
