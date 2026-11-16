"use client";

import {
  SIZES,
  SIZE_LABELS,
  formatMm,
  nailSizeMm,
  type FingerKind,
  type ShapeName,
  type SizeName,
  type TraceShape,
} from "@/lib/trace";

// Shape, size, and an optional custom tip width.
export default function NailPicker({
  shapes,
  shape,
  size,
  customWidth,
  kind,
  onShape,
  onSize,
  onCustomWidth,
}: {
  shapes: TraceShape[];
  shape: ShapeName;
  size: SizeName;
  customWidth: number | null;
  kind: FingerKind;
  onShape: (shape: ShapeName) => void;
  onSize: (size: SizeName) => void;
  onCustomWidth: (width: number | null) => void;
}) {
  const current = shapes.find((s) => s.shape === shape) ?? shapes[0];
  const mm = current ? nailSizeMm(current, kind, size, customWidth) : null;

  return (
    <div className="space-y-4">
      <div>
        <p className="field-label">Shape</p>
        <div className="flex flex-wrap gap-2">
          {shapes.map((s) => {
            const g = s.geometry;
            const active = s.shape === shape;
            return (
              <button
                key={s.shape}
                type="button"
                onClick={() => onShape(s.shape)}
                aria-pressed={active}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium ${
                  active ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200 text-neutral-700"
                }`}
              >
                <svg viewBox={`-2 -2 ${g.width + 4} ${g.height + 4}`} className="h-4 w-3" aria-hidden>
                  <path
                    d={g.mask.d}
                    transform={`translate(${g.mask.x} ${g.mask.y})`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.5}
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>
                {s.shape}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="field-label">Size</p>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-full border border-neutral-200 p-0.5 text-sm">
            {SIZES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  onSize(s);
                  onCustomWidth(null);
                }}
                aria-pressed={!customWidth && size === s}
                className={`rounded-full px-3 py-1 font-medium ${
                  !customWidth && size === s ? "bg-neutral-900 text-white" : "text-neutral-600"
                }`}
              >
                {SIZE_LABELS[s]}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-1.5 text-sm text-neutral-600">
            or my tip is
            <input
              type="number"
              inputMode="decimal"
              min={5}
              max={30}
              step={0.5}
              value={customWidth ?? ""}
              placeholder="—"
              onChange={(e) => {
                const value = Number(e.target.value);
                onCustomWidth(e.target.value && value >= 5 && value <= 30 ? value : null);
              }}
              className="field-input w-20 py-1.5"
              aria-label="Custom tip width in millimetres"
            />
            mm wide
          </label>
        </div>
        {mm && (
          <p className="mt-1.5 text-xs text-neutral-500">
            {kind}: {formatMm(Math.round(mm.w * 10) / 10)} × {formatMm(Math.round(mm.h * 10) / 10)} mm
          </p>
        )}
      </div>
    </div>
  );
}
