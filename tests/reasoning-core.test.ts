import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ReasoningError,
  extractJson,
  normalize,
  systemPromptFor,
  userMessageFor,
  withClarification,
} from "../lib/providers/reasoning-core.ts";

describe("normalize — safety behaviour", () => {
  // The rule that matters most in this app: when the model returns a tier we
  // do not recognize, fail toward more urgent rather than less. A typo must
  // never quietly become "minor".
  it("falls back to severe on an unrecognized tier", () => {
    const r = normalize({ severityTier: "extremely bad", likelyNature: "x" }, false);
    assert.equal(r.severityTier, "severe");
  });

  it("falls back to severe when the tier is missing entirely", () => {
    assert.equal(normalize({ likelyNature: "x" }, false).severityTier, "severe");
  });

  it("keeps each valid tier as given", () => {
    for (const tier of ["minor", "moderate", "severe", "critical"]) {
      assert.equal(normalize({ severityTier: tier }, false).severityTier, tier);
    }
  });

  it("answers 'moderate', not 'minor', when the user declines to clarify", () => {
    const r = normalize({ needsMoreInfo: true, clarifyingQuestion: "Where exactly?" }, true);
    assert.equal(r.severityTier, "moderate");
    assert.equal(r.needsMoreInfo, false);
    assert.match(r.recommendedAction, /urgent care/i);
  });

  it("rejects a non-object response rather than guessing", () => {
    assert.throws(() => normalize("not json", false), ReasoningError);
    assert.throws(() => normalize(null, false), ReasoningError);
  });

  it("rejects needsMoreInfo with no question, which would hang the flow", () => {
    assert.throws(() => normalize({ needsMoreInfo: true }, false), ReasoningError);
  });

  it("passes a clarifying question straight through", () => {
    const r = normalize({ needsMoreInfo: true, clarifyingQuestion: "Is it bleeding?" }, false);
    assert.equal(r.needsMoreInfo, true);
    assert.equal(r.clarifyingQuestion, "Is it bleeding?");
  });
});

describe("normalize — field coercion", () => {
  it("drops non-string and blank first-aid steps", () => {
    const r = normalize(
      { severityTier: "minor", firstAidSteps: ["Rinse it", "", 42, null, "  ", "Cover it"] },
      false
    );
    assert.deepEqual(r.firstAidSteps, ["Rinse it", "Cover it"]);
  });

  it("returns empty arrays when the model omits the list fields", () => {
    const r = normalize({ severityTier: "minor" }, false);
    assert.deepEqual(r.firstAidSteps, []);
    assert.deepEqual(r.redFlags, []);
  });

  it("survives the list fields arriving as the wrong type", () => {
    const r = normalize({ severityTier: "minor", firstAidSteps: "Rinse it", redFlags: 7 }, false);
    assert.deepEqual(r.firstAidSteps, []);
    assert.deepEqual(r.redFlags, []);
  });

  it("trims a mentioned location and drops a blank one", () => {
    assert.equal(
      normalize({ severityTier: "minor", locationMentioned: "  MG Road " }, false).locationMentioned,
      "MG Road"
    );
    assert.equal(
      normalize({ severityTier: "minor", locationMentioned: "   " }, false).locationMentioned,
      undefined
    );
  });

  it("always supplies a recommended action, even when the model omits one", () => {
    assert.ok(normalize({ severityTier: "minor" }, false).recommendedAction.length > 0);
  });
});

describe("extractJson", () => {
  it("reads a bare JSON object", () => {
    assert.deepEqual(extractJson('{"a":1}'), { a: 1 });
  });

  it("reads JSON out of a markdown fence", () => {
    assert.deepEqual(extractJson('```json\n{"a":1}\n```'), { a: 1 });
    assert.deepEqual(extractJson('```\n{"a":1}\n```'), { a: 1 });
  });

  it("reads JSON with prose either side of it", () => {
    assert.deepEqual(extractJson('Sure! Here you go:\n{"a":1}\nHope that helps.'), { a: 1 });
  });

  it("throws when there is no JSON object at all", () => {
    assert.throws(() => extractJson("I cannot help with that."), ReasoningError);
  });
});

describe("userMessageFor", () => {
  it("sends the description alone when no medical background is saved", () => {
    assert.equal(userMessageFor({ description: "cut my hand" }), "cut my hand");
  });

  it("ignores a medical background of only whitespace", () => {
    assert.equal(userMessageFor({ description: "cut my hand", medicalProfile: "   " }), "cut my hand");
  });

  // Kept as a separate labelled block so the model can tell what the person
  // just said from what is always true of them.
  it("labels the medical background separately from the description", () => {
    const msg = userMessageFor({ description: "hit my head", medicalProfile: "on blood thinners" });
    assert.match(msg, /hit my head/);
    assert.match(msg, /on blood thinners/);
    assert.ok(msg.indexOf("hit my head") < msg.indexOf("on blood thinners"));
  });
});

describe("systemPromptFor", () => {
  it("always forbids diagnosis", () => {
    assert.match(systemPromptFor({ description: "x" }), /never diagnose/i);
  });
});

// The clarify-and-retry loop is the flow this app promises and the one that
// was quietly broken: the answer was appended to React state and the retry
// re-read the *previous* render's description, so the model was re-sent the
// original vague text and asked the same question again. Returning the
// composed string — rather than only writing it to state — is what lets the
// caller send the exact text it just recorded, in the same tick.
describe("withClarification", () => {
  it("carries the answer into the text that gets re-submitted", () => {
    const next = withClarification("my arm hurts", "it's my left forearm, and it's swollen");
    assert.match(next, /my arm hurts/);
    assert.match(next, /left forearm/);
    assert.match(next, /swollen/);
  });

  it("keeps the original description ahead of the added detail", () => {
    const next = withClarification("I fell", "off a ladder, about 3 metres");
    assert.ok(next.indexOf("I fell") < next.indexOf("off a ladder"));
  });

  it("labels the addition so the model can tell it from the first description", () => {
    assert.match(withClarification("I fell", "off a ladder"), /Additional detail:/);
  });

  it("accumulates across more than one round of clarification", () => {
    const once = withClarification("it hurts", "my ankle");
    const twice = withClarification(once, "I can't put weight on it");
    assert.match(twice, /it hurts/);
    assert.match(twice, /my ankle/);
    assert.match(twice, /can't put weight on it/);
  });

  it("trims the answer and ignores one that is only whitespace", () => {
    assert.match(withClarification("I fell", "  off a ladder  "), /detail: off a ladder$/);
    assert.equal(withClarification("I fell", "   "), "I fell");
  });
});

// Every other failure in this app is phrased for someone who has just been
// injured. A truncated model reply used to throw a raw SyntaxError straight
// through to the screen.
describe("extractJson — malformed replies", () => {
  const malformed = [
    ["truncated mid-object", '{"severityTier": "moder'],
    ["truncated after a key", '{"severityTier":'],
    ["trailing comma", '{"severityTier": "minor",}'],
    ["single quotes", "{'severityTier': 'minor'}"],
    ["prose wrapped around broken JSON", 'Here you go: {"severityTier": } hope that helps'],
  ];

  for (const [name, text] of malformed) {
    it(`raises a ReasoningError, not a SyntaxError, on ${name}`, () => {
      assert.throws(() => extractJson(text), ReasoningError);
    });
  }

  it("never puts JSON parser jargon in front of the user", () => {
    try {
      extractJson('{"severityTier": "moder');
      assert.fail("expected extractJson to throw");
    } catch (err) {
      const msg = (err as Error).message;
      assert.doesNotMatch(msg, /JSON\.parse|Unexpected token|Unexpected end of|position \d+/i);
      assert.ok(msg.length > 20, `message was too terse: ${msg}`);
    }
  });

  it("still parses a valid object wrapped in prose and fences", () => {
    const parsed = extractJson('```json\n{"severityTier": "minor"}\n```') as Record<string, unknown>;
    assert.equal(parsed.severityTier, "minor");
  });
});
