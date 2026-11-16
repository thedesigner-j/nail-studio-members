import { createHash } from "node:crypto";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { downloadExport, FigmaError, figmaConfig, figmaGet, type FigmaNode, type FigmaPaint } from "@/lib/figma";
import {
  FINGERS,
  PT_TO_MM,
  SHAPES,
  TIP_STYLES,
  TRACE_BUCKET,
  isFinger,
  type Finger,
  type FingerInfo,
  type PaletteColor,
  type PathPiece,
  type ShapeGeometry,
  type ShapeSizes,
  type TipStyle,
} from "@/lib/trace";

// Reads the studio's Figma file and copies its nail sets into the app.
//
// What it expects in Figma (the layout the "Sets Book" file uses):
//   - Pages named "Sets - <Collection>", holding one section per set named
//     "<CODE> · <Name>" (e.g. "X01 · Candy Cane Lane"). Each section has an
//     "Art Masters" frame with components "Art/<CODE>/<L|R>-<Finger>" (color)
//     and "… · Line" (tracing lines), plus a "<CODE> · Color Ref" frame.
//   - A component set named "Nail" with variants
//     "Shape=…, Size=S|M|L, Finger=…, Mode=Color|Line" drawn at real size.
//
// A sync runs in steps so each server call stays short: start (read the
// structure), export (ask Figma for SVG links in batches), download (copy the
// SVGs into storage in small batches), finish.

const SET_PAGE = /^sets?\s*[-–—·:|]\s*(.+)$/i;
const SET_SECTION = /^([A-Za-z]+\d+)\s*[·•|:\-–—]\s*(.+)$/;
const ART_NAME = /^Art\/[^/]+\/([LR])-(Thumb|Index|Middle|Ring|Pinky)(?:\s*[·•|\-–—]?\s*(Line))?$/i;
const INSTANCE_FINGER = /^([LR])\s+(Thumb|Index|Middle|Ring|Pinky)\b/i;
const FINGER_MENTION = /\b([LR])\s+(Thumb|Index|Middle|Ring|Pinky)\b/gi;
const VARIANT = /Shape=([^,]+),\s*Size=([^,]+),\s*Finger=([^,]+),\s*Mode=([^,]+)/i;

export const EXPORT_BATCH_SIZE = 400;
const DOWNLOAD_BATCH_SIZE = 60;
const DOWNLOAD_CONCURRENCY = 10;

type PlannedSet = {
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

// === Steps ===================================================================

type Meta = { file?: { version?: string; name?: string }; version?: string; name?: string };
type FileResponse = { name?: string; version?: string; document: FigmaNode };
type NodesResponse = { nodes: Record<string, { document: FigmaNode } | null> };
type ImagesResponse = { err?: string | null; images?: Record<string, string | null> };

export type StartResult =
  | { status: "up_to_date" }
  | { status: "ready"; version: string; fileName: string; exportIds: string[]; sets: number; shapes: number };

async function currentSyncRow() {
  const { data } = await createServiceRoleClient().from("trace_sync").select("file_version").maybeSingle();
  return data;
}

export async function startSync(force: boolean): Promise<StartResult> {
  const { fileKey } = figmaConfig();
  const key = encodeURIComponent(fileKey);
  const supabase = createServiceRoleClient();

  // 1. Has the file changed since the last sync? (A light call.)
  let version = "";
  let fileName = "";
  try {
    const meta = await figmaGet<Meta>(`/v1/files/${key}/meta`);
    version = meta.file?.version ?? meta.version ?? "";
    fileName = meta.file?.name ?? meta.name ?? "";
  } catch (error) {
    // The meta call is only a shortcut, so carry on if it isn't available;
    // but a bad token or a rate limit would only repeat on the bigger calls.
    if (!(error instanceof FigmaError) || [0, 401, 403, 429].includes(error.status)) throw error;
  }
  if (!force && version) {
    const row = await currentSyncRow();
    if (row?.file_version === version) return { status: "up_to_date" };
  }

  // 2. Pages, sections and frames (three levels deep), plus the Nail Library.
  const file = await figmaGet<FileResponse>(`/v1/files/${key}?depth=3`);
  version = file.version ?? version;
  fileName = file.name ?? fileName;
  const { sets, sizes, reference } = findStructure(file.document);
  if (sets.length === 0) {
    throw new FigmaError(
      'No sets found in the Figma file. The sync looks for pages named "Sets - …" with sections like "X01 · Name" that contain an "Art Masters" frame.',
    );
  }

  // 3. The art components and color references of every set.
  const frameIds = sets.flatMap((s) => [s.artFrameId, ...(s.colorRefId ? [s.colorRefId] : [])]);
  const framesResponse = await figmaGet<NodesResponse>(
    `/v1/files/${key}/nodes?ids=${encodeURIComponent(frameIds.join(","))}&depth=2`,
  );
  const frame = (id: string | null) => (id ? framesResponse.nodes[id]?.document : undefined);

  // 4. Outline, art box and tip geometry for each shape.
  const shapeNames = SHAPES.filter((s) => reference[s]?.color);
  const variantIds = shapeNames.flatMap((s) => [reference[s].color!, ...(reference[s].line ? [reference[s].line!] : [])]);
  const geometryResponse = variantIds.length
    ? await figmaGet<NodesResponse>(
        `/v1/files/${key}/nodes?ids=${encodeURIComponent(variantIds.join(","))}&depth=1&geometry=paths`,
      )
    : { nodes: {} };

  const shapeRows = shapeNames
    .map((shape, i) => {
      const color = geometryResponse.nodes[reference[shape].color!]?.document;
      const line = reference[shape].line ? geometryResponse.nodes[reference[shape].line!]?.document : undefined;
      const geometry = color ? parseShapeGeometry(color, line) : null;
      return geometry ? { shape, sort_order: i, geometry, sizes: sizes[shape] ?? {}, synced_at: new Date().toISOString() } : null;
    })
    .filter((row) => row !== null);

  if (shapeRows.length > 0) {
    const { error } = await supabase.from("trace_shapes").upsert(shapeRows);
    if (error) throw new Error(error.message);
  }

  // 5. Sets: add or update, and remove the ones no longer in Figma.
  const now = new Date().toISOString();
  const setRows = sets.map((s) => {
    const art = parseArtMasters(frame(s.artFrameId)!);
    const ref = parseColorRef(frame(s.colorRefId));
    const heroFinger = ref.heroFinger ?? FINGERS.find((f) => art[f]?.color) ?? "L-Ring";
    return {
      row: {
        code: s.code,
        name: s.name,
        collection: s.collection,
        description: ref.description,
        palette: ref.palette,
        fingers: ref.fingers,
        hero_finger: heroFinger,
        sort_order: s.sortOrder,
        figma_node_id: s.figmaNodeId,
        synced_at: now,
      },
      art,
    };
  });

  const { data: savedSets, error: setsError } = await supabase
    .from("trace_sets")
    .upsert(setRows.map((s) => s.row), { onConflict: "code" })
    .select("id, code");
  if (setsError) throw new Error(setsError.message);
  const idByCode = new Map((savedSets ?? []).map((s) => [s.code as string, s.id as string]));

  const { data: allSets } = await supabase.from("trace_sets").select("id, code");
  const staleIds = (allSets ?? []).filter((s) => !idByCode.has(s.code)).map((s) => s.id as string);
  if (staleIds.length > 0) {
    const { data: staleArt } = await supabase.from("trace_art").select("storage_path").in("set_id", staleIds);
    const stalePaths = (staleArt ?? []).map((a) => a.storage_path).filter((p): p is string => !!p);
    if (stalePaths.length) await supabase.storage.from(TRACE_BUCKET).remove(stalePaths);
    await supabase.from("trace_sets").delete().in("id", staleIds);
  }

  // 6. One art row per finger and mode, pointing at its Figma component.
  const artRows = setRows.flatMap(({ row, art }) =>
    FINGERS.flatMap((finger) =>
      (["color", "line"] as const).map((mode) => ({
        set_id: idByCode.get(row.code)!,
        finger,
        mode,
        figma_node_id: art[finger]?.[mode] ?? null,
        pending_url: null,
      })),
    ),
  );
  const { error: artError } = await supabase.from("trace_art").upsert(artRows, { onConflict: "set_id,finger,mode" });
  if (artError) throw new Error(artError.message);

  // Fingers with no art component in Figma: clear any old file.
  const { data: missing } = await supabase
    .from("trace_art")
    .select("id, storage_path")
    .is("figma_node_id", null)
    .or("storage_path.not.is.null,content_hash.not.is.null");
  await clearArt(missing ?? []);

  const exportIds = artRows.map((a) => a.figma_node_id).filter((id): id is string => !!id);
  return { status: "ready", version, fileName, exportIds, sets: setRows.length, shapes: shapeRows.length };
}

async function clearArt(rows: { id: string; storage_path: string | null }[]) {
  if (rows.length === 0) return;
  const supabase = createServiceRoleClient();
  const paths = rows.map((r) => r.storage_path).filter((p): p is string => !!p);
  if (paths.length) await supabase.storage.from(TRACE_BUCKET).remove(paths);
  await supabase
    .from("trace_art")
    .update({ storage_path: null, content_hash: null, pending_url: null, updated_at: new Date().toISOString() })
    .in(
      "id",
      rows.map((r) => r.id),
    );
}

// Ask Figma for SVG links for a batch of art components. Components with
// nothing visible come back without a link: those fingers have no art in
// that mode (e.g. a plain colored nail has no tracing lines).
export async function exportBatch(ids: string[]) {
  const { fileKey } = figmaConfig();
  const supabase = createServiceRoleClient();
  const unique = [...new Set(ids)].slice(0, EXPORT_BATCH_SIZE);
  if (unique.length === 0) return { exported: 0, blank: 0 };

  const res = await figmaGet<ImagesResponse>(
    `/v1/images/${encodeURIComponent(fileKey)}?ids=${encodeURIComponent(unique.join(","))}&format=svg&svg_include_id=false`,
  );
  if (res.err) throw new FigmaError(`Figma couldn't export the designs: ${res.err}`);
  const images = res.images ?? {};

  const { data: rows } = await supabase
    .from("trace_art")
    .select("id, storage_path, set_id, finger, mode, figma_node_id")
    .in("figma_node_id", unique);

  const withLink = (rows ?? []).filter((r) => images[r.figma_node_id as string]);
  const blank = (rows ?? []).filter((r) => !images[r.figma_node_id as string]);

  if (withLink.length > 0) {
    const { error } = await supabase.from("trace_art").upsert(
      withLink.map((r) => ({
        set_id: r.set_id,
        finger: r.finger,
        mode: r.mode,
        pending_url: images[r.figma_node_id as string],
      })),
      { onConflict: "set_id,finger,mode" },
    );
    if (error) throw new Error(error.message);
  }
  if (blank.length > 0) await clearArt(blank);

  return { exported: withLink.length, blank: blank.length };
}

function looksSafe(svg: string) {
  return /<svg[\s>]/i.test(svg) && !/<script|\son[a-z]+\s*=|javascript:/i.test(svg);
}

// Copy a batch of exported SVGs into storage. A file only changes (and gets
// a new name, so nothing serves a stale copy) when its contents changed.
export async function downloadPending() {
  const supabase = createServiceRoleClient();
  const { data: rows } = await supabase
    .from("trace_art")
    .select("id, finger, mode, storage_path, content_hash, pending_url, trace_sets(code)")
    .not("pending_url", "is", null)
    .limit(DOWNLOAD_BATCH_SIZE);

  let failed = 0;
  let changed = 0;
  const queue = [...(rows ?? [])];

  async function work() {
    for (let row = queue.shift(); row; row = queue.shift()) {
      const set = row.trace_sets as unknown as { code: string } | null;
      const svg = row.pending_url ? await downloadExport(row.pending_url) : null;
      if (!svg || !looksSafe(svg) || !set) {
        failed++;
        await supabase.from("trace_art").update({ pending_url: null }).eq("id", row.id);
        continue;
      }
      const hash = createHash("sha256").update(svg).digest("hex");
      if (hash === row.content_hash && row.storage_path) {
        await supabase.from("trace_art").update({ pending_url: null }).eq("id", row.id);
        continue;
      }
      const path = `art/${set.code}/${row.finger}-${row.mode}-${hash.slice(0, 12)}.svg`;
      const { error } = await supabase.storage
        .from(TRACE_BUCKET)
        .upload(path, new Blob([svg], { type: "image/svg+xml" }), { contentType: "image/svg+xml", upsert: true });
      if (error) {
        failed++;
        await supabase.from("trace_art").update({ pending_url: null }).eq("id", row.id);
        continue;
      }
      await supabase
        .from("trace_art")
        .update({ storage_path: path, content_hash: hash, pending_url: null, updated_at: new Date().toISOString() })
        .eq("id", row.id);
      if (row.storage_path && row.storage_path !== path) {
        await supabase.storage.from(TRACE_BUCKET).remove([row.storage_path]);
      }
      changed++;
    }
  }

  await Promise.all(Array.from({ length: DOWNLOAD_CONCURRENCY }, work));

  const { count } = await supabase
    .from("trace_art")
    .select("id", { count: "exact", head: true })
    .not("pending_url", "is", null);

  return { processed: (rows ?? []).length, changed, failed, remaining: count ?? 0 };
}

export async function finishSync(version: string, fileName: string) {
  await createServiceRoleClient()
    .from("trace_sync")
    .upsert({
      id: true,
      file_version: version || null,
      file_name: fileName || null,
      last_synced_at: new Date().toISOString(),
      last_error: null,
      updated_at: new Date().toISOString(),
    });
}

export async function recordSyncError(message: string) {
  await createServiceRoleClient()
    .from("trace_sync")
    .upsert({ id: true, last_error: message.slice(0, 500), updated_at: new Date().toISOString() });
}
