"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export type FeatureFlags = { guarantors: boolean; kasupda_terms: boolean };

const OFF: FeatureFlags = { guarantors: false, kasupda_terms: false };
let cached: FeatureFlags | null = null;
let inflight: Promise<FeatureFlags> | null = null;

function fetchFlags(): Promise<FeatureFlags> {
  if (!inflight) {
    inflight = api
      .publicFeatures()
      .then((f) => { cached = f; return f; })
      .catch(() => OFF)
      .finally(() => { inflight = null; });
  }
  return inflight;
}

/** Optional features the admin can switch on/off. Everything is off until the
 *  flags load (and stays off if they can't be fetched). */
export function useFeatures(): FeatureFlags {
  const [flags, setFlags] = useState<FeatureFlags>(cached ?? OFF);
  useEffect(() => {
    let alive = true;
    fetchFlags().then((f) => { if (alive) setFlags(f); });
    return () => { alive = false; };
  }, []);
  return flags;
}
