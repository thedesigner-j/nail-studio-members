import type { Branding } from "@/lib/branding";

// The studio's logo and/or name, as set in Admin > Branding. No hooks, so it
// renders on the server and inside client components alike.
export default function BrandMark({ branding, size = "md" }: { branding: Branding; size?: "md" | "lg" }) {
  const showName = !branding.logoUrl || branding.showNameWithLogo;
  const logoHeight = size === "lg" ? "h-10 max-w-[12rem]" : "h-8 max-w-[9rem]";

  return (
    <span className="flex min-w-0 items-center gap-2 font-semibold text-neutral-900">
      {branding.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- uploaded logo of unknown dimensions
        <img
          src={branding.logoUrl}
          alt={showName ? "" : branding.name}
          className={`${logoHeight} w-auto shrink-0 object-contain`}
        />
      ) : (
        <span aria-hidden>✦</span>
      )}
      {showName && <span className="truncate">{branding.name}</span>}
    </span>
  );
}
