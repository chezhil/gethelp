// Provider-independent severity logic.
//
// Split out from reasoning.ts so it can be exercised without pulling in
// react-native through the settings store: these are pure functions over a
// model's raw reply, which is exactly the part worth testing. reasoning.ts
// re-exports nothing from here that callers need — it is the only consumer.

import type { SeverityResult, SeverityTier } from "../types";

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

export function normalize(raw: unknown, forceAnswer: boolean): SeverityResult {
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

export function extractJson(text: string): unknown {
  let s = text.trim();
  if (s.startsWith("```")) {
    s = s.replace(/^```[a-zA-Z]*\n?/, "").replace(/```$/, "").trim();
  }
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start === -1 || end === -1) throw new ReasoningError("No JSON object found in model response.");
  try {
    return JSON.parse(s.slice(start, end + 1));
  } catch {
    // A truncated or malformed reply throws a raw SyntaxError whose message
    // ("Unexpected end of JSON input") would go straight to the screen. Every
    // other failure in this app is phrased for someone who has just been
    // injured; this one has to be too.
    throw new ReasoningError(
      "The model's reply came back incomplete. Try again — this is usually a one-off."
    );
  }
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
export function userMessageFor(input: AssessInput): string {
  const profile = input.medicalProfile?.trim();
  if (!profile) return input.description;
  return `${input.description}

---
Known medical background for this person (may or may not be relevant): ${profile}`;
}

export function systemPromptFor(input: AssessInput): string {
  if (!input.skipClarification) return SYSTEM_PROMPT;
  return `${SYSTEM_PROMPT}

The user has chosen not to answer further clarifying questions. You MUST set
needsMoreInfo to false and give your best assessment now, using only the
information already given — do not ask another question. Where details are
missing, default to a higher urgency tier rather than a lower one.`;
}

/**
 * The description to re-submit after the user answers a clarifying question.
 *
 * Pure, and returned rather than applied to state, because the caller has to
 * send this exact text in the same tick it records it — a React state update
 * is not visible until the next render, and re-reading the store there would
 * re-send the original description and silently drop the answer.
 */
export function withClarification(previous: string, answer: string): string {
  const extra = answer.trim();
  if (!extra) return previous;
  return `${previous}\n\nAdditional detail: ${extra}`;
}
