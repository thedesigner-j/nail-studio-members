import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentProfile } from "@/lib/data";
import { canUseTrace, getTraceShapes } from "@/lib/trace-data";
import PhotoTracer from "./photo-tracer";

export default async function TracePhotoPage() {
  const profile = await getCurrentProfile();
  if (!canUseTrace(profile)) notFound();
  const shapes = await getTraceShapes();

  return (
    <div className="space-y-6">
      <Link href="/trace" className="text-sm text-neutral-500 hover:text-neutral-900">
        ← All designs
      </Link>
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Trace your own photo</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Pick any picture from your phone. It stays on your phone: nothing is uploaded or saved.
        </p>
      </div>
      {shapes.length === 0 ? (
        <p className="card text-sm text-neutral-600">
          The nail shapes haven&apos;t been synced from Figma yet. An admin can do that under Admin → Trace.
        </p>
      ) : (
        <PhotoTracer shapes={shapes} />
      )}
    </div>
  );
}
