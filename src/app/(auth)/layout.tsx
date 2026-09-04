import BrandLink from "./brand-link";
import RedirectIfAuthenticated from "./redirect-if-authenticated";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="gradient-hero flex min-h-screen items-center justify-center px-4 py-10">
      <RedirectIfAuthenticated />
      <div className="w-full max-w-sm rounded-3xl border border-neutral-200 bg-white p-8 shadow-lg shadow-neutral-900/5">
        <BrandLink />
        {children}
      </div>
    </div>
  );
}
