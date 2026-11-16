import { useMemo, useSyncExternalStore } from "react";
import type { ShapeName, SizeName } from "@/lib/trace";

// Per-device conveniences for Trace, kept in this browser only. Every read
// and write is guarded: private windows and blocked storage just fall back
// to the defaults.

export type TracePrefs = {
  shape?: ShapeName;
  size?: SizeName;
  customWidth?: number | null;
  // CSS pixels per real millimetre on this screen, from the card calibration.
  pxPerMm?: number;
  opacity?: number;
  brightnessTipSeen?: boolean;
};

const KEY = "trace:prefs";
const CHANGE_EVENT = "trace:prefs-change";

function readRaw() {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function parse(raw: string | null): TracePrefs {
  try {
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? (parsed as TracePrefs) : {};
  } catch {
    return {};
  }
}

export function loadPrefs(): TracePrefs {
  return parse(readRaw());
}

export function savePrefs(patch: Partial<TracePrefs>) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ ...loadPrefs(), ...patch }));
  } catch {
    // Not saved; the setting just won't be remembered next time.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

// The saved prefs, kept in sync with savePrefs. Empty during the server
// render, filled in once the page is running in the browser.
export function usePrefs(): TracePrefs {
  const raw = useSyncExternalStore(subscribe, readRaw, () => null);
  return useMemo(() => parse(raw), [raw]);
}

// A starting guess before calibration: phones show roughly 6 CSS pixels per
// millimetre, desktop screens roughly 3.8 (96 per inch).
export function guessPxPerMm() {
  try {
    return window.matchMedia("(pointer: coarse)").matches ? 6.2 : 96 / 25.4;
  } catch {
    return 96 / 25.4;
  }
}
