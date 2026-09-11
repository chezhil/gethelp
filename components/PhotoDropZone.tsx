import { useEffect, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { border, colors, radius, shadow, spacing, type } from "../constants/theme";

/** Gemini's inline image limit is generous, but a 20MP phone photo isn't worth sending. */
const MAX_BYTES = 10 * 1024 * 1024;

interface Props {
  onPhoto: (uri: string, base64: string, mimeType: string) => void;
}

/**
 * Drag-and-drop photo target for desktop browsers.
 *
 * Renders nothing off web — there's no drag-and-drop on a phone, where the
 * Camera and Gallery buttons are the right affordance anyway. Clicking it
 * opens a file picker too, since a box you can only drop onto is a trap for
 * anyone using a keyboard or a trackpad they'd rather not drag with.
 */
export function PhotoDropZone({ onPhoto }: Props) {
  const hostRef = useRef<View | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const node = hostRef.current as unknown as HTMLElement | null;
    if (!node) return;

    const readFile = (file: File | undefined) => {
      setError(null);
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        setError(`That's a ${file.type || "file"} — drop an image instead.`);
        return;
      }
      if (file.size > MAX_BYTES) {
        setError(`That image is ${(file.size / 1024 / 1024).toFixed(1)}MB — 10MB is the limit.`);
        return;
      }
      const reader = new FileReader();
      reader.onerror = () => setError("Couldn't read that file.");
      reader.onload = () => {
        const dataUrl = typeof reader.result === "string" ? reader.result : "";
        const comma = dataUrl.indexOf(",");
        if (comma === -1) {
          setError("Couldn't read that image.");
          return;
        }
        // data:image/png;base64,AAAA… → mime type + the raw base64 the
        // vision API wants, without the data-URL prefix.
        const mimeType = dataUrl.slice(5, dataUrl.indexOf(";"));
        onPhoto(dataUrl, dataUrl.slice(comma + 1), mimeType || file.type);
      };
      reader.readAsDataURL(file);
    };

    // The page as a whole would otherwise just navigate to the dropped file.
    const prevent = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };
    const onDragEnter = (e: DragEvent) => {
      prevent(e);
      setDragging(true);
    };
    const onDragOver = (e: DragEvent) => {
      prevent(e);
      setDragging(true);
    };
    const onDragLeave = (e: DragEvent) => {
      prevent(e);
      // Ignore leave events fired as the cursor crosses child elements.
      if (node.contains(e.relatedTarget as Node | null)) return;
      setDragging(false);
    };
    const onDrop = (e: DragEvent) => {
      prevent(e);
      setDragging(false);
      readFile(e.dataTransfer?.files?.[0]);
    };

    node.addEventListener("dragenter", onDragEnter);
    node.addEventListener("dragover", onDragOver);
    node.addEventListener("dragleave", onDragLeave);
    node.addEventListener("drop", onDrop);

    // Hidden input so the same box works as a click-to-browse target.
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.style.display = "none";
    input.addEventListener("change", () => {
      readFile(input.files?.[0]);
      input.value = ""; // let the same file be picked twice in a row
    });
    document.body.appendChild(input);
    inputRef.current = input;

    return () => {
      node.removeEventListener("dragenter", onDragEnter);
      node.removeEventListener("dragover", onDragOver);
      node.removeEventListener("dragleave", onDragLeave);
      node.removeEventListener("drop", onDrop);
      input.remove();
      inputRef.current = null;
    };
  }, [onPhoto]);

  if (Platform.OS !== "web") return null;

  return (
    <View>
      <Pressable onPress={() => inputRef.current?.click()} accessibilityRole="button">
        <View ref={hostRef} style={[styles.zone, dragging && styles.zoneActive]}>
          <Text style={styles.icon}>🖼</Text>
          <Text style={styles.title}>
            {dragging ? "Drop it" : "Drag a photo here"}
          </Text>
          <Text style={styles.hint}>or click to browse · JPG or PNG, up to 10MB</Text>
        </View>
      </Pressable>
      {!!error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  zone: {
    borderWidth: border.width,
    borderColor: colors.border,
    borderStyle: "dashed",
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.md,
    ...shadow.sm,
  },
  // Solid border and a colour shift so it's obvious the drop will land here.
  zoneActive: {
    borderStyle: "solid",
    backgroundColor: colors.cyan,
    ...shadow.md,
  },
  icon: { fontSize: 26, marginBottom: spacing.xs },
  title: { ...type.bodyStrong, color: colors.text },
  hint: { ...type.small, color: colors.textMuted, marginTop: 2, textAlign: "center" },
  error: {
    ...type.small,
    color: colors.text,
    backgroundColor: colors.orange,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginTop: spacing.sm,
    overflow: "hidden",
  },
});
