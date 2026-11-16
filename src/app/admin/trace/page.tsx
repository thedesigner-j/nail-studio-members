import Link from "next/link";
import { getTraceAdminOverview, getTraceShapes } from "@/lib/trace-data";
import NailSvg from "@/components/trace/nail-svg";
import SyncPanel from "./sync-panel";
import HideToggle from "./hide-toggle";

// The sync's server actions are called from this page; each step is short,
// but give them room on a slow connection to Figma.
export const maxDuration = 60;

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
          Nail designs for the tracing lightbox, pulled from your Figma file. Techs and admins find them under{" "}
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
            <h2 className="font-medium text-neutral-900">Figma</h2>
            <p className="mt-0.5 text-sm text-neutral-500">
              {figmaConfigured ? (
                <>
                  Connected to {sync?.file_name ? <strong>{sync.file_name}</strong> : "your file"}{" "}
                  <span className="text-neutral-400">({fileKey})</span>
                </>
              ) : (
                "Not connected yet."
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
              <dt className="text-xs text-neutral-400">Last sync</dt>
              <dd className="font-semibold text-neutral-900">{formatWhen(sync?.last_synced_at)}</dd>
            </div>
          </dl>
        </div>

        {sync?.last_error && (
          <p className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700">Last sync failed: {sync.last_error}</p>
        )}

        {figmaConfigured ? (
          <SyncPanel configured={figmaConfigured && overview.tablesReady} hasSynced={!!sync?.last_synced_at} />
        ) : (
          <SetupSteps />
        )}

        <p className="text-xs text-neutral-500">
          The sync copies every set from pages named &ldquo;Sets - &hellip;&rdquo; (their Art Masters and Color Ref) and
          the nail shapes from the &ldquo;Nail&rdquo; component. If nothing changed in Figma it stops right away. Figma
          limits how often a file can be read: files on Figma&apos;s free plan can only be synced a few times a month,
          so keep the file in a paid team if you sync often.
        </p>
      </section>

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

function SetupSteps() {
  return (
    <div className="space-y-3 rounded-xl bg-neutral-50 p-4 text-sm text-neutral-700">
      <p className="font-medium text-neutral-900">Connect Figma (one time)</p>
      <ol className="list-decimal space-y-2 pl-5">
        <li>
          In Figma, click your profile picture (top left), then <strong>Settings</strong>, then the{" "}
          <strong>Security</strong> tab.
        </li>
        <li>
          Under <strong>Personal access tokens</strong>, click <strong>Generate new token</strong>. Name it
          &ldquo;Nail app&rdquo;, set <strong>File content</strong> to <strong>Read-only</strong>, and create it. Copy
          the token right away; Figma only shows it once.
        </li>
        <li>
          In Vercel, open the project&apos;s <strong>Settings</strong> → <strong>Environment Variables</strong> and
          add <code>FIGMA_ACCESS_TOKEN</code> (the token) and <code>FIGMA_FILE_KEY</code> (the part of the Figma file
          link after <code>/design/</code>, before the next <code>/</code>).
        </li>
        <li>Redeploy, then come back here and click Sync from Figma.</li>
      </ol>
    </div>
  );
}
