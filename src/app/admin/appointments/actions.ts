"use server";

import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { requireAdmin } from "../require-admin";

export async function markAppointmentPaidAndCompleted(
  _prevState: { error: string } | null,
  formData: FormData,
): Promise<{ error: string }> {
  const admin = await requireAdmin();
  if (!admin) return { error: "You must be an admin to do that." };

  const appointmentId = String(formData.get("appointmentId"));
  const amountDollars = Number(formData.get("amountDollars"));
  const method = String(formData.get("method") || "in_person");

  if (!Number.isFinite(amountDollars) || amountDollars < 0) {
    return { error: "Amount must be a non-negative number." };
  }

  const serviceRole = createServiceRoleClient();

  const { data: appointment } = await serviceRole
    .from("appointments")
    .select("id, user_id, status")
    .eq("id", appointmentId)
    .single();

  if (!appointment || appointment.status !== "confirmed") {
    return { error: "That appointment isn't in a confirmed state anymore." };
  }

  const { error: paymentError } = await serviceRole.from("payments").insert({
    user_id: appointment.user_id,
    appointment_id: appointment.id,
    amount_cents: Math.round(amountDollars * 100),
    method,
    status: "paid",
  });
  if (paymentError) return { error: "Could not record that payment." };

  const { error: statusError } = await serviceRole
    .from("appointments")
    .update({ status: "completed" })
    .eq("id", appointment.id);
  if (statusError) return { error: "Could not mark that appointment completed." };

  await serviceRole.rpc("award_session_credit", { p_appointment_id: appointment.id });
  await serviceRole.rpc("confirm_referral", { p_referred_user_id: appointment.user_id });

  revalidatePath("/admin/appointments");
  revalidatePath("/appointments");
  revalidatePath("/loyalty");
  revalidatePath("/admin/loyalty");
  return { error: "" };
}

export async function markAppointmentNoShow(appointmentId: string) {
  const admin = await requireAdmin();
  if (!admin) return;

  const serviceRole = createServiceRoleClient();
  const { data: appointment } = await serviceRole
    .from("appointments")
    .select("deposit_status")
    .eq("id", appointmentId)
    .single();

  await serviceRole
    .from("appointments")
    .update({
      status: "no_show",
      deposit_status: appointment?.deposit_status === "paid" ? "forfeited" : appointment?.deposit_status,
    })
    .eq("id", appointmentId);

  revalidatePath("/admin/appointments");
  revalidatePath("/appointments");
}
