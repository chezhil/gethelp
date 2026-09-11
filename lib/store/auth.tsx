// Who is signed in, shared app-wide.
//
// The signed-in user is remembered locally so a refresh doesn't sign you out.
// There's no server session — see lib/auth/google.ts for what that does and
// doesn't mean.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { isAuthSupported, signOutOfGoogle, type GoogleUser } from "../auth/google";

const USER_KEY = "gethelp.user.v1";
const CLIENT_ID_KEY = "gethelp.googleClientId.v1";

/**
 * OAuth client ID for Google sign-in. Public by design in a browser OAuth
 * flow — it is not a secret. Left blank here and read from storage instead so
 * it can be set without a rebuild; set it in Settings, or hardcode it here.
 */
export const BUILTIN_GOOGLE_CLIENT_ID = "";

interface AuthState {
  user: GoogleUser | null;
  clientId: string;
  /** False until the stored session has been read back. */
  loaded: boolean;
  /** Sign-in can't work without a client ID, and isn't wired up on native. */
  available: boolean;
  setUser: (user: GoogleUser | null) => void;
  setClientId: (id: string) => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<GoogleUser | null>(null);
  const [clientId, setClientIdState] = useState(BUILTIN_GOOGLE_CLIENT_ID);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [rawUser, storedClientId] = await Promise.all([
          AsyncStorage.getItem(USER_KEY),
          AsyncStorage.getItem(CLIENT_ID_KEY),
        ]);
        if (rawUser) setUserState(JSON.parse(rawUser));
        if (storedClientId) setClientIdState(storedClientId);
      } catch {
        // Corrupt or unavailable storage just means signed out.
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  const setUser = useCallback((next: GoogleUser | null) => {
    setUserState(next);
    if (next) AsyncStorage.setItem(USER_KEY, JSON.stringify(next)).catch(() => {});
    else AsyncStorage.removeItem(USER_KEY).catch(() => {});
  }, []);

  const setClientId = useCallback((id: string) => {
    setClientIdState(id);
    if (id) AsyncStorage.setItem(CLIENT_ID_KEY, id).catch(() => {});
    else AsyncStorage.removeItem(CLIENT_ID_KEY).catch(() => {});
  }, []);

  const signOut = useCallback(() => {
    signOutOfGoogle();
    setUser(null);
  }, [setUser]);

  const value = useMemo<AuthState>(
    () => ({
      user,
      clientId,
      loaded,
      available: isAuthSupported && Boolean(clientId),
      setUser,
      setClientId,
      signOut,
    }),
    [user, clientId, loaded, setUser, setClientId, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
