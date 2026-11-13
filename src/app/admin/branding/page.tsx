import { getBranding } from "@/lib/branding";
import BrandingForm from "./branding-form";

export default async function AdminBrandingPage() {
  const branding = await getBranding();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Branding</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Your studio&apos;s name and logo, shown across the app and on the login screen.
        </p>
      </div>

      <BrandingForm initial={branding} />
    </div>
  );
}
