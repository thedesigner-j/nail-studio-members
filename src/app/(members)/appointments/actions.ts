"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { createCalendarEvent, deleteCalendarEvent } from "@/lib/google/calendar";
import { getStripe } from "@/lib/stripe";
import { getAvailableSlots } from "@/lib/slots";
import {
  sendCancellationEmail,
  sendAdminCancellationNotice,
  sendRescheduleEmail,
  sendAdminRescheduleNotice,
  getAdminEmails,
} from "@/lib/notifications";

export async function cancelAppointment(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const appointmentId = String(formData.get("appointmentId"));

  const { data: appointment } = await supabase
    .from("appointments")
    .select("*, services(name), profiles(full_name)")
    .eq("id", appointmentId)
    .eq("user_id", user.id)
    .single();

  if (!appointment) return;

  const serviceRole = createServiceRoleClient();
  let nextDepositStatus = appointment.deposit_status;
  let refundedCents = 0;

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
        refundedCents = appointment.deposit_amount_cents;
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

  try {
    if (user.email) {
      await sendCancellationEmail({
        to: user.email,
        memberName: appointment.profiles?.full_name ?? null,
        serviceName: appointment.services?.name ?? "Appointment",
        startsAt: appointment.starts_at,
        cancelledByStudio: false,
        refundedCents,
      });
    }

    await sendAdminCancellationNotice({
      to: await getAdminEmails(serviceRole),
      memberName: appointment.profiles?.full_name ?? null,
      serviceName: appointment.services?.name ?? "Appointment",
      startsAt: appointment.starts_at,
    });
  } catch {
    // Email is best-effort; the cancellation itself already succeeded.
  }

  revalidatePath("/appointments");
  revalidatePath("/dashboard");
}

export async function rescheduleAppointment(_prevState: { error: string } | null, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const appointmentId = String(formData.get("appointmentId"));
  const newStartsAt = String(formData.get("startsAt") || "");
  if (!newStartsAt) return { error: "Pick a new time." };

  const { data: appointment } = await supabase
    .from("appointments")
    .select("*, services(name, duration_minutes), profiles(full_name)")
    .eq("id", appointmentId)
    .eq("user_id", user.id)
    .single();

  if (!appointment) return { error: "That appointment could not be found." };
  if (appointment.status !== "confirmed" && appointment.status !== "pending_payment") {
    return { error: "This appointment can no longer be rescheduled." };
  }

  const { data: bookingSettings } = await supabase
    .from("booking_settings")
    .select("cancellation_refund_hours")
    .single();
  const refundWindowHours = bookingSettings?.cancellation_refund_hours ?? 24;
  const hoursUntilCurrent = (new Date(appointment.starts_at).getTime() - Date.now()) / 3_600_000;

  // Same window as the cancellation forfeiture rule — otherwise "reschedule"
  // becomes a free way to keep pushing out a booking indefinitely right up
  // to the last minute with no consequence.
  if (hoursUntilCurrent < refundWindowHours) {
    return {
      error: `It's too close to your appointment to reschedule online (within ${refundWindowHours} hours). Please contact the studio directly.`,
    };
  }

  const freeSlots = await getAvailableSlots(appointment.service_id, newStartsAt.slice(0, 10), appointment.id);
  if (!freeSlots.includes(newStartsAt)) {
    return { error: "That time was just booked. Please pick another slot." };
  }

  const durationMinutes = appointment.services?.duration_minutes ?? 30;
  const newEndsAt = new Date(new Date(newStartsAt).getTime() + durationMinutes * 60_000).toISOString();

  // Via service role: 'starts_at'/'ends_at' aren't in the member-facing
  // column grants (see 0003_security_hardening.sql) — same reasoning as
  // cancelAppointment above, this is trusted server logic re-validating the
  // slot itself, not a client-direct write.
  const serviceRole = createServiceRoleClient();
  const { error } = await serviceRole
    .from("appointments")
    .update({ starts_at: newStartsAt, ends_at: newEndsAt })
    .eq("id", appointmentId);
  if (error) return { error: "Could not reschedule. Please try again." };

  if (appointment.google_calendar_event_id) {
    try {
      await deleteCalendarEvent(serviceRole, user.id, appointment.google_calendar_event_id);
    } catch {
      // Best-effort; the reschedule itself already succeeded.
    }
  }

  try {
    const eventId = await createCalendarEvent(
      serviceRole,
      user.id,
      { starts_at: newStartsAt, ends_at: newEndsAt, notes: appointment.notes },
      appointment.services?.name ?? "Appointment",
    );
    if (eventId) {
      await serviceRole.from("appointments").update({ google_calendar_event_id: eventId }).eq("id", appointmentId);
    }
  } catch {
    // Calendar sync is best-effort; the reschedule itself already succeeded.
  }

  try {
    if (user.email) {
      await sendRescheduleEmail({
        to: user.email,
        memberName: appointment.profiles?.full_name ?? null,
        serviceName: appointment.services?.name ?? "Appointment",
        previousStartsAt: appointment.starts_at,
        newStartsAt,
      });
    }

    await sendAdminRescheduleNotice({
      to: await getAdminEmails(serviceRole),
      memberName: appointment.profiles?.full_name ?? null,
      serviceName: appointment.services?.name ?? "Appointment",
      previousStartsAt: appointment.starts_at,
      newStartsAt,
    });
  } catch {
    // Email is best-effort; the reschedule itself already succeeded.
  }

  revalidatePath("/appointments");
  revalidatePath("/dashboard");
  redirect("/appointments?rescheduled=1");
}
