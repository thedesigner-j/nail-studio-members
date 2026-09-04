import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data";
import AdminNavLinks from "./nav-links";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!profile.is_admin) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="sticky top-0 z-20 border-b border-neutral-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/admin" className="flex shrink-0 items-center gap-1.5 font-semibold text-neutral-900">
            <span aria-hidden>✦</span> Studio Admin
          </Link>

          <AdminNavLinks />

          <Link href="/dashboard" className="shrink-0 text-sm text-neutral-400 hover:text-neutral-700">
            Exit admin
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">{children}</main>
    </div>
  );
}
