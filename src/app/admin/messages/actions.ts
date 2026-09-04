"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "../require-admin";

export async function sendAdminMessage(_prevState: { error: string } | null, formData: FormData) {
  const admin = await requireAdmin();
  if (!admin) return { error: "You must be an admin to do that." };

  const userId = String(formData.get("userId") || "");
  const body = String(formData.get("body") || "").trim();
  if (!userId || !body) return { error: "Write a message first." };

  const supabase = await createClient();
  const { error } = await supabase.from("messages").insert({ user_id: userId, sender: "business", body });
  if (error) return { error: "Could not send that message." };

  revalidatePath(`/admin/messages/${userId}`);
  revalidatePath("/admin/messages");
  return null;
}

export async function markThreadRead(userId: string) {
  const admin = await requireAdmin();
  if (!admin) return;

  const supabase = await createClient();
  await supabase
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("sender", "member")
    .is("read_at", null);

  revalidatePath("/admin/messages");
}
