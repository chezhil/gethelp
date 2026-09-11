// Holds one triage session's state across the Input → Processing → Result
// screens. A plain React context is enough here — nothing needs to survive
// an app restart, and expo-router screens are cheap to keep mounted via a
// shared provider at the root layout.

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { Coords, NearbyFacility, SeverityResult } from "../types";

interface TriageState {
  description: string;
  photoBase64?: string;
  photoUri?: string;
  photoMimeType?: string;
  locationText: string;
  coords?: Coords;
  resolvedLocationLabel?: string;

  result?: SeverityResult;
  facilities?: NearbyFacility[];
  facilitiesError?: string;

  setDescription: (v: string) => void;
  appendClarification: (answer: string) => void;
  setPhoto: (uri?: string, base64?: string, mimeType?: string) => void;
  setLocationText: (v: string) => void;
  setCoords: (c: Coords | undefined, label?: string) => void;
  setResult: (r: SeverityResult | undefined) => void;
  setFacilities: (f: NearbyFacility[] | undefined, error?: string) => void;
  reset: () => void;
}

const TriageContext = createContext<TriageState | null>(null);

export function TriageProvider({ children }: { children: React.ReactNode }) {
  const [description, setDescription] = useState("");
  const [photoBase64, setPhotoBase64] = useState<string | undefined>();
  const [photoUri, setPhotoUri] = useState<string | undefined>();
  const [photoMimeType, setPhotoMimeType] = useState<string | undefined>();
  const [locationText, setLocationText] = useState("");
  const [coords, setCoordsState] = useState<Coords | undefined>();
  const [resolvedLocationLabel, setResolvedLocationLabel] = useState<string | undefined>();
  const [result, setResult] = useState<SeverityResult | undefined>();
  const [facilities, setFacilitiesState] = useState<NearbyFacility[] | undefined>();
  const [facilitiesError, setFacilitiesError] = useState<string | undefined>();

  const appendClarification = useCallback((answer: string) => {
    setDescription((prev) => `${prev}\n\nAdditional detail: ${answer}`);
  }, []);

  const setPhoto = useCallback((uri?: string, base64?: string, mimeType?: string) => {
    setPhotoUri(uri);
    setPhotoBase64(base64);
    setPhotoMimeType(mimeType);
  }, []);

  const setCoords = useCallback((c: Coords | undefined, label?: string) => {
    setCoordsState(c);
    setResolvedLocationLabel(label);
  }, []);

  const setFacilities = useCallback((f: NearbyFacility[] | undefined, error?: string) => {
    setFacilitiesState(f);
    setFacilitiesError(error);
  }, []);

  const reset = useCallback(() => {
    setDescription("");
    setPhotoBase64(undefined);
    setPhotoUri(undefined);
    setPhotoMimeType(undefined);
    setLocationText("");
    setCoordsState(undefined);
    setResolvedLocationLabel(undefined);
    setResult(undefined);
    setFacilitiesState(undefined);
    setFacilitiesError(undefined);
  }, []);

  const value = useMemo<TriageState>(
    () => ({
      description,
      photoBase64,
      photoUri,
      photoMimeType,
      locationText,
      coords,
      resolvedLocationLabel,
      result,
      facilities,
      facilitiesError,
      setDescription,
      appendClarification,
      setPhoto,
      setLocationText,
      setCoords,
      setResult,
      setFacilities,
      reset,
    }),
    [
      description,
      photoBase64,
      photoUri,
      photoMimeType,
      locationText,
      coords,
      resolvedLocationLabel,
      result,
      facilities,
      facilitiesError,
      appendClarification,
      setPhoto,
      setCoords,
      setFacilities,
      reset,
    ]
  );

  return <TriageContext.Provider value={value}>{children}</TriageContext.Provider>;
}

export function useTriage(): TriageState {
  const ctx = useContext(TriageContext);
  if (!ctx) throw new Error("useTriage must be used within a TriageProvider");
  return ctx;
}
