"use server";

import { revalidatePath } from "next/cache";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { deleteCalendarEvent } from "@/lib/google/calendar";
import { getStripe } from "@/lib/stripe";

export async function cancelAppointment(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const appointmentId = String(formData.get("appointmentId"));

  const { data: appointment } = await supabase
    .from("appointments")
    .select("id, user_id, google_calendar_event_id, starts_at, deposit_status, stripe_payment_intent_id")
    .eq("id", appointmentId)
    .eq("user_id", user.id)
    .single();

  if (!appointment) return;

  const serviceRole = createServiceRoleClient();
  let nextDepositStatus = appointment.deposit_status;

  if (appointment.deposit_status === "paid") {
    const { data: bookingSettings } = await supabase
      .from("booking_settings")
      .select("cancellation_refund_hours")
      .single();
    const refundWindowHours = bookingSettings?.cancellation_refund_hours ?? 24;
    const hoursUntilAppointment = (new Date(appointment.starts_at).getTime() - Date.now()) / 3_600_000;

    if (hoursUntilAppointment >= refundWindowHours && appointment.stripe_payment_intent_id) {
      try {
        await getStripe().refunds.create({ payment_intent: appointment.stripe_payment_intent_id });
        nextDepositStatus = "refunded";
        await serviceRole
          .from("payments")
          .update({ status: "refunded" })
          .eq("appointment_id", appointment.id)
          .eq("status", "paid");
      } catch {
        // Leave deposit_status as "paid" rather than claim a refund that
        // didn't actually go through — the business can issue it manually
        // in the Stripe dashboard if this keeps happening.
      }
    } else {
      // Cancelling within the refund window forfeits the deposit, same as
      // a no-show — the payment itself isn't touched, just this label.
      nextDepositStatus = "forfeited";
    }
  } else if (appointment.deposit_status === "pending") {
    // Cancelling a booking that never got past Stripe checkout (still
    // holding the slot, nothing ever charged) — nothing to refund or
    // forfeit, so just clear the deposit state rather than leave it
    // stuck at "pending" forever.
    nextDepositStatus = "none";
  }

  // Via service role: 'status' and the deposit fields aren't in the
  // member-facing column grants (see 0003_security_hardening.sql), by
  // design — this update is trusted server logic, not a client-direct write.
  await serviceRole
    .from("appointments")
    .update({ status: "cancelled", deposit_status: nextDepositStatus })
    .eq("id", appointmentId);

  if (appointment.google_calendar_event_id) {
    try {
      await deleteCalendarEvent(supabase, user.id, appointment.google_calendar_event_id);
    } catch {
      // The appointment is cancelled either way; a stray calendar event is
      // a minor inconvenience, not worth failing the cancellation over.
    }
  }

  revalidatePath("/appointments");
  revalidatePath("/dashboard");
}
