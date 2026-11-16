import { createHash } from "node:crypto";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { downloadExport, FigmaError, figmaConfig, figmaGet, type FigmaNode } from "@/lib/figma";
import {
  buildPlan,
  findStructure,
  frameIdsFor,
  geometryIdsFor,
  type PlanSet,
  type PlanShape,
  type TracePlan,
} from "@/lib/trace-parse";
import { FINGERS, SHAPES, TIP_STYLES, TRACE_BUCKET, isFinger, type ArtMode } from "@/lib/trace";

// Copies the studio's Figma nail sets into the app, two ways:
//
//   - Import (no token): the Figma plugin in figma-plugin/ saves the file's
//     designs to one .json file; Admin > Trace reads it in the browser,
//     builds the plan (src/lib/trace-parse.ts) and sends it here in small
//     pieces: applyPlan, then importSvgs in batches.
//   - Sync (optional, needs FIGMA_ACCESS_TOKEN): the server reads the same
//     things through Figma's API: startSync, exportBatch, downloadPending.
//
// Both end with finishSync. A design file only changes in storage (and gets
// a new name, so nothing serves a stale copy) when its contents changed.

export const EXPORT_BATCH_SIZE = 400;
const DOWNLOAD_BATCH_SIZE = 60;
const CONCURRENCY = 10;
export const IMPORT_BATCH_SIZE = 40;

type Meta = { file?: { version?: string; name?: string }; version?: string; name?: string };
type FileResponse = { name?: string; version?: string; document: FigmaNode };
type NodesResponse = { nodes: Record<string, { document: FigmaNode } | null> };
type ImagesResponse = { err?: string | null; images?: Record<string, string | null> };

export type StartResult =
  | { status: "up_to_date" }
  | { status: "ready"; version: string; fileName: string; exportIds: string[]; sets: number; shapes: number };

// === Saving a plan ============================================================

// Saves shapes and sets, removes sets no longer in Figma, and points each
// finger's art row at its Figma component. Returns the art the plan expects.
export async function applyPlan(plan: TracePlan) {
  const supabase = createServiceRoleClient();
  const now = new Date().toISOString();

  if (plan.shapes.length > 0) {
    const { error } = await supabase.from("trace_shapes").upsert(
      plan.shapes.map((s) => ({
        shape: s.shape,
        sort_order: s.sortOrder,
        geometry: s.geometry,
        sizes: s.sizes,
        synced_at: now,
      })),
    );
    if (error) throw new Error(error.message);
  }

  const { data: savedSets, error: setsError } = await supabase
    .from("trace_sets")
    .upsert(
      plan.sets.map((s) => ({
        code: s.code,
        name: s.name,
        collection: s.collection,
        description: s.description,
        palette: s.palette,
        fingers: s.fingers,
        hero_finger: s.heroFinger,
        sort_order: s.sortOrder,
        figma_node_id: s.figmaNodeId,
        synced_at: now,
      })),
      { onConflict: "code" },
    )
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

  const artRows = plan.sets.flatMap((set) =>
    FINGERS.flatMap((finger) =>
      (["color", "line"] as const).map((mode) => ({
        set_id: idByCode.get(set.code)!,
        finger,
        mode,
        figma_node_id: set.art[finger]?.[mode] ?? null,
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

  return { artRows, sets: plan.sets.length, shapes: plan.shapes.length };
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

function looksSafe(svg: string) {
  return /<svg[\s>]/i.test(svg) && !/<script|\son[a-z]+\s*=|javascript:/i.test(svg);
}

type ArtRow = { id: string; finger: string; mode: string; storage_path: string | null; content_hash: string | null };

// Store one SVG for an art row. Returns whether the stored file changed.
async function storeSvg(row: ArtRow, code: string, svg: string): Promise<"changed" | "same" | "failed"> {
  const supabase = createServiceRoleClient();
  if (!looksSafe(svg) || svg.length > 900_000) {
    await supabase.from("trace_art").update({ pending_url: null }).eq("id", row.id);
    return "failed";
  }
  const hash = createHash("sha256").update(svg).digest("hex");
  if (hash === row.content_hash && row.storage_path) {
    await supabase.from("trace_art").update({ pending_url: null }).eq("id", row.id);
    return "same";
  }
  const path = `art/${code}/${row.finger}-${row.mode}-${hash.slice(0, 12)}.svg`;
  const { error } = await supabase.storage
    .from(TRACE_BUCKET)
    .upload(path, new Blob([svg], { type: "image/svg+xml" }), { contentType: "image/svg+xml", upsert: true });
  if (error) {
    await supabase.from("trace_art").update({ pending_url: null }).eq("id", row.id);
    return "failed";
  }
  await supabase
    .from("trace_art")
    .update({ storage_path: path, content_hash: hash, pending_url: null, updated_at: new Date().toISOString() })
    .eq("id", row.id);
  if (row.storage_path && row.storage_path !== path) {
    await supabase.storage.from(TRACE_BUCKET).remove([row.storage_path]);
  }
  return "changed";
}

async function inParallel<T>(items: T[], work: (item: T) => Promise<void>) {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      for (let item = queue.shift(); item !== undefined; item = queue.shift()) await work(item);
    }),
  );
}

// === Import (from the plugin's file) =========================================

export class TraceImportError extends Error {}

export type ImportItem = { code: string; finger: string; mode: ArtMode; svg: string | null };

// The plan arrives from the admin's browser, so check its shape before saving.
export function validatePlan(input: unknown): TracePlan {
  const bad = (why: string): never => {
    throw new TraceImportError(
      `That file doesn't look like a Trace export (${why}). Export it again from the Figma plugin.`,
    );
  };
  const plan = input as TracePlan;
  if (!plan || !Array.isArray(plan.sets) || !Array.isArray(plan.shapes)) bad("missing sets");
  if (plan.sets.length === 0) bad("no sets");
  if (plan.sets.length > 1000 || plan.shapes.length > SHAPES.length) bad("too many items");

  const str = (v: unknown, max = 500) => typeof v === "string" && v.length <= max;
  const num = (v: unknown) => typeof v === "number" && Number.isFinite(v);
  const piece = (p: unknown) => {
    const x = p as { d: unknown; x: unknown; y: unknown };
    return !!x && str(x.d, 50_000) && num(x.x) && num(x.y);
  };

  const sets: PlanSet[] = plan.sets.map((s) => {
    if (!str(s.code, 20) || !/^[A-Z]+\d+$/.test(s.code)) bad("set code");
    if (!str(s.name, 200) || !str(s.collection, 100)) bad(`set ${s.code}`);
    if (s.description !== null && !str(s.description, 2000)) bad(`set ${s.code} description`);
    if (!isFinger(s.heroFinger)) bad(`set ${s.code} hero`);
    const palette = Array.isArray(s.palette)
      ? s.palette.filter((p) => str(p?.name, 100) && /^#[0-9a-f]{6}$/i.test(p?.hex ?? "")).slice(0, 20)
      : [];
    const fingers: PlanSet["fingers"] = {};
    const art: PlanSet["art"] = {};
    for (const f of FINGERS) {
      const info = s.fingers?.[f];
      if (info) {
        fingers[f] = {
          ...(info.tip && (TIP_STYLES as readonly string[]).includes(info.tip) ? { tip: info.tip } : {}),
          ...(info.tipColor && /^#[0-9a-f]{6}$/i.test(info.tipColor) ? { tipColor: info.tipColor } : {}),
          ...(str(info.design, 200) ? { design: info.design } : {}),
        };
      }
      const a = s.art?.[f];
      if (a) art[f] = { ...(str(a.color, 100) ? { color: a.color } : {}), ...(str(a.line, 100) ? { line: a.line } : {}) };
    }
    return {
      code: s.code,
      name: s.name,
      collection: s.collection,
      description: s.description,
      palette,
      fingers,
      heroFinger: s.heroFinger,
      sortOrder: num(s.sortOrder) ? s.sortOrder : 0,
      figmaNodeId: str(s.figmaNodeId, 100) ? s.figmaNodeId : "",
      art,
    };
  });

  const shapes: PlanShape[] = plan.shapes.map((s) => {
    if (!(SHAPES as readonly string[]).includes(s.shape)) bad("shape name");
    const g = s.geometry;
    if (!g || !num(g.width) || !num(g.height) || !piece(g.mask)) bad(`${s.shape} outline`);
    if (!g.art || ![g.art.x, g.art.y, g.art.w, g.art.h].every(num)) bad(`${s.shape} art box`);
    const tips: PlanShape["geometry"]["tips"] = {};
    for (const style of TIP_STYLES) {
      const t = g.tips?.[style];
      if (!t) continue;
      tips[style] = { ...(piece(t.fill) ? { fill: t.fill } : {}), ...(piece(t.line) ? { line: t.line } : {}) };
    }
    return {
      shape: s.shape,
      sortOrder: num(s.sortOrder) ? s.sortOrder : 0,
      geometry: { width: g.width, height: g.height, mask: g.mask, art: g.art, tips },
      sizes: s.sizes && typeof s.sizes === "object" ? s.sizes : {},
    };
  });

  return { sets, shapes };
}

export async function importSvgs(items: ImportItem[]) {
  const supabase = createServiceRoleClient();
  const valid = items
    .slice(0, IMPORT_BATCH_SIZE)
    .filter((i) => typeof i.code === "string" && isFinger(i.finger) && (i.mode === "color" || i.mode === "line"));
  const codes = [...new Set(valid.map((i) => i.code))];
  if (codes.length === 0) return { changed: 0, failed: 0 };

  const { data: rows } = await supabase
    .from("trace_art")
    .select("id, finger, mode, storage_path, content_hash, trace_sets!inner(code)")
    .in("trace_sets.code", codes);
  const find = (i: ImportItem) =>
    (rows ?? []).find(
      (r) => (r.trace_sets as unknown as { code: string }).code === i.code && r.finger === i.finger && r.mode === i.mode,
    );

  let changed = 0;
  let failed = 0;
  const blank: ArtRow[] = [];
  await inParallel(valid, async (item) => {
    const row = find(item);
    if (!row) {
      failed++;
      return;
    }
    if (!item.svg) {
      blank.push(row);
      return;
    }
    const result = await storeSvg(row, item.code, item.svg);
    if (result === "changed") changed++;
    if (result === "failed") failed++;
  });
  await clearArt(blank.filter((r) => r.storage_path || r.content_hash));

  return { changed, failed };
}

// === Sync (through Figma's API, with a token) ================================

async function currentSyncRow() {
  const { data } = await createServiceRoleClient().from("trace_sync").select("file_version").maybeSingle();
  return data;
}

export async function startSync(force: boolean): Promise<StartResult> {
  const { fileKey } = figmaConfig();
  const key = encodeURIComponent(fileKey);

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
  const structure = findStructure(file.document);
  if (structure.sets.length === 0) {
    throw new FigmaError(
      'No sets found in the Figma file. The sync looks for pages named "Sets - …" with sections like "X01 · Name" that contain an "Art Masters" frame.',
    );
  }

  // 3. The art components and color references of every set.
  const frames = await figmaGet<NodesResponse>(
    `/v1/files/${key}/nodes?ids=${encodeURIComponent(frameIdsFor(structure).join(","))}&depth=2`,
  );

  // 4. Outline, art box and tip geometry for each shape.
  const variantIds = geometryIdsFor(structure);
  const geometry = variantIds.length
    ? await figmaGet<NodesResponse>(
        `/v1/files/${key}/nodes?ids=${encodeURIComponent(variantIds.join(","))}&depth=1&geometry=paths`,
      )
    : { nodes: {} };

  const plan = buildPlan(
    structure,
    (id) => frames.nodes[id]?.document,
    (id) => geometry.nodes[id]?.document,
  );
  const saved = await applyPlan(plan);
  const exportIds = saved.artRows.map((a) => a.figma_node_id).filter((id): id is string => !!id);
  return { status: "ready", version, fileName, exportIds, sets: saved.sets, shapes: saved.shapes };
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

// Copy a batch of Figma's exported SVGs into storage.
export async function downloadPending() {
  const supabase = createServiceRoleClient();
  const { data: rows } = await supabase
    .from("trace_art")
    .select("id, finger, mode, storage_path, content_hash, pending_url, trace_sets(code)")
    .not("pending_url", "is", null)
    .limit(DOWNLOAD_BATCH_SIZE);

  let failed = 0;
  let changed = 0;
  await inParallel(rows ?? [], async (row) => {
    const set = row.trace_sets as unknown as { code: string } | null;
    const svg = row.pending_url ? await downloadExport(row.pending_url) : null;
    if (!svg || !set) {
      failed++;
      await supabase.from("trace_art").update({ pending_url: null }).eq("id", row.id);
      return;
    }
    const result = await storeSvg(row, set.code, svg);
    if (result === "changed") changed++;
    if (result === "failed") failed++;
  });

  const { count } = await supabase
    .from("trace_art")
    .select("id", { count: "exact", head: true })
    .not("pending_url", "is", null);

  return { processed: (rows ?? []).length, changed, failed, remaining: count ?? 0 };
}

// === Both ====================================================================

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
