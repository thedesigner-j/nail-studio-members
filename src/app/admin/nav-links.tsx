"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/admin/clients", label: "Clients" },
  { href: "/admin/hours", label: "Working Hours" },
  { href: "/admin/services", label: "Services & Rates" },
  { href: "/admin/announcements", label: "Early Access" },
  { href: "/admin/appointments", label: "Appointments" },
  { href: "/admin/loyalty", label: "Loyalty" },
];

export default function AdminNavLinks() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-1">
      {NAV_ITEMS.map((item) => {
        const active = pathname.startsWith(item.href);
        return (
          <Link key={item.href} href={item.href} className={active ? "nav-pill-active" : "nav-pill"}>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
