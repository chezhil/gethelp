// Whether the first-run setup has been completed on this device.
//
// Deliberately a flag rather than an inference from "is a key present": if
// someone deliberately skips setup and starts typing, re-showing the setup
// screen on every launch would be nagging, not helping. The Input screen's
// SETUP NEEDED banner is the gentler reminder that stays.

import AsyncStorage from "@react-native-async-storage/async-storage";

const ONBOARDED_KEY = "gethelp.onboarded.v1";

export async function hasOnboarded(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(ONBOARDED_KEY)) === "1";
  } catch {
    // Storage unavailable (private browsing). Treat as onboarded so the app
    // is still usable rather than trapping the user on the setup screen.
    return true;
  }
}

export async function setOnboarded(): Promise<void> {
  try {
    await AsyncStorage.setItem(ONBOARDED_KEY, "1");
  } catch {}
}
