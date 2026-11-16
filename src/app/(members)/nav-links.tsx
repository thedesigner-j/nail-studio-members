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

export default function NavLinks({
  hasNewEarlyAccess,
  hasUnreadMessages,
  isTech,
  isAdmin,
  hasProjectUpdates,
}: {
  hasNewEarlyAccess: boolean;
  hasUnreadMessages: boolean;
  isTech: boolean;
  isAdmin: boolean;
  hasProjectUpdates: boolean;
}) {
  const pathname = usePathname();
  const items = [
    ...NAV_ITEMS,
    ...(isTech ? [{ href: "/my-projects", label: "My Projects" }] : []),
    ...(isTech || isAdmin ? [{ href: "/trace", label: "Trace" }] : []),
  ];

  return (
    <nav className="flex flex-wrap gap-1">
      {items.map((item) => {
        const active = pathname.startsWith(item.href);
        const showDot =
          (item.href === "/early-access" && hasNewEarlyAccess) ||
          (item.href === "/messages" && hasUnreadMessages) ||
          (item.href === "/my-projects" && hasProjectUpdates);
        return (
          <Link key={item.href} href={item.href} className={`relative ${active ? "nav-pill-active" : "nav-pill"}`}>
            {item.label}
            {showDot && (
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
