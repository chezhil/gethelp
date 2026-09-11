// Sign in with Google, client-side only.
//
// The app has no backend — it's a static site — so this uses Google Identity
// Services directly in the browser. GIS hands back a signed ID token (JWT)
// containing the user's profile; we read the profile out of it to identify
// whose history is whose.
//
// Worth being precise about what that is and isn't: we do NOT verify the
// token's signature, because there is no server to verify it against and
// nothing privileged behind it. It identifies the account for the purpose of
// keeping one person's history separate from another's on this device. It is
// not an authorization boundary, and it must not become one without a
// backend that verifies the token properly.

import { Platform } from "react-native";

const GIS_SRC = "https://accounts.google.com/gsi/client";

export interface GoogleUser {
  /** Google's stable account id ("sub"), used to key stored history. */
  id: string;
  email: string;
  name: string;
  picture?: string;
}

export class AuthError extends Error {}

/** Google sign-in is only wired up for web; native would need a redirect flow. */
export const isAuthSupported = Platform.OS === "web";

let scriptPromise: Promise<void> | null = null;

function loadGisScript(): Promise<void> {
  if (!isAuthSupported) {
    return Promise.reject(new AuthError("Google sign-in is only available on the web app."));
  }
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    if ((globalThis as any).google?.accounts?.id) return resolve();

    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GIS_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () =>
        reject(new AuthError("Couldn't load Google sign-in."))
      );
      return;
    }

    const script = document.createElement("script");
    script.src = GIS_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new AuthError("Couldn't load Google sign-in."));
    document.head.appendChild(script);
  });

  return scriptPromise;
}

/** Read the payload out of a JWT without verifying it — see file header. */
export function decodeIdToken(idToken: string): GoogleUser {
  const [, payload] = idToken.split(".");
  if (!payload) throw new AuthError("Malformed sign-in token.");

  // base64url → base64, then decode.
  const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
  const json = decodeURIComponent(
    atob(base64)
      .split("")
      .map((c) => `%${`00${c.charCodeAt(0).toString(16)}`.slice(-2)}`)
      .join("")
  );
  const claims = JSON.parse(json) as Record<string, unknown>;

  const id = typeof claims.sub === "string" ? claims.sub : "";
  if (!id) throw new AuthError("Sign-in token had no account id.");

  return {
    id,
    email: typeof claims.email === "string" ? claims.email : "",
    name:
      (typeof claims.name === "string" && claims.name) ||
      (typeof claims.email === "string" ? claims.email.split("@")[0] : "") ||
      "Signed in",
    picture: typeof claims.picture === "string" ? claims.picture : undefined,
  };
}

/**
 * Render Google's own sign-in button into `container`. GIS requires its
 * button (or One Tap) to start the flow — a plain button can't trigger it.
 */
export async function renderGoogleButton(
  container: HTMLElement,
  clientId: string,
  onUser: (user: GoogleUser) => void,
  onError: (message: string) => void
): Promise<void> {
  await loadGisScript();
  const google = (globalThis as any).google;
  if (!google?.accounts?.id) throw new AuthError("Google sign-in didn't initialize.");

  google.accounts.id.initialize({
    client_id: clientId,
    callback: (response: { credential?: string }) => {
      try {
        if (!response.credential) throw new AuthError("Sign-in returned no credential.");
        onUser(decodeIdToken(response.credential));
      } catch (err) {
        onError(err instanceof Error ? err.message : "Sign-in failed.");
      }
    },
  });

  container.innerHTML = "";
  google.accounts.id.renderButton(container, {
    theme: "outline",
    size: "large",
    text: "signin_with",
    shape: "rectangular",
    logo_alignment: "left",
  });
}

export function signOutOfGoogle(): void {
  try {
    (globalThis as any).google?.accounts?.id?.disableAutoSelect?.();
  } catch {
    // Nothing to clean up if GIS never loaded.
  }
}
