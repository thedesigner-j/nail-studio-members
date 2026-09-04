"use server";

import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { requireAdmin } from "../require-admin";

export async function updateBookingSettings(
  _prevState: { error: string } | null,
  formData: FormData,
): Promise<{ error: string }> {
  const admin = await requireAdmin();
  if (!admin) return { error: "You must be an admin to do that." };

  const depositPercent = Number(formData.get("depositPercent"));
  const cancellationRefundHours = Number(formData.get("cancellationRefundHours"));

  if (!Number.isFinite(depositPercent) || depositPercent < 0 || depositPercent > 100) {
    return { error: "Deposit percent must be between 0 and 100." };
  }
  if (!Number.isFinite(cancellationRefundHours) || cancellationRefundHours < 0) {
    return { error: "Cancellation window must be a non-negative number of hours." };
  }

  const serviceRole = createServiceRoleClient();
  const { error } = await serviceRole
    .from("booking_settings")
    .update({
      deposit_percent: depositPercent,
      cancellation_refund_hours: Math.round(cancellationRefundHours),
    })
    .eq("id", true);

  if (error) return { error: "Could not save settings." };

  revalidatePath("/admin/booking");
  return { error: "" };
}
