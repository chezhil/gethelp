// Severity-assessment adapters. Every function takes normalized input and
// returns a SeverityResult — swapping providers never touches the UI.

import { getApiKey } from "../store/settings";
import type { SeverityResult, SeverityTier } from "../types";

export class ReasoningError extends Error {}

const VALID_TIERS: SeverityTier[] = ["minor", "moderate", "severe", "critical"];

const SYSTEM_PROMPT = `You are a triage-and-routing assistant, not a doctor. You help a person decide
how urgently to seek care and where — you never diagnose a condition.

Return ONLY a single JSON object, no prose, no markdown fences, matching exactly this shape:
{
  "severityTier": "minor" | "moderate" | "severe" | "critical",
  "likelyNature": string,       // brief, plain-language, e.g. "possible ankle sprain"
  "recommendedAction": string,  // one short sentence, routing language only
  "redFlags": string[],         // notable signs found in the description, [] if none
  "needsMoreInfo": boolean,
  "clarifyingQuestion": string  // ONLY include this key if needsMoreInfo is true
}

Rules:
- If the description lacks enough detail to assess severity (e.g. "it hurts", "I got hurt"),
  set needsMoreInfo to true and ask exactly one specific clarifying question
  (e.g. "Where on your body is the injury, and is there visible bleeding?").
  Do NOT guess a severity tier from insufficient input — omit severityTier-driven
  fields with reasonable placeholders in that case is fine, the caller only reads
  clarifyingQuestion when needsMoreInfo is true.
- When genuinely ambiguous between two severity levels, choose the HIGHER (more
  urgent) tier. This is a safer failure mode than under-estimating.
- Never provide a medical diagnosis. Speak only in urgency/routing language:
  "this suggests seeking care at an urgent care clinic", not "you have a fracture".
- Output strictly valid JSON. No text before or after it.`;

function normalize(raw: unknown): SeverityResult {
  if (typeof raw !== "object" || raw === null) {
    throw new ReasoningError("Model response was not a JSON object.");
  }
  const r = raw as Record<string, unknown>;
  const needsMoreInfo = Boolean(r.needsMoreInfo);

  if (needsMoreInfo) {
    const q = typeof r.clarifyingQuestion === "string" ? r.clarifyingQuestion : "";
    if (!q) throw new ReasoningError("needsMoreInfo was true but no clarifyingQuestion was given.");
    return {
      severityTier: "minor",
      likelyNature: "",
      recommendedAction: "",
      redFlags: [],
      needsMoreInfo: true,
      clarifyingQuestion: q,
    };
  }

  const tier = VALID_TIERS.includes(r.severityTier as SeverityTier)
    ? (r.severityTier as SeverityTier)
    : "severe"; // unrecognized tier: fail toward more urgent, not less

  return {
    severityTier: tier,
    likelyNature: typeof r.likelyNature === "string" ? r.likelyNature : "Unable to characterize",
    recommendedAction:
      typeof r.recommendedAction === "string" ? r.recommendedAction : "Seeking in-person care is recommended",
    redFlags: Array.isArray(r.redFlags) ? r.redFlags.filter((x): x is string => typeof x === "string") : [],
    needsMoreInfo: false,
  };
}

function extractJson(text: string): unknown {
  let s = text.trim();
  if (s.startsWith("```")) {
    s = s.replace(/^```[a-zA-Z]*\n?/, "").replace(/```$/, "").trim();
  }
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start === -1 || end === -1) throw new ReasoningError("No JSON object found in model response.");
  return JSON.parse(s.slice(start, end + 1));
}

export interface AssessInput {
  description: string;
  photoBase64?: string; // only used by vision-capable providers
}

/** Groq / Llama 3.3 70B — text only, no vision support. */
export async function assessWithGroq(input: AssessInput): Promise<SeverityResult> {
  const apiKey = await getApiKey("groq");
  if (!apiKey) throw new ReasoningError("No Groq API key set. Add one in Settings.");

  const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      temperature: 0.3,
      max_tokens: 500,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: input.description },
      ],
    }),
  });

  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    throw new ReasoningError(`Groq request failed (${resp.status}): ${body.slice(0, 300)}`);
  }
  const data = await resp.json();
  const text = data?.choices?.[0]?.message?.content;
  if (typeof text !== "string") throw new ReasoningError("Groq response had no message content.");
  return normalize(extractJson(text));
}

/** Gemini 2.5 Flash — supports an optional photo alongside the text description. */
export async function assessWithGemini(input: AssessInput): Promise<SeverityResult> {
  const apiKey = await getApiKey("gemini");
  if (!apiKey) throw new ReasoningError("No Gemini API key set. Add one in Settings.");

  const parts: Record<string, unknown>[] = [{ text: input.description }];
  if (input.photoBase64) {
    parts.push({ inlineData: { mimeType: "image/jpeg", data: input.photoBase64 } });
  }

  const resp = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
    {
      method: "POST",
      headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: "user", parts }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 500 },
      }),
    }
  );

  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    throw new ReasoningError(`Gemini request failed (${resp.status}): ${body.slice(0, 300)}`);
  }
  const data = await resp.json();
  const responseParts = data?.candidates?.[0]?.content?.parts;
  const text = Array.isArray(responseParts)
    ? responseParts.map((p: { text?: string }) => p.text ?? "").join("")
    : "";
  if (!text) throw new ReasoningError("Gemini response had no text content.");
  return normalize(extractJson(text));
}

export async function assessSeverity(
  provider: "groq" | "gemini",
  input: AssessInput
): Promise<SeverityResult> {
  return provider === "gemini" ? assessWithGemini(input) : assessWithGroq(input);
}
