"use server";

import { redirect } from "next/navigation";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";

export async function signIn(_prevState: { error: string } | null, formData: FormData) {
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get("email")),
    password: String(formData.get("password")),
  });

  if (error) {
    return { error: error.message };
  }

  redirect(String(formData.get("next") || "/dashboard"));
}

export async function signUp(_prevState: { error: string } | null, formData: FormData) {
  const supabase = await createClient();
  const fullName = String(formData.get("fullName"));
  const email = String(formData.get("email"));
  const referralToken = String(formData.get("referralToken") || "").trim();

  const { data, error } = await supabase.auth.signUp({
    email,
    password: String(formData.get("password")),
    options: {
      data: { full_name: fullName },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
    },
  });

  if (error) {
    return { error: error.message };
  }

  if (data.user) {
    const serviceRole = createServiceRoleClient();

    // Every new account gets its account-creation credit, referral or not.
    await serviceRole.rpc("award_account_creation_credit", { p_user_id: data.user.id });

    if (referralToken) {
      await serviceRole.rpc("claim_referral", {
        p_token: referralToken,
        p_new_user_id: data.user.id,
      });
    }
  }

  redirect("/login?confirmEmail=1");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
