"use client";

import { useId } from "react";
import type { ArtMode, FingerInfo, ShapeGeometry } from "@/lib/trace";

// One nail drawn the way the Figma "Nail" component draws it: the art master
// scaled to the nail's width and anchored at the cuticle, the tip style on
// top, all clipped to the nail's outline.
export default function NailSvg({
  geometry: g,
  artUrl,
  mode,
  tip,
  className,
  style,
  label,
  outline = mode === "line" ? "#171717" : "#d4d4d4",
}: {
  geometry: ShapeGeometry;
  artUrl: string | null;
  mode: ArtMode;
  tip?: FingerInfo;
  className?: string;
  style?: React.CSSProperties;
  label?: string;
  outline?: string;
}) {
  const clipId = `nail-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const maskTransform = `translate(${g.mask.x} ${g.mask.y})`;

  return (
    <svg viewBox={`0 0 ${g.width} ${g.height}`} className={className} style={style} role="img" aria-label={label}>
      <defs>
        <clipPath id={clipId}>
          <path d={g.mask.d} transform={maskTransform} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <rect width={g.width} height={g.height} fill="#fff" />
        <NailDesign geometry={g} artUrl={artUrl} mode={mode} tip={tip} />
      </g>
      <path
        d={g.mask.d}
        transform={maskTransform}
        fill="none"
        stroke={outline}
        strokeWidth={1}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

// The design on its own (no clip or outline), in the nail's coordinates.
// The lightbox reuses it so tracing matches the previews exactly.
export function NailDesign({
  geometry: g,
  artUrl,
  mode,
  tip,
}: {
  geometry: ShapeGeometry;
  artUrl: string | null;
  mode: ArtMode;
  tip?: FingerInfo;
}) {
  const tipPiece = tip?.tip ? g.tips[tip.tip] : undefined;
  const tipFill = mode === "color" ? tipPiece?.fill : undefined;
  const tipLine = mode === "line" ? tipPiece?.line : undefined;

  return (
    <>
      {artUrl && (
        <image href={artUrl} x={g.art.x} y={g.art.y} width={g.art.w} height={g.art.h} preserveAspectRatio="none" />
      )}
      {tipFill && (
        <path d={tipFill.d} transform={`translate(${tipFill.x} ${tipFill.y})`} fill={tip?.tipColor ?? "#ffffff"} />
      )}
      {tipLine && <path d={tipLine.d} transform={`translate(${tipLine.x} ${tipLine.y})`} fill="#000000" />}
    </>
  );
}
