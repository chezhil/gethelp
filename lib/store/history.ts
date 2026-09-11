// Past assessments, stored per signed-in account.
//
// Storage is local to the device (AsyncStorage, which is localStorage on
// web). Entries are keyed by Google account id so two people signing in on
// the same browser don't see each other's history — but this is not synced
// across devices, because there's no backend to sync to. Signing in on a
// different browser starts an empty history.

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

const MAX_ENTRIES = 50;

function keyFor(userId: string): string {
  return `gethelp.history.v1.${userId}`;
}

export async function loadHistory(userId: string): Promise<HistoryEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(keyFor(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as HistoryEntry[]) : [];
  } catch {
    return [];
  }
}

export async function addHistoryEntry(
  userId: string,
  entry: {
    description: string;
    result: SeverityResult;
    locationLabel?: string;
    nearestFacility?: { name: string; etaSeconds?: number };
  }
): Promise<void> {
  try {
    const existing = await loadHistory(userId);
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
    // Newest first, capped — this is a phone's storage, not an archive.
    const next = [record, ...existing].slice(0, MAX_ENTRIES);
    await AsyncStorage.setItem(keyFor(userId), JSON.stringify(next));
  } catch {
    // Losing a history entry must never break the assessment flow.
  }
}

export async function clearHistory(userId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(keyFor(userId));
  } catch {}
}

export async function deleteHistoryEntry(userId: string, entryId: string): Promise<void> {
  try {
    const existing = await loadHistory(userId);
    await AsyncStorage.setItem(
      keyFor(userId),
      JSON.stringify(existing.filter((e) => e.id !== entryId))
    );
  } catch {}
}
