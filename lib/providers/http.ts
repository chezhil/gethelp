// Shared HTTP handling for every provider adapter.
//
// Providers return their own error shapes and their own jargon; none of it
// belongs on screen in front of someone who has just been injured. This turns
// a status code and response body into one plain sentence that says what went
// wrong and what to do about it, and retries the failures that are worth
// retrying rather than surfacing them at all.

const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

/**
 * Pull the human-readable message out of a provider's error body.
 * Google and Groq both nest it under `error.message`; anything else falls
 * back to the raw text.
 */
function providerMessage(body: string): string | null {
  try {
    const parsed = JSON.parse(body);
    const msg = parsed?.error?.message;
    if (typeof msg === "string" && msg.trim()) return msg.trim();
  } catch {
    // not JSON — fall through
  }
  const trimmed = body.trim();
  return trimmed && trimmed.length < 200 ? trimmed : null;
}

/**
 * One plain sentence describing an HTTP failure, in terms of what the person
 * using the app can actually do about it.
 *
 * `service` is what the user sees ("Gemini", "Google Places"), and
 * `keyLocation` names where its key lives in Settings, when it has one.
 */
export function describeHttpError(
  service: string,
  status: number,
  body: string,
  keyLocation?: string
): string {
  const detail = providerMessage(body);
  const fixKey = keyLocation
    ? `Check your ${keyLocation} in Settings.`
    : "Check the key in Settings.";

  switch (true) {
    case status === 401 || status === 403:
      return `${service} rejected the API key. ${fixKey}`;
    case status === 404:
      return `${service} couldn't find the model or endpoint — it may have been retired, or your key may not have access to it.`;
    case status === 429:
      return `${service} is rate-limiting requests. Wait a few seconds and try again.`;
    case status === 400:
      return detail
        ? `${service} rejected the request: ${detail}`
        : `${service} rejected the request as invalid.`;
    case status >= 500:
      // Providers' own 5xx text ("Spikes in demand are usually temporary…")
      // just repeats the advice, so drop it and say it once, plainly.
      return `${service} is busy right now. This usually clears in a few seconds — try again.`;
    default:
      return detail
        ? `${service} request failed (${status}): ${detail}`
        : `${service} request failed (${status}).`;
  }
}

/** A failed fetch (no response at all) is almost always connectivity. */
export function describeNetworkError(service: string): string {
  return `Couldn't reach ${service}. Check your internet connection and try again.`;
}

/** Thrown when a request never got a response, after all retries. */
export class NetworkError extends Error {}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface FetchOptions {
  /** User-facing service name, used in error messages. */
  service: string;
  /** How many times to retry a retryable failure. */
  retries?: number;
  /** Base delay between retries, doubled each attempt. */
  retryDelayMs?: number;
}

/**
 * fetch() that retries transient failures (429/5xx and network drops) and
 * converts a dead connection into a readable error instead of a raw
 * "Network request failed" TypeError.
 *
 * Returns the Response as-is on success or on a non-retryable failure — the
 * caller still decides how to describe a bad status, since only it knows
 * which key to point at.
 */
export async function fetchWithRetry(
  url: string,
  init: RequestInit,
  { service, retries = 2, retryDelayMs = 700 }: FetchOptions
): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const resp = await fetch(url, init);
      // On the final attempt, hand back whatever we got — the caller turns a
      // bad status into a message naming the right key to check.
      if (!RETRYABLE_STATUSES.has(resp.status) || attempt === retries) return resp;
    } catch {
      if (attempt === retries) throw new NetworkError(describeNetworkError(service));
    }
    await sleep(retryDelayMs * 2 ** attempt);
  }

  // Unreachable: the final iteration always returns or throws.
  throw new NetworkError(describeNetworkError(service));
}
