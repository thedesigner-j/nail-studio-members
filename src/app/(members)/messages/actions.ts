"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function sendMessage(_prevState: { error: string } | null, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const body = String(formData.get("body") || "").trim();
  if (!body) return { error: "Write a message first." };

  const { error } = await supabase
    .from("messages")
    .insert({ user_id: user.id, sender: "member", body });

  if (error) return { error: "Could not send that message." };

  revalidatePath("/messages");
  return null;
}

// Called directly during the messages page's render (not from a form/click),
// so it can't call revalidatePath itself — that's only valid from an actual
// Server Action invocation. The nav badge re-checks fresh on next navigation
// anyway since it's read in a dynamic, cookie-based layout.
export async function markMessagesRead(userId: string) {
  const supabase = await createClient();
  await supabase
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("sender", "business")
    .is("read_at", null);
}
