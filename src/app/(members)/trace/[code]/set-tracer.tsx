"use client";

import { useState } from "react";
import NailSvg from "@/components/trace/nail-svg";
import NailPicker from "@/components/trace/nail-picker";
import Lightbox from "@/components/trace/lightbox";
import { savePrefs, usePrefs } from "@/components/trace/prefs";
import {
  FINGERS,
  fingerKind,
  fingerLabel,
  nailSizeMm,
  type ArtUrls,
  type Finger,
  type TraceSetSummary,
  type TraceShape,
} from "@/lib/trace";

export default function SetTracer({
  set,
  urls,
  shapes,
}: {
  set: TraceSetSummary;
  urls: ArtUrls;
  shapes: TraceShape[];
}) {
  const [finger, setFinger] = useState<Finger>(set.heroFinger);
  const [open, setOpen] = useState(false);
  const prefs = usePrefs();
  const size = prefs.size ?? "M";
  const customWidth = prefs.customWidth ?? null;
  const shape = shapes.find((s) => s.shape === (prefs.shape ?? "Squoval")) ?? shapes[0];
  const info = set.fingers[finger];
  const art = urls[finger] ?? { color: null, line: null };
  const index = FINGERS.indexOf(finger);
  const step = (delta: number) => setFinger(FINGERS[(index + delta + FINGERS.length) % FINGERS.length]);

  const hand = (side: "L" | "R") => (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
        {side === "L" ? "Left hand" : "Right hand"}
      </p>
      <div className="flex items-end gap-2">
        {FINGERS.filter((f) => f.startsWith(side)).map((f) => {
          const selected = f === finger;
          const mm = nailSizeMm(shape, fingerKind(f), size);
          return (
            <button
              key={f}
              type="button"
              onClick={() => setFinger(f)}
              aria-pressed={selected}
              aria-label={fingerLabel(f)}
              className={`flex flex-col items-center gap-1 rounded-xl p-1.5 ${
                selected ? "bg-neutral-900/5 ring-2 ring-neutral-900" : "hover:bg-neutral-100"
              }`}
            >
              <NailSvg
                geometry={shape.geometry}
                artUrl={urls[f]?.color ?? null}
                mode="color"
                tip={set.fingers[f]}
                className="w-auto"
                label={fingerLabel(f)}
                // Relative sizes, so the thumb reads bigger than the pinky.
                style={{ height: `${mm.h * 3}px` }}
              />
              <span className="text-[10px] text-neutral-500">{fingerKind(f)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <section className="card space-y-5">
        <div className="flex flex-wrap gap-6">
          {hand("L")}
          {hand("R")}
        </div>

        <div className="flex flex-wrap items-center gap-5 border-t border-neutral-100 pt-4">
          <div className="flex items-end gap-3">
            <figure className="flex flex-col items-center gap-1">
              <NailSvg
                geometry={shape.geometry}
                artUrl={art.color}
                mode="color"
                tip={info}
                className="h-28 w-auto"
                label={`${fingerLabel(finger)} in color`}
              />
              <figcaption className="text-[11px] text-neutral-500">Color</figcaption>
            </figure>
            <figure className="flex flex-col items-center gap-1">
              <NailSvg
                geometry={shape.geometry}
                artUrl={art.line}
                mode="line"
                tip={info}
                className="h-28 w-auto"
                label={`${fingerLabel(finger)} tracing lines`}
              />
              <figcaption className="text-[11px] text-neutral-500">Lines</figcaption>
            </figure>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-neutral-900">{fingerLabel(finger)}</p>
            {info?.design && <p className="text-sm text-neutral-600">{info.design}</p>}
            {info?.tip && (
              <p className="mt-1 flex items-center gap-1.5 text-xs text-neutral-500">
                {info.tip === "V" ? "V tip" : `${info.tip} tip`}
                {info.tipColor && (
                  <span
                    className="inline-block h-3 w-3 rounded-full border border-neutral-200"
                    style={{ backgroundColor: info.tipColor }}
                  />
                )}
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="card">
        <NailPicker
          shapes={shapes}
          shape={shape.shape}
          size={size}
          customWidth={customWidth}
          kind={fingerKind(finger)}
          onShape={(s) => savePrefs({ shape: s })}
          onSize={(s) => savePrefs({ size: s, customWidth: null })}
          onCustomWidth={(w) => savePrefs({ customWidth: w })}
        />
      </section>

      <button type="button" onClick={() => setOpen(true)} className="btn-primary w-full sm:w-auto">
        Start tracing
      </button>

      {open && (
        <Lightbox
          shape={shape}
          nailMm={nailSizeMm(shape, fingerKind(finger), size, customWidth)}
          design={{ kind: "figma", colorUrl: art.color, lineUrl: art.line, tip: info }}
          title={`${set.code} · ${set.name}`}
          subtitle={`${fingerLabel(finger)}${info?.design ? ` · ${info.design}` : ""}`}
          onClose={() => setOpen(false)}
          onPrev={() => step(-1)}
          onNext={() => step(1)}
        />
      )}
    </div>
  );
}
