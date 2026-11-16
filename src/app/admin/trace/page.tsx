import Link from "next/link";
import { getTraceAdminOverview, getTraceShapes } from "@/lib/trace-data";
import NailSvg from "@/components/trace/nail-svg";
import SyncPanel from "./sync-panel";
import ImportPanel from "./import-panel";
import HideToggle from "./hide-toggle";

// The import's and sync's server actions are called from this page; each
// step is short, but give them room on a slow connection.
export const maxDuration = 60;

const PLUGIN_ZIP = "/downloads/nail-studio-trace-export.zip";

function formatWhen(iso: string | null | undefined) {
  if (!iso) return "Never";
  return new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

export default async function AdminTracePage() {
  const [overview, shapes] = await Promise.all([getTraceAdminOverview(), getTraceShapes()]);
  const { sets, heroUrls, filesBySet, sync, figmaConfigured, fileKey } = overview;
  const preview = shapes.find((s) => s.shape === "Squoval") ?? shapes[0];
  const collections = [...new Set(sets.map((s) => s.collection))];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Trace</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Nail designs for the tracing lightbox, from your Figma file. Techs and admins find them under{" "}
          <Link href="/trace" className="underline">
            Trace
          </Link>{" "}
          in the menu.
        </p>
      </div>

      {!overview.tablesReady && (
        <p className="rounded-xl bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800">
          Trace isn&apos;t set up in the database yet. Run the <strong>0019_trace.sql</strong> update in the Supabase
          SQL Editor, then reload this page.
        </p>
      )}

      <section className="card space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-medium text-neutral-900">Import from Figma</h2>
            <p className="mt-0.5 text-sm text-neutral-500">
              {sync?.file_name ? (
                <>
                  Last imported from <strong>{sync.file_name}</strong>.
                </>
              ) : (
                "Bring your designs in from your Figma file in three steps."
              )}
            </p>
          </div>
          <dl className="grid grid-cols-3 gap-4 text-right text-sm">
            <div>
              <dt className="text-xs text-neutral-400">Sets</dt>
              <dd className="font-semibold text-neutral-900">{sets.length}</dd>
            </div>
            <div>
              <dt className="text-xs text-neutral-400">Shapes</dt>
              <dd className="font-semibold text-neutral-900">{overview.shapeCount}</dd>
            </div>
            <div>
              <dt className="text-xs text-neutral-400">Last update</dt>
              <dd className="font-semibold text-neutral-900">{formatWhen(sync?.last_synced_at)}</dd>
            </div>
          </dl>
        </div>

        {sync?.last_error && (
          <p className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700">Last attempt failed: {sync.last_error}</p>
        )}

        <ol className="space-y-4 text-sm text-neutral-700">
          <li className="flex gap-3">
            <Step n={1} />
            <div className="space-y-2">
              <p>
                <strong className="text-neutral-900">Add the export tool to Figma</strong> (one time only). It can only
                read the file you run it in.
              </p>
              <a href={PLUGIN_ZIP} download className="btn-secondary btn-sm inline-flex">
                Download the Figma plugin
              </a>
              <p className="text-xs text-neutral-500">
                Open the downloaded file so it unzips into a folder. In the <strong>Figma desktop app</strong>, open your
                nail file, click the Figma menu (top left) → <strong>Plugins</strong> → <strong>Development</strong> →{" "}
                <strong>Import plugin from manifest…</strong>, and choose <code>manifest.json</code> inside that folder.
              </p>
            </div>
          </li>
          <li className="flex gap-3">
            <Step n={2} />
            <p>
              <strong className="text-neutral-900">Export from Figma.</strong> In your nail file: Figma menu →{" "}
              <strong>Plugins</strong> → <strong>Development</strong> → <strong>Nail Studio – Trace Export</strong>, then
              click <strong>Export</strong>. It saves a file named like <code>nail-designs-2026-11-16.json</code> to your
              Downloads folder. Do this again whenever you add or change designs.
            </p>
          </li>
          <li className="flex gap-3">
            <Step n={3} />
            <div className="w-full space-y-2">
              <p>
                <strong className="text-neutral-900">Import it here.</strong> Only designs that changed are replaced.
              </p>
              <ImportPanel ready={overview.tablesReady} />
            </div>
          </li>
        </ol>
      </section>

      {figmaConfigured && (
        <section className="card space-y-3">
          <div>
            <h2 className="font-medium text-neutral-900">Sync with a Figma token</h2>
            <p className="mt-0.5 text-sm text-neutral-500">
              Optional: a token is set ({fileKey}), so the app can also read the file straight from Figma. Figma limits
              how often a file can be read this way.
            </p>
          </div>
          <SyncPanel configured={overview.tablesReady} hasSynced={!!sync?.last_synced_at} />
        </section>
      )}

      {sets.length > 0 &&
        collections.map((collection) => (
          <section key={collection} className="card space-y-3">
            <h2 className="font-medium text-neutral-900">{collection}</h2>
            <ul className="divide-y divide-neutral-100">
              {sets
                .filter((s) => s.collection === collection)
                .map((set) => (
                  <li key={set.id} className="flex items-center gap-3 py-2.5">
                    <div className="h-12 w-8 shrink-0">
                      {preview && (
                        <NailSvg
                          geometry={preview.geometry}
                          artUrl={heroUrls[set.id] ?? null}
                          mode="color"
                          tip={set.fingers[set.heroFinger]}
                          className="h-full w-full"
                          label={`${set.name} preview`}
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <Link href={`/trace/${set.code}`} className="text-sm font-medium text-neutral-900 hover:underline">
                        {set.code} · {set.name}
                      </Link>
                      <p className="text-xs text-neutral-500">
                        {filesBySet[set.id] ?? 0} design files
                        {set.hidden && <span className="badge ml-2 bg-neutral-100 text-neutral-600">Hidden</span>}
                      </p>
                    </div>
                    <HideToggle setId={set.id} hidden={set.hidden} />
                  </li>
                ))}
            </ul>
          </section>
        ))}
    </div>
  );
}

function Step({ n }: { n: number }) {
  return (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-xs font-semibold text-white">
      {n}
    </span>
  );
}
