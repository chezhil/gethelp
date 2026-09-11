// Save-as-you-type, without a write per keystroke.
//
// The BYOK key fields and the medical-profile box both persist on change
// rather than behind a Save button — there is nothing to submit, and a key
// lost to someone closing the screen is a worse failure than a slightly late
// write. Done literally, though, that was one device-storage write per
// character: on native an API key meant a keychain round-trip per keystroke.
//
// This keeps the contract and coalesces the bursts, flushing whatever is
// outstanding when the screen goes away.

import { useEffect, useRef } from "react";

export function useDebouncedPersist(
  value: string,
  /**
   * Gate the write until the stored value has actually been read back.
   * Both fields start empty and fill in asynchronously, so persisting before
   * then would write that empty placeholder over the real saved value.
   */
  enabled: boolean,
  save: (value: string) => void,
  delayMs = 400
): void {
  const saveRef = useRef(save);
  saveRef.current = save;
  /** The latest value not yet written, so unmount can flush it. */
  const outstanding = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    outstanding.current = value;
    const id = setTimeout(() => {
      outstanding.current = null;
      saveRef.current(value);
    }, delayMs);
    return () => clearTimeout(id);
  }, [value, enabled, delayMs]);

  // Separate effect, declared second so its cleanup runs after the timer above
  // has been cleared — closing the screen mid-word still saves the word.
  useEffect(
    () => () => {
      if (outstanding.current !== null) saveRef.current(outstanding.current);
    },
    []
  );
}
