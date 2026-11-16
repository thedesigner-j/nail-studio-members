// Shared Trace constants and types (safe to import from client components).
// The designs themselves come from the studio's Figma file; see
// src/lib/trace-sync.ts for how they're read.

export const TRACE_BUCKET = "trace";

// Display order: left hand pinky to thumb, then right hand thumb to pinky,
// the way the hands sit on the table.
export const FINGERS = [
  "L-Pinky",
  "L-Ring",
  "L-Middle",
  "L-Index",
  "L-Thumb",
  "R-Thumb",
  "R-Index",
  "R-Middle",
  "R-Ring",
  "R-Pinky",
] as const;
export type Finger = (typeof FINGERS)[number];

export const FINGER_KINDS = ["Thumb", "Index", "Middle", "Ring", "Pinky"] as const;
export type FingerKind = (typeof FINGER_KINDS)[number];

export const SHAPES = ["Square", "Squoval", "Round", "Oval", "Almond", "Stiletto", "Coffin"] as const;
export type ShapeName = (typeof SHAPES)[number];

export const SIZES = ["S", "M", "L"] as const;
export type SizeName = (typeof SIZES)[number];
export const SIZE_LABELS: Record<SizeName, string> = { S: "Small", M: "Medium", L: "Large" };

export const TIP_STYLES = ["French", "Micro", "V"] as const;
export type TipStyle = (typeof TIP_STYLES)[number];

export type ArtMode = "color" | "line";

// Figma works in points (72 per inch).
export const PT_TO_MM = 25.4 / 72;

export function isFinger(value: string): value is Finger {
  return (FINGERS as readonly string[]).includes(value);
}

export function fingerKind(finger: Finger): FingerKind {
  return finger.slice(2) as FingerKind;
}

export function fingerLabel(finger: Finger) {
  return `${finger.startsWith("L") ? "Left" : "Right"} ${fingerKind(finger).toLowerCase()}`;
}

// A path from Figma, drawn at (x, y) inside the nail.
export type PathPiece = { d: string; x: number; y: number };

// One nail shape at its reference size, in Figma points. The tip of the nail
// (free edge) is at the top; the cuticle end is at the bottom.
export type ShapeGeometry = {
  width: number;
  height: number;
  mask: PathPiece;
  // Where a 1:2 art master sits inside the nail.
  art: { x: number; y: number; w: number; h: number };
  // Filled shape for color mode, outlined stroke for line mode.
  tips: Partial<Record<TipStyle, { fill?: PathPiece; line?: PathPiece }>>;
};

// Real sizes in millimetres: [width, height].
export type ShapeSizes = Partial<Record<SizeName, Partial<Record<FingerKind, [number, number]>>>>;

export type TraceShape = { shape: ShapeName; geometry: ShapeGeometry; sizes: ShapeSizes };

export type FingerInfo = { tip?: TipStyle; tipColor?: string; design?: string };

export type PaletteColor = { name: string; hex: string };

export type ArtUrls = Partial<Record<Finger, { color: string | null; line: string | null }>>;

export type TraceSetSummary = {
  id: string;
  code: string;
  name: string;
  collection: string;
  description: string | null;
  palette: PaletteColor[];
  fingers: Partial<Record<Finger, FingerInfo>>;
  heroFinger: Finger;
  hidden: boolean;
};

// The nail's real size: a preset from the Nail Library, or a custom tip
// width (height follows the shape's proportions).
export function nailSizeMm(
  shape: TraceShape,
  kind: FingerKind,
  size: SizeName,
  customWidthMm?: number | null,
): { w: number; h: number } {
  const ratio = shape.geometry.height / shape.geometry.width;
  if (customWidthMm && customWidthMm > 0) return { w: customWidthMm, h: customWidthMm * ratio };
  const preset = shape.sizes[size]?.[kind];
  if (preset) return { w: preset[0], h: preset[1] };
  const w = shape.geometry.width * PT_TO_MM;
  return { w, h: w * ratio };
}

export function formatMm(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
