"use server";

import { revalidatePath } from "next/cache";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";

// No SMS provider — the member sends the text themselves (via whatever app
// they prefer), so this just generates the link and a ready-to-paste
// message for the client to put on the clipboard.
export async function createReferralInvite(): Promise<
  { error: string; link?: undefined; message?: undefined } | { error: null; link: string; message: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const serviceRole = createServiceRoleClient();
  const { data: token, error } = await serviceRole.rpc("create_referral_link", {
    p_referrer_id: user.id,
    p_phone: null,
  });

  if (error || !token) return { error: "Could not create a referral link." };

  const { data: settings } = await supabase.from("reward_settings").select("account_creation_credit").single();
  const credit = settings ? `$${Number(settings.account_creation_credit).toFixed(0)}` : "a credit";

  const link = `${process.env.NEXT_PUBLIC_SITE_URL}/join-${token}`;
  const message = `Nail Studio — your friend wants you to try us! Book your first visit and get ${credit} off: ${link}`;

  revalidatePath("/loyalty");
  return { error: null, link, message };
}

export async function submitReview(
  _prevState: { error: string; resetToken?: string } | null,
  formData: FormData,
): Promise<{ error: string; resetToken?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const platformId = String(formData.get("platformId") || "");
  const proofLink = String(formData.get("proofLink") || "").trim();
  const proofUrl = String(formData.get("proofUrl") || "").trim();

  if (!platformId) return { error: "Choose a platform." };
  if (!proofLink && !proofUrl) return { error: "Add a link to your review or upload a screenshot." };

  const { error } = await supabase.from("review_submissions").insert({
    user_id: user.id,
    platform_id: platformId,
    proof_link: proofLink || null,
    proof_url: proofUrl || null,
    status: "pending",
  });

  if (error) {
    return {
      error: error.code === "23505" ? "You already have a submission for this platform." : "Could not submit that review.",
    };
  }

  revalidatePath("/loyalty");
  return { error: "", resetToken: crypto.randomUUID() };
}

export async function submitRepost(
  _prevState: { error: string } | null,
  formData: FormData,
): Promise<{ error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const announcementId = String(formData.get("announcementId") || "");
  if (!announcementId) return { error: "Choose a post." };

  const { error } = await supabase.from("repost_submissions").insert({
    user_id: user.id,
    announcement_id: announcementId,
    status: "pending",
  });

  if (error) {
    return {
      error: error.code === "23505" ? "You already claimed credit for this post." : "Could not submit that.",
    };
  }

  revalidatePath("/loyalty");
  return { error: "" };
}
