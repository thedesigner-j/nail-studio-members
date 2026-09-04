"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { getAvailableSlots } from "@/lib/slots";
import { createCalendarEvent } from "@/lib/google/calendar";
import { getStripe } from "@/lib/stripe";

export async function bookAppointment(_prevState: { error: string } | null, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in to book." };

  const serviceId = String(formData.get("serviceId"));
  const startsAt = String(formData.get("startsAt"));
  const notes = String(formData.get("notes") || "") || null;
  const requestedCredit = Math.max(0, Number(formData.get("creditToApply")) || 0);

  const { data: service } = await supabase
    .from("services")
    .select("*")
    .eq("id", serviceId)
    .single();
  if (!service) return { error: "That service is no longer available." };

  const freeSlots = await getAvailableSlots(serviceId, startsAt.slice(0, 10));
  if (!freeSlots.includes(startsAt)) {
    return { error: "That time was just booked. Please pick another slot." };
  }

  const { data: bookingSettings } = await supabase
    .from("booking_settings")
    .select("deposit_percent")
    .single();
  const depositPercent = bookingSettings?.deposit_percent ?? 20;
  const depositCents = Math.round(service.price_cents * (depositPercent / 100));

  const endsAt = new Date(
    new Date(startsAt).getTime() + service.duration_minutes * 60_000,
  ).toISOString();

  // Inserted via the service role, not the normal per-user client: 'status'
  // and the deposit fields are deliberately NOT grantable to `authenticated`
  // (see 0003_security_hardening.sql's column-level grants), so a member
  // can't call the Supabase API directly and insert an appointment as
  // already 'confirmed'/deposit 'paid' without ever paying. user_id below
  // is the server-verified id from auth.getUser(), not client input.
  const serviceRole = createServiceRoleClient();

  // Created as 'pending_payment' immediately, holding the slot, before any
  // money has actually changed hands — getAvailableSlots already treats
  // anything but 'cancelled' as busy, so this blocks the slot the same way
  // a confirmed appointment would. If the member abandons the Stripe
  // checkout, expire_stale_pending_appointments() (scheduled, see README)
  // cancels it after 30 minutes so the slot frees back up.
  const { data: appointment, error } = await serviceRole
    .from("appointments")
    .insert({
      user_id: user.id,
      service_id: serviceId,
      starts_at: startsAt,
      ends_at: endsAt,
      price_cents: service.price_cents,
      deposit_amount_cents: depositCents,
      deposit_status: depositCents > 0 ? "pending" : "none",
      status: "pending_payment",
      notes,
    })
    .select()
    .single();

  if (error || !appointment) {
    return { error: "Could not start that booking. Please try again." };
  }

  let remainingDepositCents = depositCents;

  // Credit can only reduce the deposit due today, not the full price — the
  // remaining balance is paid in person and isn't something this flow
  // controls.
  if (requestedCredit > 0 && depositCents > 0) {
    const { data: appliedAmount } = await serviceRole.rpc("redeem_credit_balance", {
      p_user_id: user.id,
      p_amount: Math.min(requestedCredit, depositCents / 100),
      p_appointment_id: appointment.id,
    });

    if (appliedAmount && appliedAmount > 0) {
      const appliedCents = Math.round(appliedAmount * 100);
      remainingDepositCents = Math.max(0, depositCents - appliedCents);

      await serviceRole
        .from("appointments")
        .update({
          price_cents: service.price_cents - appliedCents,
          deposit_amount_cents: remainingDepositCents,
        })
        .eq("id", appointment.id);
    }
  }

  if (remainingDepositCents <= 0) {
    // Credit covered the whole deposit (or none was required) — confirm
    // immediately, no Stripe checkout needed.
    await serviceRole
      .from("appointments")
      .update({ status: "confirmed", deposit_status: depositCents > 0 ? "paid" : "none" })
      .eq("id", appointment.id);

    try {
      const eventId = await createCalendarEvent(
        supabase,
        user.id,
        { starts_at: startsAt, ends_at: endsAt, notes },
        service.name,
      );
      if (eventId) {
        await serviceRole
          .from("appointments")
          .update({ google_calendar_event_id: eventId })
          .eq("id", appointment.id);
      }
    } catch {
      // Calendar sync is best-effort; the booking itself already succeeded.
    }

    revalidatePath("/dashboard");
    revalidatePath("/appointments");
    revalidatePath("/loyalty");
    redirect("/appointments?booked=1");
  }

  const checkoutSession = await getStripe().checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: { name: `Deposit — ${service.name}` },
          unit_amount: remainingDepositCents,
        },
        quantity: 1,
      },
    ],
    metadata: { appointmentId: appointment.id },
    success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/appointments?booked=1`,
    cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/book?depositCancelled=1`,
    customer_email: user.email ?? undefined,
  });

  if (!checkoutSession.url) {
    return { error: "Could not start the deposit payment. Please try again." };
  }

  redirect(checkoutSession.url);
}
