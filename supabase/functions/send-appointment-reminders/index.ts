// Supabase Edge Function, run hourly (see the pg_cron job in
// supabase/migrations/0004_reminder_schedule.sql). Sends two reminders per
// appointment via Resend's REST API (no SDK needed in Deno): one about 2
// days out, and one the day of. Each stage tracks its own "already sent"
// timestamp (0013_reminder_stages.sql) and is checked independently, so a
// last-minute booking (<14h notice) just gets the day-of reminder and never
// picks up a stale "2 days away" one.
import { createClient } from "jsr:@supabase/supabase-js@2";

const DAY_OF_WINDOW_HOURS = 14;
const TWO_DAY_WINDOW_HOURS = 48;

const STAGES = [
  {
    column: "reminder_dayof_sent_at",
    maxHoursOut: DAY_OF_WINDOW_HOURS,
    minHoursOut: 0,
    subject: (serviceName: string) => `Reminder: ${serviceName} today`,
    heading: (firstName: string) => `See you soon, ${firstName}!`,
    intro: "This is a reminder about your appointment coming up today.",
  },
  {
    column: "reminder_48h_sent_at",
    maxHoursOut: TWO_DAY_WINDOW_HOURS,
    minHoursOut: DAY_OF_WINDOW_HOURS,
    subject: (serviceName: string) => `Reminder: ${serviceName} in 2 days`,
    heading: (firstName: string) => `Hi ${firstName}, see you in a couple days!`,
    intro: "Just a heads up on your upcoming appointment — let us know if you need to reschedule.",
  },
] as const;

// The salon has one physical location (Las Vegas) — reminder times are
// always shown in Pacific time, not the server's local (UTC) timezone.
function formatAppointmentTime(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

function reminderEmailHtml(heading: string, intro: string, serviceName: string, startsAt: string) {
  return `
    <div style="font-family: -apple-system, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #171717;">
      <h1 style="font-size: 20px; margin: 0 0 4px;">${heading}</h1>
      <p style="color: #525252; margin: 0 0 16px;">${intro}</p>
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
  let checked = 0;
  let sent = 0;

  for (const stage of STAGES) {
    const windowStart = new Date(now + stage.minHoursOut * 3_600_000).toISOString();
    const windowEnd = new Date(now + stage.maxHoursOut * 3_600_000).toISOString();

    const { data: appointments, error } = await supabase
      .from("appointments")
      .select("id, starts_at, user_id, profiles(full_name), services(name)")
      .eq("status", "confirmed")
      .is(stage.column, null)
      .gt("starts_at", windowStart)
      .lte("starts_at", windowEnd);

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }

    checked += appointments?.length ?? 0;

    for (const appt of appointments ?? []) {
      // auth.users isn't exposed via the normal data API, so the member's
      // email has to come from the admin API rather than a select() join.
      const { data: userData } = await supabase.auth.admin.getUserById(appt.user_id);
      const email = userData?.user?.email;
      if (!email) continue;

      const serviceName = appt.services?.name ?? "Appointment";
      const firstName = appt.profiles?.full_name?.split(" ")[0] ?? "there";
      const ok = await sendReminderEmail(
        resendApiKey,
        fromAddress,
        email,
        reminderEmailHtml(stage.heading(firstName), stage.intro, serviceName, appt.starts_at),
        stage.subject(serviceName),
      );

      if (ok) {
        await supabase
          .from("appointments")
          .update({ [stage.column]: new Date().toISOString() })
          .eq("id", appt.id);
        sent += 1;
      }
    }
  }

  return new Response(JSON.stringify({ checked, sent }), {
    headers: { "Content-Type": "application/json" },
  });
});
