import { createClient } from "@/lib/supabase/server";

// Server actions aren't gated by the admin layout's redirect — a request
// can hit an action directly — so every admin action must re-check this
// itself before doing anything privileged.
export async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  return profile?.is_admin ? user : null;
}
