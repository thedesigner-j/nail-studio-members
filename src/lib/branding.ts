import { cache } from "react";
import { createServiceRoleClient } from "@/lib/supabase/server";

export type Branding = {
  name: string;
  logoUrl: string | null;
  showNameWithLogo: boolean;
};

export const DEFAULT_BRANDING: Branding = { name: "Nail Studio", logoUrl: null, showNameWithLogo: true };

// The studio's name and logo, set in Admin > Branding. Read with the service
// role because signed-out pages (login, the Webflow embed) need it too.
// Falls back to the defaults if the table isn't there yet (migration 0018
// not run) so the app keeps working either way. cache() dedupes the read
// within one request (layout + metadata + page).
export const getBranding = cache(async (): Promise<Branding> => {
  try {
    const { data, error } = await createServiceRoleClient()
      .from("branding")
      .select("business_name, logo_url, show_name_with_logo")
      .maybeSingle();
    if (error || !data) return DEFAULT_BRANDING;

    return {
      name: data.business_name?.trim() || DEFAULT_BRANDING.name,
      logoUrl: data.logo_url || null,
      showNameWithLogo: data.show_name_with_logo ?? true,
    };
  } catch {
    return DEFAULT_BRANDING;
  }
});
