import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { PrimaryButton } from "../components/PrimaryButton";
import { SeverityBadge } from "../components/SeverityBadge";
import { border, CONTENT_MAX_WIDTH, radius, shadow, spacing, type, type Colors } from "../constants/theme";
import { useThemedStyles } from "../lib/store/theme";
import { formatEta } from "../lib/format";
import { clearHistory, deleteHistoryEntry, loadHistory, type HistoryEntry } from "../lib/store/history";

function formatWhen(at: number): string {
  const date = new Date(at);
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  const time = date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (sameDay) return `Today, ${time}`;
  return `${date.toLocaleDateString(undefined, { day: "numeric", month: "short" })}, ${time}`;
}

export default function HistoryScreen() {
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      loadHistory().then((list) => {
        if (active) {
          setEntries(list);
          setLoading(false);
        }
      });
      return () => {
        active = false;
      };
    }, [])
  );

  async function removeEntry(id: string) {
    await deleteHistoryEntry(id);
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  async function removeAll() {
    await clearHistory();
    setEntries([]);
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>History</Text>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Close history"
        >
          <Text style={styles.done}>Done</Text>
        </Pressable>
      </View>

      {loading && <Text style={styles.empty}>Loading…</Text>}

      {!loading && entries.length === 0 && (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>Nothing here yet</Text>
          <Text style={styles.empty}>
            Assessments you run are saved here, in this browser. Nothing is uploaded.
          </Text>
        </View>
      )}

      {entries.map((entry) => {
        const eta = formatEta(entry.nearestFacility?.etaSeconds);
        return (
          <View key={entry.id} style={styles.card}>
            <View style={styles.cardTop}>
              <SeverityBadge tier={entry.severityTier} />
              <Text style={styles.when}>{formatWhen(entry.at)}</Text>
            </View>

            {!!entry.likelyNature && <Text style={styles.nature}>{entry.likelyNature}</Text>}
            <Text style={styles.description} numberOfLines={3}>
              “{entry.description}”
            </Text>

            {!!entry.recommendedAction && (
              <Text style={styles.action}>{entry.recommendedAction}</Text>
            )}

            {!!entry.nearestFacility && (
              <Text style={styles.meta}>
                Nearest: {entry.nearestFacility.name}
                {eta ? ` · ${eta}` : ""}
              </Text>
            )}
            {!!entry.locationLabel && <Text style={styles.meta}>{entry.locationLabel}</Text>}

            <Pressable
              onPress={() => removeEntry(entry.id)}
              accessibilityRole="button"
              accessibilityLabel={`Delete the assessment from ${formatWhen(entry.at)}`}
              hitSlop={12}
              style={styles.deleteButton}
            >
              <Text style={styles.deleteText}>Delete</Text>
            </Pressable>
          </View>
        );
      })}

      {entries.length > 0 && (
        <PrimaryButton
          label="Clear all history"
          variant="outline"
          onPress={removeAll}
          style={styles.clearAll}
        />
      )}
    </ScrollView>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  container: {
    padding: spacing.lg,
    paddingTop: spacing.xxl,
    backgroundColor: colors.bg,
    flexGrow: 1,
    width: "100%",
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: "center",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  title: { ...type.display, color: colors.text, flexShrink: 1 },
  done: {
    ...type.bodyStrong,
    color: colors.text,
    backgroundColor: colors.yellow,
    borderWidth: border.width,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    overflow: "hidden",
  },
  emptyBox: {
    backgroundColor: colors.surface,
    borderWidth: border.width,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.lg,
    ...shadow.sm,
  },
  emptyTitle: { ...type.subtitle, color: colors.text, marginBottom: spacing.xs },
  empty: { ...type.body, color: colors.textMuted },
  card: {
    backgroundColor: colors.surface,
    borderWidth: border.width,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadow.md,
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  when: { ...type.small, color: colors.textMuted },
  nature: { ...type.subtitle, color: colors.text, marginBottom: spacing.xs },
  description: { ...type.body, color: colors.textMuted, fontStyle: "italic" },
  action: { ...type.bodyStrong, color: colors.text, marginTop: spacing.sm },
  meta: { ...type.small, color: colors.textMuted, marginTop: spacing.xs },
  deleteButton: { alignSelf: "flex-start", marginTop: spacing.sm, paddingVertical: spacing.xs },
  deleteText: { ...type.small, color: colors.text, textDecorationLine: "underline" },
  clearAll: { marginTop: spacing.md },
});
