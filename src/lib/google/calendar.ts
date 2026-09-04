import { google } from "googleapis";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

const SCOPES = ["https://www.googleapis.com/auth/calendar.events"];

function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXT_PUBLIC_SITE_URL}/api/calendar/callback`,
  );
}

export function getGoogleAuthUrl() {
  return getOAuthClient().generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
  });
}

// Always called from the OAuth connect flow itself (a logged-in user's own
// request), so this one still creates its own cookie-based client.
export async function connectGoogleCalendar(userId: string, code: string) {
  const oauth2Client = getOAuthClient();
  const { tokens } = await oauth2Client.getToken(code);

  if (!tokens.access_token || !tokens.refresh_token || !tokens.expiry_date) {
    throw new Error("Google did not return the expected offline tokens.");
  }

  const supabase = await createClient();
  await supabase.from("calendar_connections").upsert({
    user_id: userId,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expiry_date: tokens.expiry_date,
  });
}

// Builds an authenticated calendar client for a member, persisting a
// refreshed access token back to the DB if Google issues a new one. Takes
// the Supabase client as a parameter rather than creating one internally:
// callers include the Stripe webhook, which has no user session/cookies to
// build a cookie-based client from, and must pass the service role client
// instead.
async function getCalendarClientForUser(supabase: SupabaseClient, userId: string) {
  const { data: connection } = await supabase
    .from("calendar_connections")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (!connection) return null;

  const oauth2Client = getOAuthClient();
  oauth2Client.setCredentials({
    access_token: connection.access_token,
    refresh_token: connection.refresh_token,
    expiry_date: connection.expiry_date,
  });

  oauth2Client.on("tokens", async (tokens) => {
    if (tokens.access_token) {
      await supabase
        .from("calendar_connections")
        .update({
          access_token: tokens.access_token,
          expiry_date: tokens.expiry_date ?? connection.expiry_date,
        })
        .eq("user_id", userId);
    }
  });

  return {
    calendar: google.calendar({ version: "v3", auth: oauth2Client }),
    calendarId: connection.calendar_id,
  };
}

export async function createCalendarEvent(
  supabase: SupabaseClient,
  userId: string,
  appointment: { starts_at: string; ends_at: string; notes: string | null },
  serviceName: string,
) {
  const client = await getCalendarClientForUser(supabase, userId);
  if (!client) return null;

  const { data } = await client.calendar.events.insert({
    calendarId: client.calendarId,
    requestBody: {
      summary: `Nail Studio: ${serviceName}`,
      description: appointment.notes ?? undefined,
      start: { dateTime: appointment.starts_at },
      end: { dateTime: appointment.ends_at },
    },
  });

  return data.id ?? null;
}

export async function deleteCalendarEvent(supabase: SupabaseClient, userId: string, eventId: string) {
  const client = await getCalendarClientForUser(supabase, userId);
  if (!client) return;

  await client.calendar.events.delete({
    calendarId: client.calendarId,
    eventId,
  });
}
