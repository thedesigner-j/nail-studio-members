"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatMm, type ArtMode, type FingerInfo, type TraceShape } from "@/lib/trace";
import { NailDesign } from "./nail-svg";
import Calibrate from "./calibrate";
import { guessPxPerMm, loadPrefs, savePrefs } from "./prefs";

// The phone becomes a lightbox: a white screen with the design at real size
// inside a nail-shaped guide. Line it up, lock it, lay a clear tip on the
// screen and trace.

export type LightboxDesign =
  | { kind: "figma"; colorUrl: string | null; lineUrl: string | null; tip?: FingerInfo }
  | { kind: "photo"; src: string; width: number; height: number };

type Transform = { tx: number; ty: number; s: number; r: number; fx: 1 | -1; fy: 1 | -1 };
const IDENTITY: Transform = { tx: 0, ty: 0, s: 1, r: 0, fx: 1, fy: 1 };

type Point = { x: number; y: number };
const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const angle = (a: Point, b: Point) => (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
const mid = (a: Point, b: Point) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

const UNLOCK_HOLD_MS = 1200;

export default function Lightbox({
  shape,
  nailMm,
  design,
  title,
  subtitle,
  onClose,
  onPrev,
  onNext,
}: {
  shape: TraceShape;
  nailMm: { w: number; h: number };
  design: LightboxDesign;
  title: string;
  subtitle?: string;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
}) {
  const g = shape.geometry;
  // Only ever rendered in the browser (after a tap), so reading the saved
  // prefs while setting up state is safe.
  const [pxPerMm, setPxPerMm] = useState<number | null>(() => loadPrefs().pxPerMm ?? null);
  const [calibrating, setCalibrating] = useState(() => !loadPrefs().pxPerMm);
  const [viewport, setViewport] = useState({ w: 390, h: 760 });
  const [t, setT] = useState<Transform>(IDENTITY);
  const [opacity, setOpacity] = useState(() => {
    const saved = loadPrefs().opacity;
    return typeof saved === "number" ? saved : 1;
  });
  const [showGuide, setShowGuide] = useState(true);
  const [clip, setClip] = useState(true);
  const [highContrast, setHighContrast] = useState(false);
  const hasLine = design.kind === "figma" && (!!design.lineUrl || !!(design.tip?.tip && g.tips[design.tip.tip]?.line));
  const [mode, setMode] = useState<ArtMode>(hasLine ? "line" : "color");
  const [locked, setLocked] = useState(false);
  const [tip, setTip] = useState<string | null>(null);

  // A new finger or design starts lined up with the guide again.
  const designKey = design.kind === "figma" ? `${design.colorUrl}|${design.lineUrl}` : design.src;
  const [shownKey, setShownKey] = useState(designKey);
  if (shownKey !== designKey) {
    setShownKey(designKey);
    setT(IDENTITY);
    setMode(hasLine ? "line" : "color");
  }

  // Fill the screen, keep the page underneath from scrolling or zooming.
  useEffect(() => {
    const update = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
    update();
    window.addEventListener("resize", update);
    const prevent = (e: Event) => e.preventDefault();
    document.addEventListener("gesturestart", prevent);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("resize", update);
      document.removeEventListener("gesturestart", prevent);
      document.body.style.overflow = overflow;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !locked && !calibrating) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [locked, calibrating, onClose]);

  // Keep the screen awake while locked (where the browser allows it).
  useEffect(() => {
    if (!locked) return;
    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;
    const request = async () => {
      try {
        const lock = await navigator.wakeLock?.request("screen");
        if (cancelled) await lock?.release();
        else sentinel = lock ?? null;
      } catch {
        // Not supported or not allowed; the tip below covers it.
      }
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") request();
    };
    request();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      sentinel?.release().catch(() => {});
    };
  }, [locked]);

  // --- Gestures: one finger moves, two fingers resize and turn ---------------
  const pointers = useRef(new Map<number, Point>());
  const gesture = useRef<{ start: Transform; a: Point; b?: Point } | null>(null);
  const latest = useRef(t);
  useEffect(() => {
    latest.current = t;
  }, [t]);

  const rebase = useCallback((current: Transform) => {
    const pts = [...pointers.current.values()];
    gesture.current = pts.length ? { start: current, a: pts[0], b: pts[1] } : null;
  }, []);

  function onPointerDown(e: React.PointerEvent) {
    if (locked) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    rebase(latest.current);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (locked || !pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g0 = gesture.current;
    if (!g0) return;
    const pts = [...pointers.current.values()];
    if (pts.length >= 2 && g0.b) {
      const s = Math.min(8, Math.max(0.2, g0.start.s * (dist(pts[0], pts[1]) / Math.max(1, dist(g0.a, g0.b)))));
      const r = g0.start.r + angle(pts[0], pts[1]) - angle(g0.a, g0.b);
      const m0 = mid(g0.a, g0.b);
      const m1 = mid(pts[0], pts[1]);
      const next = { ...g0.start, s, r, tx: g0.start.tx + m1.x - m0.x, ty: g0.start.ty + m1.y - m0.y };
      latest.current = next;
      setT(next);
    } else if (pts.length === 1) {
      const next = { ...g0.start, tx: g0.start.tx + pts[0].x - g0.a.x, ty: g0.start.ty + pts[0].y - g0.a.y };
      latest.current = next;
      setT(next);
    }
  }

  function onPointerUp(e: React.PointerEvent) {
    if (!pointers.current.delete(e.pointerId)) return;
    rebase(latest.current);
  }

  function onWheel(e: React.WheelEvent) {
    if (locked) return;
    if (e.shiftKey) setT((c) => ({ ...c, r: c.r + e.deltaY * 0.2 }));
    else setT((c) => ({ ...c, s: Math.min(8, Math.max(0.2, c.s * Math.exp(-e.deltaY * 0.0015))) }));
  }

  function lock() {
    setLocked(true);
    pointers.current.clear();
    gesture.current = null;
    if (!loadPrefs().brightnessTipSeen) {
      setTip("Turn your screen brightness all the way up so the design shows through the tip.");
      savePrefs({ brightnessTipSeen: true });
      window.setTimeout(() => setTip(null), 6000);
    }
  }

  if (calibrating || pxPerMm === null) {
    return (
      <div className="fixed inset-0 z-50 bg-white" role="dialog" aria-modal="true" aria-label="Calibrate screen">
        <Calibrate
          initial={pxPerMm ?? guessPxPerMm()}
          onSave={(value) => {
            savePrefs({ pxPerMm: value });
            setPxPerMm(value);
            setCalibrating(false);
          }}
          onCancel={pxPerMm === null ? onClose : () => setCalibrating(false)}
        />
      </div>
    );
  }

  // Geometry in screen pixels.
  const W = nailMm.w * pxPerMm;
  const k = W / g.width;
  const H = g.height * k;
  const ox = viewport.w / 2 - W / 2;
  const oy = Math.max(64, viewport.h * 0.38 - H / 2);
  const guideTransform = `translate(${ox} ${oy}) scale(${k}) translate(${g.mask.x} ${g.mask.y})`;
  const designTransform =
    `translate(${ox + W / 2 + t.tx} ${oy + H / 2 + t.ty}) rotate(${t.r}) ` +
    `scale(${t.s * t.fx} ${t.s * t.fy}) translate(${-W / 2} ${-H / 2}) scale(${k})`;

  let photoBox = null;
  if (design.kind === "photo") {
    const cover = Math.max(g.width / design.width, g.height / design.height);
    const w = design.width * cover;
    const h = design.height * cover;
    photoBox = { x: (g.width - w) / 2, y: (g.height - h) / 2, w, h };
  }

  return (
    <div
      className="fixed inset-0 z-50 select-none overflow-hidden bg-white"
      style={{ touchAction: "none", overscrollBehavior: "none" }}
      role="dialog"
      aria-modal="true"
      aria-label={`Tracing ${title}`}
    >
      <svg
        data-testid="trace-stage"
        className="absolute inset-0 h-full w-full"
        width={viewport.w}
        height={viewport.h}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
      >
        <defs>
          <clipPath id="trace-guide-clip">
            <path d={g.mask.d} transform={guideTransform} />
          </clipPath>
          <filter id="trace-high-contrast">
            <feColorMatrix type="saturate" values="0" />
            <feComponentTransfer>
              <feFuncR type="linear" slope="2.2" intercept="-0.6" />
              <feFuncG type="linear" slope="2.2" intercept="-0.6" />
              <feFuncB type="linear" slope="2.2" intercept="-0.6" />
            </feComponentTransfer>
          </filter>
        </defs>
        <rect width="100%" height="100%" fill="#ffffff" />
        <g clipPath={clip ? "url(#trace-guide-clip)" : undefined}>
          <g data-testid="trace-design" transform={designTransform} opacity={opacity}>
            {design.kind === "figma" ? (
              <NailDesign
                geometry={g}
                artUrl={mode === "line" ? design.lineUrl : design.colorUrl}
                mode={mode}
                tip={design.tip}
              />
            ) : (
              photoBox && (
                <image
                  href={design.src}
                  x={photoBox.x}
                  y={photoBox.y}
                  width={photoBox.w}
                  height={photoBox.h}
                  preserveAspectRatio="none"
                  filter={highContrast ? "url(#trace-high-contrast)" : undefined}
                />
              )
            )}
          </g>
        </g>
        {showGuide && (
          <path
            data-testid="trace-guide"
            d={g.mask.d}
            transform={guideTransform}
            fill="none"
            stroke="#000000"
            strokeOpacity={0.45}
            strokeWidth={1.25}
            strokeDasharray="4 3"
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>

      {/* 10 mm bar: hold a ruler to it to check the real-size calibration. */}
      {!locked && (
        <div className="pointer-events-none absolute left-4 top-[max(4.25rem,calc(env(safe-area-inset-top)+3.5rem))] flex items-center gap-2">
          <div className="h-2 border-x-2 border-neutral-400" style={{ width: 10 * pxPerMm }}>
            <div className="mt-[3px] h-0.5 bg-neutral-400" />
          </div>
          <span className="text-[11px] text-neutral-400">10 mm</span>
        </div>
      )}

      {!locked && (
        <>
          <div className="absolute inset-x-0 top-0 flex items-center gap-2 bg-white/90 px-3 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur">
            <button type="button" onClick={onClose} className="btn-secondary btn-sm" aria-label="Close">
              ✕
            </button>
            <div className="min-w-0 flex-1 text-center">
              <p className="truncate text-sm font-semibold text-neutral-900">{title}</p>
              <p className="truncate text-xs text-neutral-500">
                {subtitle ? `${subtitle} · ` : ""}
                {shape.shape} · {formatMm(Math.round(nailMm.w * 10) / 10)} × {formatMm(Math.round(nailMm.h * 10) / 10)} mm
              </p>
            </div>
            <button type="button" onClick={lock} className="btn-primary btn-sm">
              Lock
            </button>
          </div>

          {(onPrev || onNext) && (
            <>
              {onPrev && (
                <button
                  type="button"
                  onClick={onPrev}
                  aria-label="Previous nail"
                  className="absolute left-2 top-[38%] flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-neutral-900/80 text-white"
                >
                  ‹
                </button>
              )}
              {onNext && (
                <button
                  type="button"
                  onClick={onNext}
                  aria-label="Next nail"
                  className="absolute right-2 top-[38%] flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-neutral-900/80 text-white"
                >
                  ›
                </button>
              )}
            </>
          )}

          <div className="absolute inset-x-0 bottom-0 space-y-3 rounded-t-2xl border-t border-neutral-200 bg-white/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
            <p className="text-center text-xs text-neutral-500">Drag to move · pinch to resize and turn</p>

            <label className="flex items-center gap-3 text-sm text-neutral-700">
              <span className="w-16 shrink-0">Opacity</span>
              <input
                type="range"
                min={0.1}
                max={1}
                step={0.05}
                value={opacity}
                onChange={(e) => {
                  setOpacity(Number(e.target.value));
                  savePrefs({ opacity: Number(e.target.value) });
                }}
                className="flex-1 accent-neutral-900"
              />
              <span className="w-10 text-right text-xs tabular-nums text-neutral-500">{Math.round(opacity * 100)}%</span>
            </label>

            <div className="flex flex-wrap gap-2">
              {design.kind === "figma" ? (
                <div className="flex rounded-full border border-neutral-200 p-0.5 text-sm">
                  {(["line", "color"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMode(m)}
                      disabled={m === "line" && !hasLine}
                      aria-pressed={mode === m}
                      className={`rounded-full px-3 py-1 font-medium disabled:opacity-40 ${
                        mode === m ? "bg-neutral-900 text-white" : "text-neutral-600"
                      }`}
                    >
                      {m === "line" ? "Lines" : "Color"}
                    </button>
                  ))}
                </div>
              ) : (
                <Toggle on={highContrast} onClick={() => setHighContrast((v) => !v)}>
                  High contrast
                </Toggle>
              )}
              <Toggle on={showGuide} onClick={() => setShowGuide((v) => !v)}>
                Guide
              </Toggle>
              <Toggle on={clip} onClick={() => setClip((v) => !v)}>
                Trim to nail
              </Toggle>
            </div>

            <div className="grid grid-cols-5 gap-2">
              <ToolButton label="Flip sideways" onClick={() => setT((c) => ({ ...c, fx: c.fx === 1 ? -1 : 1 }))}>
                ⇋
              </ToolButton>
              <ToolButton label="Flip upside down" onClick={() => setT((c) => ({ ...c, fy: c.fy === 1 ? -1 : 1 }))}>
                ⇵
              </ToolButton>
              <ToolButton label="Turn 90°" onClick={() => setT((c) => ({ ...c, r: c.r + 90 }))}>
                ↻
              </ToolButton>
              <ToolButton label="Fit to nail" onClick={() => setT(IDENTITY)}>
                ⤢
              </ToolButton>
              <ToolButton label="Recalibrate screen" onClick={() => setCalibrating(true)}>
                ▭
              </ToolButton>
            </div>
          </div>
        </>
      )}

      {locked && <LockLayer onUnlock={() => setLocked(false)} tip={tip} />}
    </div>
  );
}

function Toggle({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`rounded-full border px-3 py-1 text-sm font-medium ${
        on ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200 text-neutral-600"
      }`}
    >
      {children}
    </button>
  );
}

function ToolButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex flex-col items-center gap-0.5 rounded-xl border border-neutral-200 py-1.5 text-lg text-neutral-800 active:bg-neutral-100"
    >
      <span aria-hidden>{children}</span>
      <span className="text-[10px] leading-tight text-neutral-500">{label.split(" ")[0]}</span>
    </button>
  );
}

// While locked, a clear layer swallows every touch so a resting hand can't
// move the design. Unlock by holding the lock button, then letting go (the
// controls come back a moment after release, so lifting the finger doesn't
// tap whatever button appears underneath it).
function LockLayer({ onUnlock, tip }: { onUnlock: () => void; tip: string | null }) {
  const [holding, setHolding] = useState(false);
  const [ready, setReady] = useState(false);
  const timer = useRef<number | null>(null);

  const cancel = () => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
    setHolding(false);
    setReady(false);
  };

  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);

  return (
    <div
      data-testid="lock-layer"
      className="absolute inset-0 z-10"
      style={{ touchAction: "none" }}
      onPointerDown={(e) => e.preventDefault()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {tip && (
        <p className="absolute inset-x-4 top-[max(1rem,env(safe-area-inset-top))] rounded-xl bg-neutral-900/85 px-3 py-2 text-center text-sm text-white">
          {tip}
        </p>
      )}
      <button
        type="button"
        aria-label="Hold to unlock"
        className="absolute bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 flex h-14 w-14 items-center justify-center rounded-full bg-neutral-900/70 text-white"
        onPointerDown={(e) => {
          e.stopPropagation();
          setHolding(true);
          timer.current = window.setTimeout(() => setReady(true), UNLOCK_HOLD_MS);
        }}
        onPointerUp={() => {
          if (ready) window.setTimeout(onUnlock, 350);
          else cancel();
        }}
        onPointerLeave={() => {
          if (!ready) cancel();
        }}
        onPointerCancel={cancel}
      >
        <svg viewBox="0 0 56 56" className="absolute inset-0 h-full w-full -rotate-90" aria-hidden>
          <circle
            cx="28"
            cy="28"
            r="25"
            fill="none"
            stroke="white"
            strokeWidth="3"
            strokeDasharray={157}
            strokeDashoffset={holding ? 0 : 157}
            style={{ transition: holding ? `stroke-dashoffset ${UNLOCK_HOLD_MS}ms linear` : "none" }}
          />
        </svg>
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <rect x="5" y="11" width="14" height="9" rx="2" />
          <path d={ready ? "M8 11V8a4 4 0 0 1 7.5-2" : "M8 11V8a4 4 0 0 1 8 0v3"} />
        </svg>
      </button>
      <p className="absolute bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-20 text-xs text-neutral-400">
        {ready ? "Let go to unlock" : "Hold to unlock"}
      </p>
    </div>
  );
}
