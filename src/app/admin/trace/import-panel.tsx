"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { FigmaNode } from "@/lib/figma";
import { buildPlan, findStructure } from "@/lib/trace-parse";
import { FINGERS } from "@/lib/trace";
import { finishTraceSync, importTraceArt, startTraceImport } from "./actions";

// Reads the file the Figma plugin saved, works out the sets in the browser,
// then sends them to the server in small pieces.

type Bundle = {
  format?: string;
  fileName?: string;
  document?: FigmaNode;
  frames?: Record<string, FigmaNode>;
  geometry?: Record<string, FigmaNode>;
  svgs?: Record<string, string | null>;
};

type Item = { code: string; finger: string; mode: "color" | "line"; svg: string | null };

// Keep each request well under the server's 1 MB limit.
const MAX_ITEMS = 40;
const MAX_BYTES = 600_000;

function batches(items: Item[]) {
  const out: Item[][] = [];
  let current: Item[] = [];
  let bytes = 0;
  for (const item of items) {
    const size = (item.svg?.length ?? 0) + 100;
    if (current.length && (current.length >= MAX_ITEMS || bytes + size > MAX_BYTES)) {
      out.push(current);
      current = [];
      bytes = 0;
    }
    current.push(item);
    bytes += size;
  }
  if (current.length) out.push(current);
  return out;
}

export default function ImportPanel({ ready }: { ready: boolean }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState<{ label: string; progress: number } | null>(null);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  async function run(file: File) {
    setRunning(true);
    setError("");
    setDone("");
    setPhase({ label: "Reading the file...", progress: 0.02 });

    try {
      let bundle: Bundle;
      try {
        bundle = JSON.parse(await file.text());
      } catch {
        return setError("That isn't the file from the Figma plugin. Choose the nail-designs-….json file it saved.");
      }
      if (bundle.format !== "nail-studio-trace" || !bundle.document) {
        return setError("That isn't the file from the Figma plugin. Choose the nail-designs-….json file it saved.");
      }

      const structure = findStructure(bundle.document);
      if (structure.sets.length === 0) {
        return setError('No nail sets in that file. Run the plugin in the Figma file that has the "Sets - …" pages.');
      }
      const plan = buildPlan(
        structure,
        (id) => bundle.frames?.[id],
        (id) => bundle.geometry?.[id],
      );

      setPhase({ label: `Saving ${plan.sets.length} sets and ${plan.shapes.length} nail shapes...`, progress: 0.06 });
      const start = await startTraceImport(plan);
      if (!start.ok) return setError(start.error);

      const items: Item[] = plan.sets.flatMap((set) =>
        FINGERS.flatMap((finger) =>
          (["color", "line"] as const)
            .filter((mode) => set.art[finger]?.[mode])
            .map((mode) => ({ code: set.code, finger, mode, svg: bundle.svgs?.[set.art[finger]![mode]!] ?? null })),
        ),
      );

      let sent = 0;
      let changed = 0;
      let failed = 0;
      for (const batch of batches(items)) {
        setPhase({
          label: `Saving designs: ${sent} of ${items.length}...`,
          progress: 0.1 + 0.85 * (sent / Math.max(items.length, 1)),
        });
        const res = await importTraceArt(batch);
        if (!res.ok) return setError(res.error);
        changed += res.changed;
        failed += res.failed;
        sent += batch.length;
      }

      setPhase({ label: "Finishing up...", progress: 0.97 });
      const finish = await finishTraceSync("", bundle.fileName ?? "");
      if (!finish.ok) return setError(finish.error);

      setDone(
        `Imported ${plan.sets.length} set${plan.sets.length === 1 ? "" : "s"} and ${plan.shapes.length} nail shape${
          plan.shapes.length === 1 ? "" : "s"
        }. ` +
          (changed > 0 ? `${changed} design file${changed === 1 ? "" : "s"} updated.` : "No design files changed.") +
          (failed > 0 ? ` ${failed} couldn't be saved; import the file again to retry them.` : ""),
      );
    } catch {
      setError("The import stopped unexpectedly. Check your connection and try again.");
    } finally {
      setRunning(false);
      setPhase(null);
      if (fileRef.current) fileRef.current.value = "";
      startTransition(() => router.refresh());
    }
  }

  return (
    <div className="space-y-3">
      <input
        ref={fileRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        data-testid="import-file"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) run(file);
        }}
      />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={!ready || running}
        className="btn-primary"
      >
        {running ? "Importing..." : "Choose the exported file"}
      </button>

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
        <p data-testid="import-result" className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
          {error}
        </p>
      )}
      {done && (
        <p data-testid="import-result" className="rounded-xl bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-700">
          {done}
        </p>
      )}
    </div>
  );
}
