"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { getAvailableSlots } from "@/lib/slots";
import { createCalendarEvent } from "@/lib/google/calendar";
import { getStripe } from "@/lib/stripe";
import { sendBookingConfirmationEmail } from "@/lib/notifications";

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
  const payInFull = String(formData.get("paymentOption")) === "full";
  const referencePhotoUrl = String(formData.get("referencePhotoUrl") || "") || null;

  // Trusting the collection id straight from the form would let a member
  // tag someone else's private collection onto their own appointment —
  // verify it's actually theirs with the member's own RLS-scoped client
  // before it goes into a service-role insert.
  const referenceCollectionIdRaw = String(formData.get("referenceCollectionId") || "") || null;
  let referenceCollectionId: string | null = null;
  if (referenceCollectionIdRaw) {
    const { data: collection } = await supabase
      .from("collections")
      .select("id")
      .eq("id", referenceCollectionIdRaw)
      .eq("user_id", user.id)
      .maybeSingle();
    referenceCollectionId = collection?.id ?? null;
  }

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

  // "Pay in full" is just a deposit equal to the whole price — every other
  // code path (refund on cancel, forfeit on no-show, remaining-balance math
  // for the admin's "mark paid & completed" flow, session credit) already
  // works correctly off deposit_amount_cents vs price_cents without needing
  // to know which case it started from.
  const dueTodayBaseCents = payInFull
    ? service.price_cents
    : Math.round(service.price_cents * (depositPercent / 100));

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
      deposit_amount_cents: dueTodayBaseCents,
      deposit_status: dueTodayBaseCents > 0 ? "pending" : "none",
      status: "pending_payment",
      notes,
      reference_photo_url: referencePhotoUrl,
      reference_collection_id: referenceCollectionId,
    })
    .select()
    .single();

  if (error || !appointment) {
    return { error: "Could not start that booking. Please try again." };
  }

  let dueTodayCents = dueTodayBaseCents;
  let creditAppliedCents = 0;

  // Credit can only reduce what's due today, not any balance left for
  // later — capped at the full price when paying in full, or at just the
  // deposit fraction otherwise.
  if (requestedCredit > 0 && dueTodayBaseCents > 0) {
    const { data: appliedAmount } = await serviceRole.rpc("redeem_credit_balance", {
      p_user_id: user.id,
      p_amount: Math.min(requestedCredit, dueTodayBaseCents / 100),
      p_appointment_id: appointment.id,
    });

    if (appliedAmount && appliedAmount > 0) {
      creditAppliedCents = Math.round(appliedAmount * 100);
      dueTodayCents = Math.max(0, dueTodayBaseCents - creditAppliedCents);

      await serviceRole
        .from("appointments")
        .update({
          price_cents: service.price_cents - creditAppliedCents,
          deposit_amount_cents: dueTodayCents,
        })
        .eq("id", appointment.id);
    }
  }

  if (dueTodayCents <= 0) {
    // Credit covered everything due today (or nothing was required) —
    // confirm immediately, no Stripe checkout needed.
    await serviceRole
      .from("appointments")
      .update({ status: "confirmed", deposit_status: dueTodayBaseCents > 0 ? "paid" : "none" })
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

    if (user.email) {
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", user.id)
          .single();

        await sendBookingConfirmationEmail({
          to: user.email,
          memberName: profile?.full_name ?? null,
          serviceName: service.name,
          startsAt,
          paidTodayCents: 0,
          remainingCents: service.price_cents - creditAppliedCents,
        });
      } catch {
        // Email is best-effort; the booking itself already succeeded.
      }
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
          product_data: { name: `${payInFull ? "Payment" : "Deposit"} — ${service.name}` },
          unit_amount: dueTodayCents,
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
    return { error: "Could not start the payment. Please try again." };
  }

  redirect(checkoutSession.url);
}
