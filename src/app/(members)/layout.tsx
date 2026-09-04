import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { getCurrentProfile, getLatestAnnouncementAt, getUnreadMessageCount } from "@/lib/data";
import { signOut } from "../(auth)/actions";
import NavLinks from "./nav-links";

export default async function MembersLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const latestAnnouncementAt = await getLatestAnnouncementAt();
  const hasNewEarlyAccess = latestAnnouncementAt
    ? !profile.early_access_seen_at || new Date(latestAnnouncementAt) > new Date(profile.early_access_seen_at)
    : false;
  const hasUnreadMessages = (await getUnreadMessageCount(profile.id)) > 0;

  const initial = profile.full_name?.[0]?.toUpperCase() ?? "?";

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="sticky top-0 z-20 border-b border-neutral-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/dashboard" className="flex shrink-0 items-center gap-1.5 font-semibold text-neutral-900">
            <span aria-hidden>✦</span> Nail Studio
          </Link>

          <NavLinks hasNewEarlyAccess={hasNewEarlyAccess} hasUnreadMessages={hasUnreadMessages} />

          <div className="flex shrink-0 items-center gap-3">
            {profile.is_admin && (
              <Link href="/admin" className="text-sm font-medium text-neutral-600 hover:text-neutral-900">
                Admin
              </Link>
            )}
            <form action={signOut}>
              <button type="submit" className="text-sm text-neutral-400 hover:text-neutral-700">
                Sign out
              </button>
            </form>
            <Link
              href="/profile"
              className="relative block h-9 w-9 overflow-hidden rounded-full bg-neutral-900 text-sm font-medium text-white"
            >
              {profile.avatar_url ? (
                <Image src={profile.avatar_url} alt="" fill unoptimized className="object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center">{initial}</span>
              )}
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}
