import { createServiceRoleClient } from "@/lib/supabase/server";
import { figmaConfig } from "@/lib/figma";
import {
  FINGERS,
  SHAPES,
  TRACE_BUCKET,
  isFinger,
  type ArtUrls,
  type Finger,
  type FingerInfo,
  type PaletteColor,
  type TraceSetSummary,
  type TraceShape,
} from "@/lib/trace";

// Server-only loaders for Trace. Pages check the viewer is an admin or tech
// first (canUseTrace); reads then use the service role, and art files are
// handed out as short-lived signed URLs from the private bucket.

const SIGNED_URL_SECONDS = 60 * 60;

export function canUseTrace(profile: { is_admin?: boolean | null; is_tech?: boolean | null } | null) {
  return !!profile && (!!profile.is_admin || !!profile.is_tech);
}

type SetRow = {
  id: string;
  code: string;
  name: string;
  collection: string;
  description: string | null;
  palette: PaletteColor[] | null;
  fingers: Partial<Record<Finger, FingerInfo>> | null;
  hero_finger: string | null;
  hidden: boolean;
};

const SET_COLUMNS = "id, code, name, collection, description, palette, fingers, hero_finger, hidden";

function toSummary(row: SetRow): TraceSetSummary {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    collection: row.collection,
    description: row.description,
    palette: Array.isArray(row.palette) ? row.palette : [],
    fingers: row.fingers ?? {},
    heroFinger: row.hero_finger && isFinger(row.hero_finger) ? row.hero_finger : "L-Ring",
    hidden: row.hidden,
  };
}

async function signPaths(paths: (string | null | undefined)[]) {
  const unique = [...new Set(paths.filter((p): p is string => !!p))];
  if (unique.length === 0) return new Map<string, string>();
  const { data } = await createServiceRoleClient()
    .storage.from(TRACE_BUCKET)
    .createSignedUrls(unique, SIGNED_URL_SECONDS);
  return new Map((data ?? []).filter((d) => d.path && d.signedUrl).map((d) => [d.path as string, d.signedUrl]));
}

export async function getTraceShapes(): Promise<TraceShape[]> {
  const { data } = await createServiceRoleClient().from("trace_shapes").select("shape, geometry, sizes").order("sort_order");
  return (data ?? [])
    .filter((row) => (SHAPES as readonly string[]).includes(row.shape))
    .map((row) => ({ shape: row.shape, geometry: row.geometry, sizes: row.sizes ?? {} }) as TraceShape);
}

// Every set (admins also see hidden ones) with its hero nail's color art.
export async function getTraceCatalog(includeHidden: boolean) {
  const supabase = createServiceRoleClient();
  let query = supabase.from("trace_sets").select(SET_COLUMNS).order("sort_order");
  if (!includeHidden) query = query.eq("hidden", false);
  const { data, error } = await query;
  if (error) return { sets: [], heroUrls: {} as Record<string, string | null>, ready: false };

  const sets = (data as SetRow[]).map(toSummary);
  const { data: art } = sets.length
    ? await supabase
        .from("trace_art")
        .select("set_id, finger, storage_path")
        .eq("mode", "color")
        .in(
          "set_id",
          sets.map((s) => s.id),
        )
    : { data: [] };

  const heroPath = new Map<string, string | null>();
  for (const set of sets) {
    const row = (art ?? []).find((a) => a.set_id === set.id && a.finger === set.heroFinger);
    heroPath.set(set.id, row?.storage_path ?? null);
  }
  const signed = await signPaths([...heroPath.values()]);
  const heroUrls: Record<string, string | null> = {};
  for (const [setId, path] of heroPath) heroUrls[setId] = path ? signed.get(path) ?? null : null;

  return { sets, heroUrls, ready: true };
}

export async function getTraceSet(code: string, includeHidden: boolean) {
  const supabase = createServiceRoleClient();
  const { data } = await supabase.from("trace_sets").select(SET_COLUMNS).eq("code", code.toUpperCase()).maybeSingle();
  if (!data) return null;
  const set = toSummary(data as SetRow);
  if (set.hidden && !includeHidden) return null;

  const { data: art } = await supabase.from("trace_art").select("finger, mode, storage_path").eq("set_id", set.id);
  const signed = await signPaths((art ?? []).map((a) => a.storage_path));

  const urls: ArtUrls = {};
  for (const finger of FINGERS) urls[finger] = { color: null, line: null };
  for (const row of art ?? []) {
    if (!isFinger(row.finger) || (row.mode !== "color" && row.mode !== "line")) continue;
    urls[row.finger]![row.mode as "color" | "line"] = row.storage_path ? signed.get(row.storage_path) ?? null : null;
  }

  // Neighbours, for "previous / next set" links.
  let siblings = supabase.from("trace_sets").select("code").order("sort_order");
  if (!includeHidden) siblings = siblings.eq("hidden", false);
  const { data: codes } = await siblings;
  const list = (codes ?? []).map((c) => c.code as string);
  const index = list.indexOf(set.code);

  return {
    set,
    urls,
    previousCode: index > 0 ? list[index - 1] : null,
    nextCode: index >= 0 && index < list.length - 1 ? list[index + 1] : null,
  };
}

// For the admin page.
export async function getTraceAdminOverview() {
  const supabase = createServiceRoleClient();
  const [{ data: sync, error: syncError }, catalog, { data: artCounts }, { count: shapeCount }] = await Promise.all([
    supabase.from("trace_sync").select("file_version, file_name, last_synced_at, last_error").maybeSingle(),
    getTraceCatalog(true),
    supabase.from("trace_art").select("set_id, storage_path"),
    supabase.from("trace_shapes").select("shape", { count: "exact", head: true }),
  ]);

  const filesBySet: Record<string, number> = {};
  for (const row of artCounts ?? []) {
    if (row.storage_path) filesBySet[row.set_id] = (filesBySet[row.set_id] ?? 0) + 1;
  }

  const { configured, fileKey } = figmaConfig();
  return {
    tablesReady: !syncError,
    figmaConfigured: configured,
    fileKey,
    sync: sync ?? null,
    sets: catalog.sets,
    heroUrls: catalog.heroUrls,
    filesBySet,
    shapeCount: shapeCount ?? 0,
  };
}
