"use client";

import { useState } from "react";

// Bank and ID cards are all the same size (ISO/IEC 7810 ID-1).
const CARD_W_MM = 85.6;
const CARD_H_MM = 53.98;
const CARD_RADIUS_MM = 3.18;

const MIN = 2;
const MAX = 14;

export default function Calibrate({
  initial,
  onSave,
  onCancel,
}: {
  initial: number;
  onSave: (pxPerMm: number) => void;
  onCancel?: () => void;
}) {
  const [value, setValue] = useState(Math.min(MAX, Math.max(MIN, initial)));
  const nudge = (delta: number) => setValue((v) => Math.min(MAX, Math.max(MIN, +(v + delta).toFixed(3))));

  return (
    <div className="absolute inset-0 z-10 flex flex-col bg-white">
      <div className="p-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <div
          data-testid="calibration-card"
          className="border-2 border-dashed border-rose-500 bg-rose-50/40"
          style={{
            width: CARD_W_MM * value,
            height: CARD_H_MM * value,
            borderRadius: CARD_RADIUS_MM * value,
          }}
        />
      </div>

      <div className="mt-auto space-y-4 rounded-t-2xl border-t border-neutral-200 bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div>
          <h2 className="font-semibold text-neutral-900">Match your screen to real size</h2>
          <p className="mt-1 text-sm text-neutral-600">
            Lay any bank or ID card on the screen, tucked into the top-left corner of the pink box. Adjust until the box
            is exactly the size of the card. You only do this once on each phone.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button type="button" onClick={() => nudge(-0.02)} className="btn-secondary btn-sm w-10" aria-label="Smaller">
            −
          </button>
          <input
            type="range"
            min={MIN}
            max={MAX}
            step={0.01}
            value={value}
            onChange={(e) => setValue(Number(e.target.value))}
            className="flex-1 accent-neutral-900"
            aria-label="Box size"
          />
          <button type="button" onClick={() => nudge(0.02)} className="btn-secondary btn-sm w-10" aria-label="Bigger">
            +
          </button>
        </div>

        <div className="flex gap-2">
          {onCancel && (
            <button type="button" onClick={onCancel} className="btn-secondary flex-1">
              Cancel
            </button>
          )}
          <button type="button" onClick={() => onSave(value)} className="btn-primary flex-1">
            It matches, save
          </button>
        </div>
      </div>
    </div>
  );
}
