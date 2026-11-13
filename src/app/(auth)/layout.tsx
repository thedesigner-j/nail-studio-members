import { connection } from "next/server";
import { getBranding } from "@/lib/branding";
import BrandLink from "./brand-link";
import RedirectIfAuthenticated from "./redirect-if-authenticated";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  // Render per request so a branding change shows up right away, rather than
  // only after the next deploy for pages that would otherwise be static.
  await connection();
  const branding = await getBranding();

  return (
    <div className="gradient-hero flex min-h-screen items-center justify-center px-4 py-10">
      <RedirectIfAuthenticated />
      <div className="w-full max-w-sm rounded-3xl border border-neutral-200 bg-white p-8 shadow-lg shadow-neutral-900/5">
        <BrandLink branding={branding} />
        {children}
      </div>
    </div>
  );
}
