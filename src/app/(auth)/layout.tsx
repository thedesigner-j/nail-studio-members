import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="gradient-hero flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm rounded-3xl border border-neutral-200 bg-white p-8 shadow-lg shadow-neutral-900/5">
        <Link href="/dashboard" className="mb-6 flex items-center gap-1.5 font-semibold text-neutral-900">
          <span aria-hidden>✦</span> Nail Studio
        </Link>
        {children}
      </div>
    </div>
  );
}
