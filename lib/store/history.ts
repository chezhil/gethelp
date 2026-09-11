// Past assessments, kept on this device.
//
// Storage is AsyncStorage — localStorage in the browser — so history belongs
// to the browser it was created in. No account, no server, nothing leaves the
// device. Clearing site data clears the history, and a different browser or
// device starts empty. That's the whole contract, and the UI says so.

import AsyncStorage from "@react-native-async-storage/async-storage";
import type { SeverityResult, SeverityTier } from "../types";

export interface HistoryEntry {
  id: string;
  /** ms since epoch — when the assessment was made. */
  at: number;
  description: string;
  severityTier: SeverityTier;
  likelyNature: string;
  recommendedAction: string;
  summary: string;
  redFlags: string[];
  /** Resolved place name, when the search got that far. */
  locationLabel?: string;
  /** Closest facility by ETA, if one was found. */
  nearestFacility?: { name: string; etaSeconds?: number };
}

const HISTORY_KEY = "gethelp.history.v1";
const MAX_ENTRIES = 50;

export async function loadHistory(): Promise<HistoryEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as HistoryEntry[]) : [];
  } catch {
    return [];
  }
}

export async function addHistoryEntry(entry: {
  description: string;
  result: SeverityResult;
  locationLabel?: string;
  nearestFacility?: { name: string; etaSeconds?: number };
}): Promise<void> {
  try {
    const existing = await loadHistory();
    const record: HistoryEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      at: Date.now(),
      description: entry.description,
      severityTier: entry.result.severityTier,
      likelyNature: entry.result.likelyNature,
      recommendedAction: entry.result.recommendedAction,
      summary: entry.result.summary,
      redFlags: entry.result.redFlags,
      locationLabel: entry.locationLabel,
      nearestFacility: entry.nearestFacility,
    };
    // Newest first, capped — this is browser storage, not an archive.
    const next = [record, ...existing].slice(0, MAX_ENTRIES);
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  } catch {
    // Losing a history entry must never break the assessment flow.
  }
}

export async function clearHistory(): Promise<void> {
  try {
    await AsyncStorage.removeItem(HISTORY_KEY);
  } catch {}
}

export async function deleteHistoryEntry(entryId: string): Promise<void> {
  try {
    const existing = await loadHistory();
    await AsyncStorage.setItem(
      HISTORY_KEY,
      JSON.stringify(existing.filter((e) => e.id !== entryId))
    );
  } catch {}
}
