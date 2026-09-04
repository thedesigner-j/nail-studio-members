"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function markEarlyAccessSeen() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("profiles")
    .update({ early_access_seen_at: new Date().toISOString() })
    .eq("id", user.id);

  revalidatePath("/early-access");
}
