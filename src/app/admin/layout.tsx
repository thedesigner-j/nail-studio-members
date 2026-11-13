import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data";
import { getWaitingForReviewCount } from "@/lib/skill-projects-data";
import { getBranding } from "@/lib/branding";
import BrandMark from "@/components/brand-mark";
import AdminNavLinks from "./nav-links";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!profile.is_admin) redirect("/dashboard");

  const [waitingForReview, branding] = await Promise.all([getWaitingForReviewCount(), getBranding()]);

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="sticky top-0 z-20 border-b border-neutral-200 bg-white/90 backdrop-blur">
        {/* Phones: brand and Exit on one row, the menu on its own row below.
            Wider screens: all three on one row, as before. */}
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
          <Link href="/admin" className="flex min-w-0 items-center gap-2">
            <BrandMark branding={branding} />
            <span className="badge shrink-0 bg-neutral-100 text-neutral-600">Admin</span>
          </Link>

          <div className="order-last -mx-4 w-[calc(100%+2rem)] md:order-none md:mx-0 md:w-auto md:min-w-0 md:flex-1">
            <AdminNavLinks waitingForReview={waitingForReview} />
          </div>

          <Link
            href="/dashboard"
            className="shrink-0 text-sm text-neutral-400 hover:text-neutral-700 md:order-last"
          >
            Exit admin
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">{children}</main>
    </div>
  );
}
