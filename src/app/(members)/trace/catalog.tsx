"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import NailSvg from "@/components/trace/nail-svg";
import { usePrefs } from "@/components/trace/prefs";
import type { TraceSetSummary, TraceShape } from "@/lib/trace";

export default function Catalog({
  sets,
  heroUrls,
  shapes,
}: {
  sets: TraceSetSummary[];
  heroUrls: Record<string, string | null>;
  shapes: TraceShape[];
}) {
  const collections = useMemo(() => [...new Set(sets.map((s) => s.collection))], [sets]);
  const [collection, setCollection] = useState<string>("All");
  const [query, setQuery] = useState("");
  const shapeName = usePrefs().shape ?? "Squoval";
  const shape = shapes.find((s) => s.shape === shapeName) ?? shapes[0];
  const q = query.trim().toLowerCase();
  const visible = sets.filter(
    (s) =>
      (collection === "All" || s.collection === collection) &&
      (!q || `${s.code} ${s.name} ${s.description ?? ""}`.toLowerCase().includes(q)),
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {["All", ...collections].map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCollection(c)}
            className={collection === c ? "nav-pill-active" : "nav-pill"}
          >
            {c}
          </button>
        ))}
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search designs"
          className="field-input ml-auto w-full py-1.5 sm:w-56"
          aria-label="Search designs"
        />
      </div>

      {visible.length === 0 ? (
        <p className="text-sm text-neutral-500">No designs match that search.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {visible.map((set) => (
            <li key={set.id}>
              <Link
                href={`/trace/${set.code}`}
                className="card flex h-full flex-col items-center gap-2 p-3 text-center transition hover:border-neutral-300"
              >
                <div className="flex h-24 items-end justify-center">
                  {shape && (
                    <NailSvg
                      geometry={shape.geometry}
                      artUrl={heroUrls[set.id] ?? null}
                      mode="color"
                      tip={set.fingers[set.heroFinger]}
                      className="h-full w-auto"
                      label={`${set.name}`}
                    />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">{set.code}</p>
                  <p className="text-sm font-medium leading-snug text-neutral-900">{set.name}</p>
                </div>
                {set.palette.length > 0 && (
                  <div className="mt-auto flex gap-1" aria-hidden>
                    {set.palette.map((p) => (
                      <span
                        key={p.hex + p.name}
                        className="h-3 w-3 rounded-full border border-neutral-200"
                        style={{ backgroundColor: p.hex }}
                      />
                    ))}
                  </div>
                )}
                {set.hidden && <span className="badge bg-neutral-100 text-neutral-600">Hidden from techs</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
