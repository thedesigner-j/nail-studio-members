"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { downloadTraceArt, exportTraceArt, finishTraceSync, startTraceSync } from "./actions";

const FIRST_BATCH = 400;
const SMALLEST_BATCH = 50;

type Phase = { label: string; progress: number };

export default function SyncPanel({ configured, hasSynced }: { configured: boolean; hasSynced: boolean }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState<Phase | null>(null);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  async function run(force: boolean) {
    setRunning(true);
    setError("");
    setDone("");
    setPhase({ label: "Checking Figma for changes...", progress: 0.03 });

    try {
      const start = await startTraceSync(force);
      if (!start.ok) return setError(start.error);
      if (start.result.status === "up_to_date") {
        setDone("Already up to date. Nothing has changed in Figma since the last sync.");
        return;
      }

      const { exportIds, version, fileName, sets, shapes } = start.result;
      const total = exportIds.length;

      // Ask Figma for export links in batches; a batch Figma can't finish in
      // time is retried at half the size.
      let batchSize = FIRST_BATCH;
      for (let i = 0; i < total; ) {
        const batch = exportIds.slice(i, i + batchSize);
        setPhase({
          label: `Asking Figma for designs ${i + 1}–${i + batch.length} of ${total}...`,
          progress: 0.05 + 0.2 * (i / Math.max(total, 1)),
        });
        const res = await exportTraceArt(batch);
        if (!res.ok) {
          if (batchSize > SMALLEST_BATCH && /timeout|timed out|\(5\d\d|\(400/i.test(res.error)) {
            batchSize = Math.ceil(batchSize / 2);
            continue;
          }
          return setError(res.error);
        }
        i += batch.length;
      }

      // Copy the files into storage, a small batch per request.
      let remaining = total;
      let changed = 0;
      let failed = 0;
      for (let guard = 0; guard < 500; guard++) {
        setPhase({
          label: `Saving designs: ${total - remaining} of ${total}...`,
          progress: 0.25 + 0.7 * ((total - remaining) / Math.max(total, 1)),
        });
        const res = await downloadTraceArt();
        if (!res.ok) return setError(res.error);
        changed += res.changed;
        failed += res.failed;
        remaining = res.remaining;
        if (res.remaining === 0 || res.processed === 0) break;
      }

      setPhase({ label: "Finishing up...", progress: 0.97 });
      const finish = await finishTraceSync(version, fileName);
      if (!finish.ok) return setError(finish.error);

      setDone(
        `Synced ${sets} set${sets === 1 ? "" : "s"} and ${shapes} nail shape${shapes === 1 ? "" : "s"}. ` +
          (changed > 0 ? `${changed} design file${changed === 1 ? "" : "s"} updated.` : "No design files changed.") +
          (failed > 0 ? ` ${failed} file${failed === 1 ? "" : "s"} couldn't be copied; run the sync again to retry them.` : ""),
      );
    } catch {
      setError("The sync stopped unexpectedly. Check your connection and try again.");
    } finally {
      setRunning(false);
      setPhase(null);
      startTransition(() => router.refresh());
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => run(false)} disabled={!configured || running} className="btn-primary">
          {running ? "Syncing..." : "Sync from Figma"}
        </button>
        {hasSynced && (
          <button
            type="button"
            onClick={() => run(true)}
            disabled={!configured || running}
            className="text-sm font-medium text-neutral-500 hover:text-neutral-900 disabled:opacity-50"
          >
            Re-import everything
          </button>
        )}
      </div>

      {phase && (
        <div className="space-y-1.5" role="status" aria-live="polite">
          <div className="h-2 overflow-hidden rounded-full bg-neutral-100">
            <div
              className="h-full rounded-full bg-neutral-900 transition-[width] duration-300"
              style={{ width: `${Math.round(phase.progress * 100)}%` }}
            />
          </div>
          <p className="text-xs text-neutral-500">{phase.label} Keep this page open.</p>
        </div>
      )}
      {error && (
        <p data-testid="sync-result" className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
          {error}
        </p>
      )}
      {done && (
        <p data-testid="sync-result" className="rounded-xl bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-700">
          {done}
        </p>
      )}
    </div>
  );
}
