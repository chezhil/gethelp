import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ReasoningError,
  extractJson,
  normalize,
  systemPromptFor,
  userMessageFor,
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
