"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/early-access", label: "Early Access" },
  { href: "/book", label: "Book" },
  { href: "/appointments", label: "Appointments" },
  { href: "/loyalty", label: "Loyalty" },
  { href: "/look-book", label: "Look Book" },
  { href: "/messages", label: "Messages" },
];

export default function NavLinks({ hasNewEarlyAccess }: { hasNewEarlyAccess: boolean }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-1">
      {NAV_ITEMS.map((item) => {
        const active = pathname.startsWith(item.href);
        return (
          <Link key={item.href} href={item.href} className={`relative ${active ? "nav-pill-active" : "nav-pill"}`}>
            {item.label}
            {item.href === "/early-access" && hasNewEarlyAccess && (
              <span
                aria-label="New"
                className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-rose-500"
              />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
