"use client";

import BrandMark from "@/components/brand-mark";
import type { Branding } from "@/lib/branding";

export default function BrandLink({ branding }: { branding: Branding }) {
  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    // See redirect-if-authenticated.tsx for why this uses window.location
    // directly instead of useRouter() — window.top can't be targeted otherwise.
    const target = `${window.location.origin}/dashboard`;
    if (window.top && window.top !== window.self) {
      window.top.location.href = target;
    } else {
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = target;
    }
  }

  return (
    <a
      href="/dashboard"
      onClick={handleClick}
      className="mb-6 flex"
    >
      <BrandMark branding={branding} size="lg" />
    </a>
  );
}
