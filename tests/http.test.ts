import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { describeHttpError } from "../lib/providers/http.ts";

// These messages are read by someone who has just been injured, so the bar is
// that each one says what went wrong and what to do next — never a bare code,
// and never a provider's own jargon.
describe("describeHttpError", () => {
  it("names the key and where to fix it on an auth failure", () => {
    const msg = describeHttpError("Gemini", 401, "", "Gemini API key");
    assert.match(msg, /Gemini/);
    assert.match(msg, /rejected the API key/);
    assert.match(msg, /Gemini API key in Settings/);
  });

  it("treats 403 as an auth failure too", () => {
    assert.match(describeHttpError("Gemini", 403, ""), /rejected the API key/);
  });

  it("explains a 404 as a retired model rather than a missing page", () => {
    assert.match(describeHttpError("Groq", 404, ""), /retired|access/i);
  });

  it("tells the user to wait on a rate limit", () => {
    assert.match(describeHttpError("Groq", 429, ""), /Wait a few seconds/);
  });

  it("says a 5xx is temporary and worth retrying", () => {
    for (const status of [500, 502, 503]) {
      assert.match(describeHttpError("Places", status, ""), /busy right now|try again/i);
    }
  });

  it("surfaces the provider's own explanation on a 400", () => {
    const body = JSON.stringify({ error: { message: "Unsupported MIME type: image/heic" } });
    assert.match(describeHttpError("Gemini", 400, body), /Unsupported MIME type/);
  });

  it("still says something useful on a 400 with an unparseable body", () => {
    const msg = describeHttpError("Gemini", 400, "<html>502 Bad Gateway</html>");
    assert.ok(msg.length > 0);
    assert.match(msg, /Gemini/);
  });

  it("includes the status for codes it has no specific advice for", () => {
    assert.match(describeHttpError("Routes", 418, ""), /418/);
  });

  it("never leaks a raw status code with no explanation", () => {
    for (const status of [400, 401, 403, 404, 429, 500, 418]) {
      const msg = describeHttpError("Service", status, "");
      assert.ok(msg.length > 20, `message for ${status} was too terse: ${msg}`);
      assert.ok(/[a-z]/.test(msg), `message for ${status} had no prose`);
    }
  });
});
