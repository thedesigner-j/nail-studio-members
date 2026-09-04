import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { createCalendarEvent } from "@/lib/google/calendar";

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ received: true });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const appointmentId = session.metadata?.appointmentId;
  if (!appointmentId) return NextResponse.json({ received: true });

  const serviceRole = createServiceRoleClient();

  const { data: appointment } = await serviceRole
    .from("appointments")
    .select("*, services(name)")
    .eq("id", appointmentId)
    .single();

  // Idempotent: Stripe can and does redeliver webhook events.
  if (!appointment || appointment.deposit_status === "paid") {
    return NextResponse.json({ received: true });
  }

  const paymentIntentId =
    typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;

  await serviceRole
    .from("appointments")
    .update({
      status: "confirmed",
      deposit_status: "paid",
      stripe_payment_intent_id: paymentIntentId ?? null,
    })
    .eq("id", appointmentId);

  await serviceRole.from("payments").insert({
    user_id: appointment.user_id,
    appointment_id: appointment.id,
    amount_cents: appointment.deposit_amount_cents,
    method: "card",
    status: "paid",
  });

  try {
    const eventId = await createCalendarEvent(
      serviceRole,
      appointment.user_id,
      { starts_at: appointment.starts_at, ends_at: appointment.ends_at, notes: appointment.notes },
      appointment.services?.name ?? "Appointment",
    );
    if (eventId) {
      await serviceRole.from("appointments").update({ google_calendar_event_id: eventId }).eq("id", appointment.id);
    }
  } catch {
    // Calendar sync is best-effort; the booking itself already succeeded.
  }

  return NextResponse.json({ received: true });
}
