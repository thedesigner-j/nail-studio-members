import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentProfile } from "@/lib/data";
import { canUseTrace, getTraceSet, getTraceShapes } from "@/lib/trace-data";
import SetTracer from "./set-tracer";

export default async function TraceSetPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const profile = await getCurrentProfile();
  if (!canUseTrace(profile)) notFound();

  const [data, shapes] = await Promise.all([getTraceSet(code, !!profile?.is_admin), getTraceShapes()]);
  if (!data || shapes.length === 0) notFound();
  const { set, urls, previousCode, nextCode } = data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 text-sm">
        <Link href="/trace" className="text-neutral-500 hover:text-neutral-900">
          ← All designs
        </Link>
        <div className="flex gap-3">
          {previousCode && (
            <Link href={`/trace/${previousCode}`} className="text-neutral-500 hover:text-neutral-900">
              ‹ {previousCode}
            </Link>
          )}
          {nextCode && (
            <Link href={`/trace/${nextCode}`} className="text-neutral-500 hover:text-neutral-900">
              {nextCode} ›
            </Link>
          )}
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
          {set.collection} · {set.code}
        </p>
        <h1 className="text-2xl font-semibold text-neutral-900">{set.name}</h1>
        {set.description && <p className="mt-1 text-sm text-neutral-600">{set.description}</p>}
        {set.hidden && <span className="badge mt-2 bg-neutral-100 text-neutral-600">Hidden from techs</span>}
      </div>

      {set.palette.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {set.palette.map((p) => (
            <span key={p.hex + p.name} className="flex items-center gap-1.5 text-xs text-neutral-600">
              <span className="h-4 w-4 rounded-full border border-neutral-200" style={{ backgroundColor: p.hex }} />
              {p.name}
            </span>
          ))}
        </div>
      )}

      <SetTracer key={set.code} set={set} urls={urls} shapes={shapes} />
    </div>
  );
}
