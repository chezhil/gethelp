// Severity-assessment adapters. Every function takes normalized input and
// returns a SeverityResult — swapping providers never touches the UI.

import { getApiKey } from "../store/settings";
import type { SeverityResult, SeverityTier } from "../types";
import { describeHttpError, fetchWithRetry } from "./http";

export class ReasoningError extends Error {}

const VALID_TIERS: SeverityTier[] = ["minor", "moderate", "severe", "critical"];

const SYSTEM_PROMPT = `You are a triage-and-routing assistant, not a doctor. You help a person decide
how urgently to seek care and where — you never diagnose a condition.

Return ONLY a single JSON object, no prose, no markdown fences, matching exactly this shape:
{
  "severityTier": "minor" | "moderate" | "severe" | "critical",
  "likelyNature": string,       // brief, plain-language, e.g. "possible ankle sprain"
  "summary": string,            // 2-3 plain-language sentences: what might be going on
                                 // and why that maps to this urgency tier — more detail
                                 // than likelyNature, still never a diagnosis
  "recommendedAction": string,  // one short sentence, routing language only
  "firstAidSteps": string[],    // 2-4 things to do RIGHT NOW while getting to
                                 // care, most urgent first, one short
                                 // imperative each ("Keep the arm still and
                                 // supported"). [] if there is nothing useful
                                 // to do. Never anything that needs training
                                 // or equipment a bystander won't have.
  "redFlags": string[],         // notable signs found in the description, [] if none
  "locationMentioned": string,  // a place the user named ("at Indiranagar",
                                 // "near MG Road"), or "" if they named none.
                                 // Do NOT invent one.
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
- If a medical background is supplied, weigh it: blood thinners raise the
  urgency of a head knock or any bleeding, diabetes raises it for foot wounds,
  and so on. Mention the relevant factor in redFlags when it changed your
  assessment. Do not mention it when it made no difference.
- Never provide a medical diagnosis, in either recommendedAction or summary. Speak
  only in urgency/routing language: "this suggests seeking care at an urgent care
  clinic" / "swelling and reduced movement like this often point to a soft-tissue
  or bone injury that's worth an in-person look" — never "you have a fracture".
- firstAidSteps are immediate, safe, bystander-level actions only — rest, ice,
  elevation, pressure on bleeding, keeping still, not eating before possible
  surgery. Never suggest medication doses, moving someone with a possible
  spinal injury, or anything requiring equipment or training.
- Output strictly valid JSON. No text before or after it.`;

function normalize(raw: unknown, forceAnswer: boolean): SeverityResult {
  if (typeof raw !== "object" || raw === null) {
    throw new ReasoningError("Model response was not a JSON object.");
  }
  const r = raw as Record<string, unknown>;
  const needsMoreInfo = Boolean(r.needsMoreInfo);

  if (needsMoreInfo && forceAnswer) {
    // The user chose to skip further clarification, but the model asked
    // again anyway — fall back to a safe, honest answer rather than nag a
    // second time. "moderate" (not "minor") because we genuinely don't have
    // enough to rule out something worse, per the higher-tier-on-ambiguity
    // rule everywhere else in this file.
    return {
      severityTier: "moderate",
      likelyNature: "Not enough detail to characterize precisely",
      summary:
        "There wasn't quite enough detail to narrow this down further, and you've chosen not to answer another question. Given that uncertainty, it's safer to treat this as worth an in-person look rather than assume it's minor.",
      recommendedAction:
        "Limited information was provided — seeking in-person urgent care is recommended for a proper evaluation.",
      firstAidSteps: [],
      redFlags: [],
      needsMoreInfo: false,
    };
  }

  if (needsMoreInfo) {
    const q = typeof r.clarifyingQuestion === "string" ? r.clarifyingQuestion : "";
    if (!q) throw new ReasoningError("needsMoreInfo was true but no clarifyingQuestion was given.");
    return {
      severityTier: "minor",
      likelyNature: "",
      summary: "",
      recommendedAction: "",
      firstAidSteps: [],
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
    summary: typeof r.summary === "string" ? r.summary : "",
    recommendedAction:
      typeof r.recommendedAction === "string" ? r.recommendedAction : "Seeking in-person care is recommended",
    firstAidSteps: Array.isArray(r.firstAidSteps)
      ? r.firstAidSteps.filter((x): x is string => typeof x === "string" && x.trim().length > 0)
      : [],
    redFlags: Array.isArray(r.redFlags) ? r.redFlags.filter((x): x is string => typeof x === "string") : [],
    locationMentioned:
      typeof r.locationMentioned === "string" && r.locationMentioned.trim()
        ? r.locationMentioned.trim()
        : undefined,
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
  /** The picker's reported type for that photo, e.g. "image/png". */
  photoMimeType?: string;
  /** User declined to answer another clarifying question — answer now regardless. */
  skipClarification?: boolean;
  /** Free-text conditions/medications/allergies the user saved in Settings. */
  medicalProfile?: string;
}

/**
 * The description, plus any standing medical context. Kept as a separate
 * labelled block rather than glued onto the description, so the model can
 * tell what the person just said from what's always true of them.
 */
function userMessageFor(input: AssessInput): string {
  const profile = input.medicalProfile?.trim();
  if (!profile) return input.description;
  return `${input.description}

---
Known medical background for this person (may or may not be relevant): ${profile}`;
}

function systemPromptFor(input: AssessInput): string {
  if (!input.skipClarification) return SYSTEM_PROMPT;
  return `${SYSTEM_PROMPT}

The user has chosen not to answer further clarifying questions. You MUST set
needsMoreInfo to false and give your best assessment now, using only the
information already given — do not ask another question. Where details are
missing, default to a higher urgency tier rather than a lower one.`;
}

/**
 * Groq / GPT-OSS 120B — text only, no vision support.
 * (Groq deprecated llama-3.3-70b-versatile; gpt-oss-120b is the current
 * fast, free-tier-friendly text model on their catalog.)
 */
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
