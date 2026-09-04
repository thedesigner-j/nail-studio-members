// Supabase Edge Function, run on a schedule (see the pg_cron job in
// supabase/migrations/0004_reminder_schedule.sql). Finds appointments
// starting in roughly 24 hours that haven't been reminded yet, and emails
// each member directly via Resend's REST API (no SDK needed in Deno).
import { createClient } from "jsr:@supabase/supabase-js@2";

const REMINDER_WINDOW_START_HOURS = 23;
const REMINDER_WINDOW_END_HOURS = 25;

function formatAppointmentTime(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

function reminderEmailHtml(memberName: string | null, serviceName: string, startsAt: string) {
  const firstName = memberName?.split(" ")[0] ?? "there";
  return `
    <div style="font-family: -apple-system, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #171717;">
      <h1 style="font-size: 20px; margin: 0 0 4px;">See you soon, ${firstName}!</h1>
      <p style="color: #525252; margin: 0 0 16px;">This is a reminder about your upcoming appointment.</p>
      <div style="background: #fafaf9; border-radius: 12px; padding: 16px;">
        <p style="margin: 0 0 4px; font-weight: 600;">${serviceName}</p>
        <p style="margin: 0; color: #525252;">${formatAppointmentTime(startsAt)}</p>
      </div>
    </div>
  `;
}

async function sendReminderEmail(resendApiKey: string, fromAddress: string, to: string, html: string, subject: string) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: fromAddress, to, subject, html }),
  });
  return response.ok;
}

Deno.serve(async (req) => {
  if (req.headers.get("Authorization") !== `Bearer ${Deno.env.get("CRON_SECRET")}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  if (!resendApiKey) {
    return new Response("RESEND_API_KEY is not configured", { status: 500 });
  }
  const fromAddress = Deno.env.get("EMAIL_FROM") || "Nail Studio <onboarding@resend.dev>";

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const now = Date.now();
  const windowStart = new Date(now + REMINDER_WINDOW_START_HOURS * 3_600_000).toISOString();
  const windowEnd = new Date(now + REMINDER_WINDOW_END_HOURS * 3_600_000).toISOString();

  const { data: appointments, error } = await supabase
    .from("appointments")
    .select("id, starts_at, user_id, profiles(full_name), services(name)")
    .eq("status", "confirmed")
    .is("reminder_sent_at", null)
    .gte("starts_at", windowStart)
    .lte("starts_at", windowEnd);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  let sent = 0;
  for (const appt of appointments ?? []) {
    // auth.users isn't exposed via the normal data API, so the member's
    // email has to come from the admin API rather than a select() join.
    const { data: userData } = await supabase.auth.admin.getUserById(appt.user_id);
    const email = userData?.user?.email;
    if (!email) continue;

    const serviceName = appt.services?.name ?? "Appointment";
    const ok = await sendReminderEmail(
      resendApiKey,
      fromAddress,
      email,
      reminderEmailHtml(appt.profiles?.full_name ?? null, serviceName, appt.starts_at),
      `Reminder: ${serviceName} tomorrow`,
    );

    if (ok) {
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
