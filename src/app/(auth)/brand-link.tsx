"use client";

export default function BrandLink() {
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
      className="mb-6 flex items-center gap-1.5 font-semibold text-neutral-900"
    >
      <span aria-hidden>✦</span> Nail Studio
    </a>
  );
}
