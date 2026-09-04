"use server";

import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { requireAdmin } from "../require-admin";
import { deleteCalendarEvent } from "@/lib/google/calendar";
import { getStripe } from "@/lib/stripe";
import { sendCancellationEmail } from "@/lib/notifications";

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

  // Skip recording a $0 row — e.g. a member who paid in full at booking
  // already has a payment row from Stripe, and this step is just marking
  // the visit complete for them, not charging anything further.
  if (amountDollars > 0) {
    const { error: paymentError } = await serviceRole.from("payments").insert({
      user_id: appointment.user_id,
      appointment_id: appointment.id,
      amount_cents: Math.round(amountDollars * 100),
      method,
      status: "paid",
    });
    if (paymentError) return { error: "Could not record that payment." };
  }

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

export async function cancelAppointmentAsAdmin(appointmentId: string) {
  const admin = await requireAdmin();
  if (!admin) return;

  const serviceRole = createServiceRoleClient();

  const { data: appointment } = await serviceRole
    .from("appointments")
    .select("*, services(name), profiles(full_name)")
    .eq("id", appointmentId)
    .single();

  if (!appointment) return;

  let nextDepositStatus = appointment.deposit_status;
  let refundedCents = 0;

  // Unlike a member cancelling, the studio initiating this isn't the
  // client's fault — always attempt a refund if money was actually charged,
  // regardless of the cancellation_refund_hours window that only applies to
  // client-initiated cancellations.
  if (appointment.deposit_status === "paid" && appointment.stripe_payment_intent_id) {
    try {
      await getStripe().refunds.create({ payment_intent: appointment.stripe_payment_intent_id });
      nextDepositStatus = "refunded";
      refundedCents = appointment.deposit_amount_cents;
      await serviceRole
        .from("payments")
        .update({ status: "refunded" })
        .eq("appointment_id", appointment.id)
        .eq("status", "paid");
    } catch {
      // Leave deposit_status as "paid" rather than claim a refund that
      // didn't actually go through.
    }
  } else if (appointment.deposit_status === "paid" || appointment.deposit_status === "pending") {
    // "paid" with no Stripe payment intent means credit covered it entirely
    // — nothing to refund through Stripe. "pending" never got charged.
    nextDepositStatus = "none";
  }

  await serviceRole
    .from("appointments")
    .update({ status: "cancelled", deposit_status: nextDepositStatus })
    .eq("id", appointmentId);

  if (appointment.google_calendar_event_id) {
    try {
      await deleteCalendarEvent(serviceRole, appointment.user_id, appointment.google_calendar_event_id);
    } catch {
      // The appointment is cancelled either way; a stray calendar event is
      // a minor inconvenience, not worth failing the cancellation over.
    }
  }

  try {
    const { data: userData } = await serviceRole.auth.admin.getUserById(appointment.user_id);
    if (userData?.user?.email) {
      await sendCancellationEmail({
        to: userData.user.email,
        memberName: appointment.profiles?.full_name ?? null,
        serviceName: appointment.services?.name ?? "Appointment",
        startsAt: appointment.starts_at,
        cancelledByStudio: true,
        refundedCents,
      });
    }
  } catch {
    // Email is best-effort; the cancellation itself already succeeded.
  }

  revalidatePath("/admin/appointments");
  revalidatePath("/appointments");
}
