"use client";

import { useState, type ComponentType } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  HomeIcon,
  CalendarIcon,
  ListIcon,
  StarIcon,
  MoreIcon,
  SparkleIcon,
  ImageIcon,
  ChatIcon,
  UserIcon,
  GridIcon,
  LogoutIcon,
} from "./icons";

type IconComponent = ComponentType<{ className?: string }>;

const PRIMARY_TABS: { href: string; label: string; icon: IconComponent }[] = [
  { href: "/dashboard", label: "Home", icon: HomeIcon },
  { href: "/book", label: "Book", icon: CalendarIcon },
  { href: "/appointments", label: "Visits", icon: ListIcon },
  { href: "/loyalty", label: "Loyalty", icon: StarIcon },
];

const MORE_ROUTES = ["/early-access", "/look-book", "/messages", "/profile", "/admin"];

export default function BottomNav({
  hasNewEarlyAccess,
  hasUnreadMessages,
  isAdmin,
  signOutAction,
}: {
  hasNewEarlyAccess: boolean;
  hasUnreadMessages: boolean;
  isAdmin: boolean;
  signOutAction: () => void | Promise<void>;
}) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  const moreHasBadge = hasNewEarlyAccess || hasUnreadMessages;
  const moreActive = MORE_ROUTES.some((route) => pathname.startsWith(route));

  return (
    <>
      {moreOpen && (
        <button
          type="button"
          aria-label="Close menu"
          onClick={() => setMoreOpen(false)}
          className="fixed inset-0 z-30 bg-neutral-900/30 md:hidden"
        />
      )}

      {moreOpen && (
        <div className="fixed inset-x-0 bottom-16 z-40 rounded-t-2xl border-t border-neutral-200 bg-white pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_rgba(0,0,0,0.08)] md:hidden">
          <ul className="divide-y divide-neutral-100 px-2 py-2">
            <MoreItem
              href="/early-access"
              label="Early Access"
              icon={SparkleIcon}
              badge={hasNewEarlyAccess}
              onNavigate={() => setMoreOpen(false)}
            />
            <MoreItem href="/look-book" label="Look Book" icon={ImageIcon} onNavigate={() => setMoreOpen(false)} />
            <MoreItem
              href="/messages"
              label="Messages"
              icon={ChatIcon}
              badge={hasUnreadMessages}
              onNavigate={() => setMoreOpen(false)}
            />
            <MoreItem href="/profile" label="Profile" icon={UserIcon} onNavigate={() => setMoreOpen(false)} />
            {isAdmin && <MoreItem href="/admin" label="Admin" icon={GridIcon} onNavigate={() => setMoreOpen(false)} />}
          </ul>
          <form action={signOutAction} className="border-t border-neutral-100 px-4 py-3">
            <button type="submit" className="flex items-center gap-3 text-sm font-medium text-neutral-500">
              <LogoutIcon className="h-5 w-5" />
              Sign out
            </button>
          </form>
        </div>
      )}

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-neutral-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        <div className="grid grid-cols-5">
          {PRIMARY_TABS.map((tab) => {
            const active = !moreOpen && pathname.startsWith(tab.href);
            const Icon = tab.icon;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                onClick={() => setMoreOpen(false)}
                className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${
                  active ? "text-neutral-900" : "text-neutral-400"
                }`}
              >
                <Icon className="h-5 w-5" />
                {tab.label}
              </Link>
            );
          })}

          <button
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${
              moreOpen || moreActive ? "text-neutral-900" : "text-neutral-400"
            }`}
          >
            <span className="relative">
              <MoreIcon className="h-5 w-5" />
              {moreHasBadge && <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-rose-500" />}
            </span>
            More
          </button>
        </div>
      </nav>
    </>
  );
}

function MoreItem({
  href,
  label,
  icon: Icon,
  badge,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: IconComponent;
  badge?: boolean;
  onNavigate: () => void;
}) {
  return (
    <li>
      <Link
        href={href}
        onClick={onNavigate}
        className="flex items-center gap-3 px-3 py-3 text-sm font-medium text-neutral-900"
      >
        <Icon className="h-5 w-5 text-neutral-500" />
        {label}
        {badge && <span className="ml-auto h-2 w-2 rounded-full bg-rose-500" />}
      </Link>
    </li>
  );
}
