// Supabase Edge Function, run on a schedule (see the pg_cron job in
// supabase/migrations/0004_reminder_schedule.sql). Finds appointments
// starting in roughly 24 hours that haven't been reminded yet, and POSTs
// each one to REMINDER_WEBHOOK_URL so it can be wired to Twilio, SendGrid,
// Zapier, or whatever the business uses to actually send the SMS/email.
import { createClient } from "jsr:@supabase/supabase-js@2";

const REMINDER_WINDOW_START_HOURS = 23;
const REMINDER_WINDOW_END_HOURS = 25;

Deno.serve(async (req) => {
  if (req.headers.get("Authorization") !== `Bearer ${Deno.env.get("CRON_SECRET")}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const webhookUrl = Deno.env.get("REMINDER_WEBHOOK_URL");
  if (!webhookUrl) {
    return new Response("REMINDER_WEBHOOK_URL is not configured", { status: 500 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const now = Date.now();
  const windowStart = new Date(now + REMINDER_WINDOW_START_HOURS * 3_600_000).toISOString();
  const windowEnd = new Date(now + REMINDER_WINDOW_END_HOURS * 3_600_000).toISOString();

  const { data: appointments, error } = await supabase
    .from("appointments")
    .select("id, starts_at, user_id, profiles(full_name, phone), services(name)")
    .eq("status", "confirmed")
    .is("reminder_sent_at", null)
    .gte("starts_at", windowStart)
    .lte("starts_at", windowEnd);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  let sent = 0;
  for (const appt of appointments ?? []) {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        appointmentId: appt.id,
        startsAt: appt.starts_at,
        memberName: appt.profiles?.full_name,
        memberPhone: appt.profiles?.phone,
        serviceName: appt.services?.name,
      }),
    });

    if (response.ok) {
      await supabase
        .from("appointments")
        .update({ reminder_sent_at: new Date().toISOString() })
        .eq("id", appt.id);
      sent += 1;
    }
  }

  return new Response(JSON.stringify({ checked: appointments?.length ?? 0, sent }), {
    headers: { "Content-Type": "application/json" },
  });
});
