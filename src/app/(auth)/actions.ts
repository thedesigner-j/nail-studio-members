"use server";

import { redirect } from "next/navigation";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";

export async function signIn(
  _prevState: { error: string; next?: string } | null,
  formData: FormData,
): Promise<{ error: string; next?: string }> {
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get("email")),
    password: String(formData.get("password")),
  });

  if (error) {
    return { error: error.message };
  }

  // No server-side redirect() here: when this form is loaded inside the
  // Webflow embed's iframe, we want the *browser tab* to navigate to the
  // full app, not the iframe to expand to hold it. That has to happen
  // client-side (checking window.top), so the action just reports success
  // and the form component decides where/how to navigate.
  return { error: "", next: String(formData.get("next") || "/dashboard") };
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

export async function requestPasswordReset(
  _prevState: { error: string; sent?: boolean } | null,
  formData: FormData,
): Promise<{ error: string; sent?: boolean }> {
  const supabase = await createClient();
  const email = String(formData.get("email") || "").trim();
  if (!email) return { error: "Enter your email." };

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=/reset-password`,
  });

  // Always report success, even if the email doesn't match an account —
  // otherwise this becomes a way to check which emails are registered.
  if (error) console.error("resetPasswordForEmail failed:", error.message);
  return { error: "", sent: true };
}

export async function updatePassword(
  _prevState: { error: string } | null,
  formData: FormData,
): Promise<{ error: string }> {
  const supabase = await createClient();
  const password = String(formData.get("password") || "");
  const confirmPassword = String(formData.get("confirmPassword") || "");

  if (password.length < 6) return { error: "Password must be at least 6 characters." };
  if (password !== confirmPassword) return { error: "Passwords don't match." };

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };

  redirect("/dashboard");
}
