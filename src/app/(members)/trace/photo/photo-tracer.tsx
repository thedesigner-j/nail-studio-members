"use client";

import { useEffect, useRef, useState } from "react";
import NailPicker from "@/components/trace/nail-picker";
import Lightbox from "@/components/trace/lightbox";
import { savePrefs, usePrefs } from "@/components/trace/prefs";
import {
  FINGER_KINDS,
  nailSizeMm,
  type FingerKind,
  type TraceShape,
} from "@/lib/trace";

type Photo = { src: string; width: number; height: number; name: string };

export default function PhotoTracer({ shapes }: { shapes: TraceShape[] }) {
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [error, setError] = useState("");
  const [kind, setKind] = useState<FingerKind>("Middle");
  const [open, setOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const prefs = usePrefs();
  const size = prefs.size ?? "M";
  const customWidth = prefs.customWidth ?? null;

  // Free the in-memory copy of the photo when it's replaced or the page closes.
  useEffect(() => {
    return () => {
      if (photo) URL.revokeObjectURL(photo.src);
    };
  }, [photo]);

  function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (fileRef.current) fileRef.current.value = "";
    if (!file) return;
    setError("");
    const src = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => setPhoto({ src, width: img.naturalWidth, height: img.naturalHeight, name: file.name });
    img.onerror = () => {
      URL.revokeObjectURL(src);
      setError("That file couldn't be opened as a picture. Try a JPG or PNG.");
    };
    img.src = src;
  }

  const shape = shapes.find((s) => s.shape === (prefs.shape ?? "Squoval")) ?? shapes[0];

  return (
    <div className="space-y-6">
      <section className="card space-y-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex h-32 w-32 items-center justify-center overflow-hidden rounded-xl border border-dashed border-neutral-300 bg-neutral-50">
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element -- a local photo that never leaves the device
              <img src={photo.src} alt="Chosen photo" className="max-h-full max-w-full object-contain" />
            ) : (
              <span className="px-2 text-center text-xs text-neutral-400">No photo yet</span>
            )}
          </div>
          <div className="space-y-2">
            <button type="button" onClick={() => fileRef.current?.click()} className="btn-secondary btn-sm">
              {photo ? "Choose a different photo" : "Choose a photo"}
            </button>
            <p className="text-xs text-neutral-500">
              Clear line drawings trace best. Use High contrast in the lightbox to make photos easier to see.
            </p>
            {error && <p className="text-xs text-red-600">{error}</p>}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={pick}
            data-testid="photo-input"
          />
        </div>
      </section>

      <section className="card space-y-4">
        <div>
          <p className="field-label">Finger</p>
          <div className="flex flex-wrap gap-2">
            {FINGER_KINDS.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                aria-pressed={kind === k}
                className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
                  kind === k ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200 text-neutral-700"
                }`}
              >
                {k}
              </button>
            ))}
          </div>
        </div>
        <NailPicker
          shapes={shapes}
          shape={shape.shape}
          size={size}
          customWidth={customWidth}
          kind={kind}
          onShape={(s) => savePrefs({ shape: s })}
          onSize={(s) => savePrefs({ size: s, customWidth: null })}
          onCustomWidth={(w) => savePrefs({ customWidth: w })}
        />
      </section>

      <button type="button" disabled={!photo} onClick={() => setOpen(true)} className="btn-primary w-full sm:w-auto">
        Start tracing
      </button>

      {open && photo && (
        <Lightbox
          shape={shape}
          nailMm={nailSizeMm(shape, kind, size, customWidth)}
          design={{ kind: "photo", src: photo.src, width: photo.width, height: photo.height }}
          title="Your photo"
          subtitle={kind}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
