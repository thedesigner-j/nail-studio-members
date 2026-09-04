"use server";

import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { requireAdmin } from "../require-admin";

// === Settings ==================================================================

export async function updateRewardSettings(
  _prevState: { error: string } | null,
  formData: FormData,
): Promise<{ error: string }> {
  const admin = await requireAdmin();
  if (!admin) return { error: "You must be an admin to do that." };

  const fields = {
    session_credit_percent: Number(formData.get("sessionCreditPercent")),
    account_creation_credit: Number(formData.get("accountCreationCredit")),
    referral_credit: Number(formData.get("referralCredit")),
    repost_credit: Number(formData.get("repostCredit")),
    review_credit: Number(formData.get("reviewCredit")),
    credit_expiration_days: Number(formData.get("creditExpirationDays")),
    referral_link_expiration_days: Number(formData.get("referralLinkExpirationDays")),
  };

  if (Object.values(fields).some((v) => !Number.isFinite(v) || v < 0)) {
    return { error: "All settings must be non-negative numbers." };
  }

  const serviceRole = createServiceRoleClient();
  const { error } = await serviceRole.from("reward_settings").update(fields).eq("id", true);
  if (error) return { error: "Could not save settings." };

  revalidatePath("/admin/loyalty");
  return { error: "" };
}

// === Shareable posts ============================================================

export async function setPostShareable(
  announcementId: string,
  isShareable: boolean,
  startsAt: string | null,
  endsAt: string | null,
) {
  const admin = await requireAdmin();
  if (!admin) return;

  const serviceRole = createServiceRoleClient();
  await serviceRole
    .from("announcements")
    .update({
      is_shareable: isShareable,
      shareable_starts_at: startsAt,
      shareable_ends_at: endsAt,
    })
    .eq("id", announcementId);

  revalidatePath("/admin/loyalty");
  revalidatePath("/loyalty");
}

// === Review platforms ===========================================================

export async function createReviewPlatform(
  _prevState: { error: string } | null,
  formData: FormData,
): Promise<{ error: string }> {
  const admin = await requireAdmin();
  if (!admin) return { error: "You must be an admin to do that." };

  const name = String(formData.get("name") || "").trim();
  if (!name) return { error: "Name is required." };

  const serviceRole = createServiceRoleClient();
  const { error } = await serviceRole.from("review_platforms").insert({ name, is_active: true });
  if (error) return { error: "Could not add that platform." };

  revalidatePath("/admin/loyalty");
  revalidatePath("/loyalty");
  return { error: "" };
}

export async function setReviewPlatformActive(id: string, isActive: boolean) {
  const admin = await requireAdmin();
  if (!admin) return;

  const serviceRole = createServiceRoleClient();
  await serviceRole.from("review_platforms").update({ is_active: isActive }).eq("id", id);

  revalidatePath("/admin/loyalty");
  revalidatePath("/loyalty");
}

// === Approval queue ==============================================================

export async function approveRepostSubmission(submissionId: string) {
  const admin = await requireAdmin();
  if (!admin) return;

  const serviceRole = createServiceRoleClient();
  await serviceRole.rpc("approve_repost", { p_submission_id: submissionId, p_admin_id: admin.id });

  revalidatePath("/admin/loyalty");
}

export async function rejectRepostSubmission(submissionId: string, reason: string) {
  const admin = await requireAdmin();
  if (!admin) return;

  const serviceRole = createServiceRoleClient();
  await serviceRole.rpc("reject_repost", {
    p_submission_id: submissionId,
    p_admin_id: admin.id,
    p_reason: reason || null,
  });

  revalidatePath("/admin/loyalty");
}

export async function approveReviewSubmission(submissionId: string) {
  const admin = await requireAdmin();
  if (!admin) return;

  const serviceRole = createServiceRoleClient();
  await serviceRole.rpc("approve_review", { p_submission_id: submissionId, p_admin_id: admin.id });

  revalidatePath("/admin/loyalty");
}

export async function rejectReviewSubmission(submissionId: string, reason: string) {
  const admin = await requireAdmin();
  if (!admin) return;

  const serviceRole = createServiceRoleClient();
  await serviceRole.rpc("reject_review", {
    p_submission_id: submissionId,
    p_admin_id: admin.id,
    p_reason: reason || null,
  });

  revalidatePath("/admin/loyalty");
}

export async function getSignedReviewProofUrl(path: string): Promise<string | null> {
  const admin = await requireAdmin();
  if (!admin) return null;

  const serviceRole = createServiceRoleClient();
  const { data } = await serviceRole.storage.from("review-proofs").createSignedUrl(path, 300);
  return data?.signedUrl ?? null;
}

// === Manual ledger adjustments ====================================================

export async function issueManualCredit(
  _prevState: { error: string } | null,
  formData: FormData,
): Promise<{ error: string }> {
  const admin = await requireAdmin();
  if (!admin) return { error: "You must be an admin to do that." };

  const userId = String(formData.get("userId") || "").trim();
  const amount = Number(formData.get("amount"));
  const reason = String(formData.get("reason") || "").trim();

  if (!userId) return { error: "Member id is required." };
  if (!Number.isFinite(amount) || amount <= 0) return { error: "Amount must be a positive number." };
  if (!reason) return { error: "A reason is required." };

  const serviceRole = createServiceRoleClient();
  const { error } = await serviceRole.rpc("admin_issue_credit", {
    p_admin_id: admin.id,
    p_user_id: userId,
    p_amount: amount,
    p_reason: reason,
  });

  if (error) return { error: "Could not issue that credit." };

  revalidatePath("/admin/loyalty");
  return { error: "" };
}

export async function revokeCredit(formData: FormData) {
  const admin = await requireAdmin();
  if (!admin) return;

  const creditId = String(formData.get("creditId"));
  const reason = String(formData.get("reason") || "");

  const serviceRole = createServiceRoleClient();
  await serviceRole.rpc("admin_revoke_credit", {
    p_admin_id: admin.id,
    p_credit_id: creditId,
    p_reason: reason,
  });

  revalidatePath("/admin/loyalty");
}
