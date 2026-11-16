import type { FigmaNode, FigmaPaint } from "@/lib/figma";
import {
  FINGERS,
  PT_TO_MM,
  SHAPES,
  TIP_STYLES,
  isFinger,
  type Finger,
  type FingerInfo,
  type PaletteColor,
  type PathPiece,
  type ShapeGeometry,
  type ShapeName,
  type ShapeSizes,
  type TipStyle,
} from "@/lib/trace";

// Reads the structure of the studio's Figma file into what Trace stores.
// Pure functions (no network, no database), shared by the server-side Figma
// sync and the admin's "Import from Figma" upload, which runs them in the
// browser on the file the Figma plugin saved.
//
// What it expects in Figma (the layout the "Sets Book" file uses):
//   - Pages named "Sets - <Collection>", holding one section per set named
//     "<CODE> · <Name>" (e.g. "X01 · Candy Cane Lane"). Each section has an
//     "Art Masters" frame with components "Art/<CODE>/<L|R>-<Finger>" (color)
//     and "… · Line" (tracing lines), plus a "<CODE> · Color Ref" frame.
//   - A component set named "Nail" with variants
//     "Shape=…, Size=S|M|L, Finger=…, Mode=Color|Line" drawn at real size.
//
// Nodes follow the Figma REST API's shape; the plugin writes the same shape.

const SET_PAGE = /^sets?\s*[-–—·:|]\s*(.+)$/i;
const SET_SECTION = /^([A-Za-z]+\d+)\s*[·•|:\-–—]\s*(.+)$/;
const ART_NAME = /^Art\/[^/]+\/([LR])-(Thumb|Index|Middle|Ring|Pinky)(?:\s*[·•|\-–—]?\s*(Line))?$/i;
const INSTANCE_FINGER = /^([LR])\s+(Thumb|Index|Middle|Ring|Pinky)\b/i;
const FINGER_MENTION = /\b([LR])\s+(Thumb|Index|Middle|Ring|Pinky)\b/gi;
const VARIANT = /Shape=([^,]+),\s*Size=([^,]+),\s*Finger=([^,]+),\s*Mode=([^,]+)/i;

export type PlannedSet = {
  code: string;
  name: string;
  collection: string;
  sortOrder: number;
  figmaNodeId: string;
  artFrameId: string;
  colorRefId: string | null;
};

type VariantInfo = { id: string; shape: string; size: string; finger: string; mode: string; w: number; h: number };

// === Small helpers ===========================================================

const round = (n: number) => Math.round(n * 1000) / 1000;
const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

function toFinger(side: string, kind: string): Finger | null {
  const finger = `${side.toUpperCase()}-${titleCase(kind)}`;
  return isFinger(finger) ? finger : null;
}

function text(node: FigmaNode) {
  return (node.characters ?? node.name).trim();
}

function hexFromFills(fills: FigmaPaint[] | undefined) {
  const solid = (fills ?? []).find((f) => f.type === "SOLID" && f.visible !== false && f.color);
  if (!solid?.color) return undefined;
  const { r, g, b } = solid.color;
  return "#" + [r, g, b].map((v) => Math.round(v * 255).toString(16).padStart(2, "0")).join("");
}

function box(node: FigmaNode) {
  return node.absoluteBoundingBox ?? { x: 0, y: 0, width: 0, height: 0 };
}

function piece(node: FigmaNode, parent: FigmaNode, kind: "fill" | "stroke"): PathPiece | null {
  const geometry = kind === "fill" ? node.fillGeometry : node.strokeGeometry;
  const d = (geometry ?? []).map((g) => g.path).join(" ").trim();
  if (!d) return null;
  return { d, x: round(box(node).x - box(parent).x), y: round(box(node).y - box(parent).y) };
}

function compareCodes(a: string, b: string) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

// === Reading the file's structure ============================================

export function findStructure(document: FigmaNode) {
  const byCollection: { collection: string; sets: Omit<PlannedSet, "sortOrder">[] }[] = [];
  const variants: VariantInfo[] = [];

  for (const page of document.children ?? []) {
    for (const child of page.children ?? []) {
      if (child.type === "COMPONENT_SET" && child.name.trim().toLowerCase() === "nail") {
        for (const v of child.children ?? []) {
          const m = v.name.match(VARIANT);
          if (!m) continue;
          const b = box(v);
          variants.push({
            id: v.id,
            shape: m[1].trim(),
            size: m[2].trim().toUpperCase(),
            finger: titleCase(m[3].trim()),
            mode: m[4].trim().toLowerCase(),
            w: b.width,
            h: b.height,
          });
        }
      }
    }

    const pageMatch = page.name.trim().match(SET_PAGE);
    if (!pageMatch) continue;
    const collection = pageMatch[1].trim();
    const sets: Omit<PlannedSet, "sortOrder">[] = [];

    for (const section of page.children ?? []) {
      const sectionMatch = section.name.trim().match(SET_SECTION);
      if (!sectionMatch) continue;
      const frames = section.children ?? [];
      const artFrame = frames.find((f) => /^art masters$/i.test(f.name.trim()));
      if (!artFrame) continue;
      const colorRef = frames.find((f) => /colou?r ref$/i.test(f.name.trim()));
      sets.push({
        code: sectionMatch[1].toUpperCase(),
        name: sectionMatch[2].trim(),
        collection,
        figmaNodeId: section.id,
        artFrameId: artFrame.id,
        colorRefId: colorRef?.id ?? null,
      });
    }

    if (sets.length > 0) byCollection.push({ collection, sets });
  }

  const sets: PlannedSet[] = [];
  byCollection.forEach(({ sets: group }, collectionIndex) => {
    group
      .sort((a, b) => compareCodes(a.code, b.code))
      .forEach((set, i) => sets.push({ ...set, sortOrder: collectionIndex * 1000 + i }));
  });

  // Each shape's real sizes, and the variants whose geometry we read
  // (M · Middle, in both modes).
  const sizes: Record<string, ShapeSizes> = {};
  const reference: Record<string, { color?: string; line?: string }> = {};
  for (const v of variants) {
    if (v.mode === "color") {
      const shape = (sizes[v.shape] ??= {});
      const size = (shape[v.size as keyof ShapeSizes] ??= {});
      (size as Record<string, [number, number]>)[v.finger] = [
        Math.round(v.w * PT_TO_MM * 10) / 10,
        Math.round(v.h * PT_TO_MM * 10) / 10,
      ];
    }
    const ref = (reference[v.shape] ??= {});
    const isPreferred = v.size === "M" && v.finger === "Middle";
    if (v.mode === "color" && (isPreferred || !ref.color)) ref.color = v.id;
    if (v.mode === "line" && (isPreferred || !ref.line)) ref.line = v.id;
  }

  return { sets, sizes, reference };
}

export function parseArtMasters(frame: FigmaNode) {
  const art: Partial<Record<Finger, { color?: string; line?: string }>> = {};
  for (const node of frame.children ?? []) {
    if (node.type !== "COMPONENT") continue;
    const m = node.name.trim().match(ART_NAME);
    if (!m) continue;
    const finger = toFinger(m[1], m[2]);
    if (!finger) continue;
    const entry = (art[finger] ??= {});
    if (m[3]) entry.line = node.id;
    else entry.color = node.id;
  }
  return art;
}

export function parseColorRef(frame: FigmaNode | undefined) {
  const fingers: Partial<Record<Finger, FingerInfo>> = {};
  const palette: PaletteColor[] = [];
  let description: string | null = null;
  let heroFinger: Finger | null = null;
  if (!frame) return { fingers, palette, description, heroFinger };

  const kids = frame.children ?? [];
  const nails: { finger: Finger; x: number; bottom: number }[] = [];

  for (const node of kids) {
    if (node.type !== "INSTANCE") continue;
    const m = node.name.trim().match(INSTANCE_FINGER);
    const finger = m ? toFinger(m[1], m[2]) : null;
    if (!finger) continue;
    const info: FingerInfo = {};
    const tipNode = (node.children ?? []).find((c) => /^tip\//i.test(c.name.trim()) && c.visible !== false);
    const style = tipNode?.name.trim().split("/")[1]?.trim();
    const tip = TIP_STYLES.find((t) => t.toLowerCase() === style?.toLowerCase());
    if (tip && tipNode) {
      info.tip = tip;
      info.tipColor = hexFromFills(tipNode.fills) ?? "#ffffff";
    }
    fingers[finger] = info;
    const b = box(node);
    nails.push({ finger, x: b.x + b.width / 2, bottom: b.y + b.height });
  }

  const paletteIndex = kids.findIndex((k) => k.type === "TEXT" && /^palette$/i.test(text(k)));
  if (paletteIndex > 0) {
    const before = kids[paletteIndex - 1];
    if (before.type === "TEXT") description = text(before) || null;
  }

  let inPalette = false;
  let inDesigns = false;
  for (let i = 0; i < kids.length; i++) {
    const node = kids[i];
    if (node.type === "TEXT" && /^palette$/i.test(text(node))) {
      inPalette = true;
      continue;
    }
    if (node.type === "TEXT" && /^designs in this set$/i.test(text(node))) {
      inPalette = false;
      inDesigns = true;
      continue;
    }
    if (inPalette && node.type === "ELLIPSE") {
      const hex = hexFromFills(node.fills);
      const label = kids[i + 1]?.type === "TEXT" ? text(kids[i + 1]) : "";
      if (hex) palette.push({ name: label || hex, hex });
      continue;
    }
    if (inDesigns) {
      if (node.type !== "TEXT") {
        inDesigns = false;
        continue;
      }
      const line = text(node);
      const split = line.match(/^(.+?)\s+[—–-]\s+(.+)$/);
      if (!split) continue;
      for (const mention of split[2].matchAll(FINGER_MENTION)) {
        const finger = toFinger(mention[1], mention[2]);
        if (finger) (fingers[finger] ??= {}).design = split[1].trim();
      }
    }
  }

  // "★ Hero · in Singles" sits under one nail: pick the nearest one above it.
  const hero = kids.find((k) => k.type === "TEXT" && /hero/i.test(text(k)));
  if (hero && nails.length) {
    const hb = box(hero);
    const heroX = hb.x + hb.width / 2;
    const above = nails.filter((n) => n.bottom <= hb.y + 2);
    const pool = above.length ? above : nails;
    pool.sort((a, b) => Math.abs(a.x - heroX) + Math.abs(a.bottom - hb.y) - (Math.abs(b.x - heroX) + Math.abs(b.bottom - hb.y)));
    heroFinger = pool[0].finger;
  }

  return { fingers, palette, description, heroFinger };
}

export function parseShapeGeometry(colorVariant: FigmaNode, lineVariant: FigmaNode | undefined): ShapeGeometry | null {
  const kids = colorVariant.children ?? [];
  const maskNode = kids.find((c) => c.isMask) ?? kids.find((c) => c.name.trim() === "Mask");
  const mask = maskNode ? piece(maskNode, colorVariant, "fill") : null;
  if (!mask) return null;

  const vb = box(colorVariant);
  const artNode = kids.find((c) => c.name.trim() === "Art");
  const ab = artNode ? box(artNode) : null;
  const art = ab
    ? { x: round(ab.x - vb.x), y: round(ab.y - vb.y), w: round(ab.width), h: round(ab.height) }
    : { x: 0, y: round(vb.height - vb.width * 2), w: round(vb.width), h: round(vb.width * 2) };

  const tips: ShapeGeometry["tips"] = {};
  for (const style of TIP_STYLES) {
    const fillNode = kids.find((c) => c.name.trim().toLowerCase() === `tip/${style.toLowerCase()}`);
    const lineNode = lineVariant?.children?.find((c) => c.name.trim().toLowerCase() === `tip/${style.toLowerCase()}`);
    const fill = fillNode ? piece(fillNode, colorVariant, "fill") : null;
    const line = lineNode && lineVariant ? piece(lineNode, lineVariant, "stroke") : null;
    if (fill || line) tips[style as TipStyle] = { ...(fill ? { fill } : {}), ...(line ? { line } : {}) };
  }

  return { width: round(vb.width), height: round(vb.height), mask, art, tips };
}

// === Building the import plan ===============================================

export type PlanSet = {
  code: string;
  name: string;
  collection: string;
  description: string | null;
  palette: PaletteColor[];
  fingers: Partial<Record<Finger, FingerInfo>>;
  heroFinger: Finger;
  sortOrder: number;
  figmaNodeId: string;
  // The Figma component behind each finger's art, per mode.
  art: Partial<Record<Finger, { color?: string; line?: string }>>;
};

export type PlanShape = { shape: ShapeName; sortOrder: number; geometry: ShapeGeometry; sizes: ShapeSizes };

export type TracePlan = { sets: PlanSet[]; shapes: PlanShape[] };

export type Structure = ReturnType<typeof findStructure>;

// The frames to read two levels deep, and the nail variants whose geometry
// is needed, once the structure is known.
export function frameIdsFor(structure: Structure) {
  return structure.sets.flatMap((s) => [s.artFrameId, ...(s.colorRefId ? [s.colorRefId] : [])]);
}

export function geometryIdsFor(structure: Structure) {
  return SHAPES.flatMap((s) => [structure.reference[s]?.color, structure.reference[s]?.line]).filter(
    (id): id is string => !!id,
  );
}

export function buildPlan(
  structure: Structure,
  frame: (id: string) => FigmaNode | undefined,
  geometry: (id: string) => FigmaNode | undefined,
): TracePlan {
  const shapes: PlanShape[] = [];
  SHAPES.forEach((shape) => {
    const ref = structure.reference[shape];
    const color = ref?.color ? geometry(ref.color) : undefined;
    const line = ref?.line ? geometry(ref.line) : undefined;
    const parsed = color ? parseShapeGeometry(color, line) : null;
    if (parsed) shapes.push({ shape, sortOrder: shapes.length, geometry: parsed, sizes: structure.sizes[shape] ?? {} });
  });

  const sets = structure.sets.map((s): PlanSet => {
    const artFrame = frame(s.artFrameId);
    const art = artFrame ? parseArtMasters(artFrame) : {};
    const ref = parseColorRef(s.colorRefId ? frame(s.colorRefId) : undefined);
    return {
      code: s.code,
      name: s.name,
      collection: s.collection,
      description: ref.description,
      palette: ref.palette,
      fingers: ref.fingers,
      heroFinger: ref.heroFinger ?? FINGERS.find((f) => art[f]?.color) ?? "L-Ring",
      sortOrder: s.sortOrder,
      figmaNodeId: s.figmaNodeId,
      art,
    };
  });

  return { sets, shapes };
}
