import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { appendTranscript, reduceTranscript } from "../lib/providers/transcript.ts";

describe("reduceTranscript", () => {
  it("does not commit an interim result", () => {
    const s = reduceTranscript({ isFinal: false, transcript: "my arm" });
    assert.equal(s.commit, null);
    assert.equal(s.pending, "my arm");
  });

  it("commits a final result and clears the pending text", () => {
    const s = reduceTranscript({ isFinal: true, transcript: "my arm is bleeding" });
    assert.equal(s.commit, "my arm is bleeding");
    assert.equal(s.pending, "");
  });

  it("treats a final result of only whitespace as nothing to commit", () => {
    assert.equal(reduceTranscript({ isFinal: true, transcript: "   " }).commit, null);
  });

  // The regression this module exists for: one sentence arriving as a stream
  // of growing interims must produce exactly one appended sentence, not one
  // per event.
  it("appends one sentence for a whole stream of interim results", () => {
    const stream = [
      { isFinal: false, transcript: "Although" },
      { isFinal: false, transcript: "Although I think" },
      { isFinal: false, transcript: "Although I think my friend" },
      { isFinal: true, transcript: "Although I think my friend broke his arm" },
    ];
    let description = "";
    for (const event of stream) {
      const next = reduceTranscript(event);
      if (next.commit !== null) description = appendTranscript(description, next.commit);
    }
    assert.equal(description, "Although I think my friend broke his arm");
  });

  it("keeps separate sentences when the recognizer finalizes more than once", () => {
    let description = "";
    for (const event of [
      { isFinal: false, transcript: "my arm" },
      { isFinal: true, transcript: "my arm is bleeding badly" },
      { isFinal: false, transcript: "there is glass" },
      { isFinal: true, transcript: "there is glass in the cut" },
    ]) {
      const next = reduceTranscript(event);
      if (next.commit !== null) description = appendTranscript(description, next.commit);
    }
    assert.equal(description, "my arm is bleeding badly there is glass in the cut");
  });
});

describe("appendTranscript", () => {
  it("does not put a leading space on an empty description", () => {
    assert.equal(appendTranscript("", "hello"), "hello");
  });

  it("separates additions with a single space", () => {
    assert.equal(appendTranscript("hello", "there"), "hello there");
    assert.equal(appendTranscript("hello ", "there"), "hello there");
  });

  it("leaves the description untouched when there is nothing to add", () => {
    assert.equal(appendTranscript("hello", "   "), "hello");
  });
});
