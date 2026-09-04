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
