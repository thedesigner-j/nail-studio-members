"use server";

import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { requireAdmin } from "../require-admin";

type FormState = { error: string; saved?: boolean } | null;

export async function updateBranding(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  if (!admin) return { error: "You must be an admin to do that." };

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Enter the studio's name." };
  if (name.length > 60) return { error: "Keep the name to 60 characters or fewer." };

  // Only logos uploaded to this project's branding bucket.
  const logoUrl = String(formData.get("logoUrl") ?? "").trim() || null;
  const bucketPrefix = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/branding/`;
  if (logoUrl && !logoUrl.startsWith(bucketPrefix)) return { error: "Upload the logo again." };

  const showNameWithLogo = formData.get("showNameWithLogo") === "on";

  const { error } = await createServiceRoleClient()
    .from("branding")
    .upsert({
      id: true,
      business_name: name,
      logo_url: logoUrl,
      show_name_with_logo: showNameWithLogo,
      updated_at: new Date().toISOString(),
    });
  if (error) {
    return {
      error: error.message.includes("branding")
        ? "Branding isn't set up in the database yet. Run the 0018_branding.sql update in Supabase first."
        : "Could not save. Please try again.",
    };
  }

  // The name and logo appear on nearly every page.
  revalidatePath("/", "layout");
  return { error: "", saved: true };
}
