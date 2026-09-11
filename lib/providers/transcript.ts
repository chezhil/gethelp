// Pure transcript handling for voice input.
//
// Split out from the hook in voice.ts so the rule that actually matters can
// be tested: a recognizer streams interim results, each a longer version of
// the same utterance ("my", "my arm", "my arm is"), and only a final result
// may be written into the description. Appending every interim event shipped
// once and turned one spoken sentence into "my my arm my arm is my arm is
// bleeding", so it is worth a test rather than a comment.

export interface TranscriptEvent {
  isFinal: boolean;
  transcript: string;
}

export interface TranscriptState {
  /** Committed text, ready to append to the description. */
  commit: string | null;
  /** Live text to show while speaking. Never written to the description. */
  pending: string;
}

/** What a single recognizer event should do. */
export function reduceTranscript(event: TranscriptEvent): TranscriptState {
  const text = event.transcript ?? "";
  if (event.isFinal) {
    const trimmed = text.trim();
    return { commit: trimmed || null, pending: "" };
  }
  return { commit: null, pending: text };
}

/**
 * Appending a committed phrase to what is already in the box.
 *
 * Separate sentences are joined with a single space; an empty description
 * does not pick up a leading one.
 */
export function appendTranscript(previous: string, addition: string): string {
  const add = addition.trim();
  if (!add) return previous;
  const prev = previous.trimEnd();
  return prev ? `${prev} ${add}` : add;
}
