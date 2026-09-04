"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { getAvailableSlots } from "@/lib/slots";
import { createCalendarEvent } from "@/lib/google/calendar";

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

  const endsAt = new Date(
    new Date(startsAt).getTime() + service.duration_minutes * 60_000,
  ).toISOString();

  // Booked at full price first, then patched down below if credit is
  // applied — redeem_credit_balance needs a real appointment id to log
  // against, and the actual amount it can apply may be less than what was
  // requested if the member's balance changed since the page loaded.
  const { data: appointment, error } = await supabase
    .from("appointments")
    .insert({
      user_id: user.id,
      service_id: serviceId,
      starts_at: startsAt,
      ends_at: endsAt,
      price_cents: service.price_cents,
      notes,
    })
    .select()
    .single();

  if (error || !appointment) {
    return { error: "Could not book that appointment. Please try again." };
  }

  const serviceRole = createServiceRoleClient();

  if (requestedCredit > 0) {
    const { data: appliedAmount } = await serviceRole.rpc("redeem_credit_balance", {
      p_user_id: user.id,
      p_amount: Math.min(requestedCredit, service.price_cents / 100),
      p_appointment_id: appointment.id,
    });

    if (appliedAmount && appliedAmount > 0) {
      const newPriceCents = Math.max(0, service.price_cents - Math.round(appliedAmount * 100));
      await serviceRole.from("appointments").update({ price_cents: newPriceCents }).eq("id", appointment.id);
    }
  }

  try {
    const eventId = await createCalendarEvent(
      user.id,
      { starts_at: startsAt, ends_at: endsAt, notes },
      service.name,
    );
    if (eventId) {
      await supabase
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
