import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentProfile } from "@/lib/data";
import { canUseTrace, getTraceCatalog, getTraceShapes } from "@/lib/trace-data";
import Catalog from "./catalog";

export default async function TracePage() {
  const profile = await getCurrentProfile();
  if (!canUseTrace(profile)) notFound();
  const isAdmin = !!profile?.is_admin;

  const [{ sets, heroUrls }, shapes] = await Promise.all([getTraceCatalog(isAdmin), getTraceShapes()]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Trace</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Turn your phone into a lightbox: pick a design, lock it in place, lay a clear tip on the screen and trace.
          </p>
        </div>
        <Link href="/trace/photo" className="btn-secondary btn-sm">
          Use my own photo
        </Link>
      </div>

      <details className="card group">
        <summary className="cursor-pointer list-none text-sm font-medium text-neutral-900">
          How it works <span className="text-neutral-400 group-open:hidden">+</span>
        </summary>
        <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-neutral-600">
          <li>Pick a set, then the finger, shape and size you&apos;re making.</li>
          <li>The first time, match your screen to a bank card so everything shows at real size.</li>
          <li>Drag, pinch or flip the design to sit right inside the dashed nail guide, then tap Lock.</li>
          <li>Turn brightness up, lay a clear tip or swatch on the screen and trace with black gel. Cure, then build.</li>
        </ol>
      </details>

      {sets.length === 0 ? (
        <div className="card text-sm text-neutral-600">
          No designs yet.{" "}
          {isAdmin ? (
            <>
              Pull them in from Figma under{" "}
              <Link href="/admin/trace" className="underline">
                Admin → Trace
              </Link>
              .
            </>
          ) : (
            "Ask an admin to sync them from Figma."
          )}{" "}
          You can still <Link href="/trace/photo" className="underline">trace your own photo</Link>.
        </div>
      ) : (
        <Catalog sets={sets} heroUrls={heroUrls} shapes={shapes} />
      )}
    </div>
  );
}
