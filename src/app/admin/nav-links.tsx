"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/admin/clients", label: "Clients" },
  { href: "/admin/hours", label: "Working Hours" },
  { href: "/admin/services", label: "Services & Rates" },
  { href: "/admin/announcements", label: "Early Access" },
  { href: "/admin/calendar", label: "Calendar" },
  { href: "/admin/appointments", label: "Appointments" },
  { href: "/admin/skill-projects", label: "Skill Projects" },
  { href: "/admin/booking", label: "Booking" },
  { href: "/admin/messages", label: "Messages" },
  { href: "/admin/loyalty", label: "Loyalty" },
  { href: "/admin/branding", label: "Branding" },
];

// On phones this is one row you swipe sideways (wrapping it made the header
// taller than the screen); on wider screens it wraps as before.
export default function AdminNavLinks({ waitingForReview }: { waitingForReview: number }) {
  const pathname = usePathname();
  const activeRef = useRef<HTMLAnchorElement>(null);

  // Keep the current section in view in the sideways-scrolling row.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [pathname]);

  return (
    <nav className="flex gap-1 overflow-x-auto px-4 [scrollbar-width:none] md:flex-wrap md:overflow-visible md:px-0 [&::-webkit-scrollbar]:hidden">
      {NAV_ITEMS.map((item) => {
        const active = pathname.startsWith(item.href);
        const count = item.href === "/admin/skill-projects" ? waitingForReview : 0;
        return (
          <Link
            key={item.href}
            ref={active ? activeRef : undefined}
            href={item.href}
            className={`shrink-0 ${active ? "nav-pill-active" : "nav-pill"}`}
          >
            {item.label}
            {count > 0 && (
              <span
                aria-label={`${count} waiting for review`}
                className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 text-[11px] font-semibold text-white"
              >
                {count}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
