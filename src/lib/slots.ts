import { createClient } from "@/lib/supabase/server";
import { zonedTimeToUtc } from "@/lib/timezone";

const SLOT_STEP_MINUTES = 30;

// Available start times for a service on a given local calendar date, based
// on recurring business hours minus any appointments already booked. Each
// appointment blocks its own duration plus its service's buffer_minutes
// afterward (cleanup time before the next client), on both sides of the
// comparison — the existing appointment's buffer keeps a new one from
// starting too soon after it, and the new appointment's own buffer keeps it
// from being booked too close before the next existing one.
export async function getAvailableSlots(serviceId: string, dateStr: string) {
  const supabase = await createClient();

  const [{ data: service }, { data: hours }] = await Promise.all([
    supabase.from("services").select("*").eq("id", serviceId).single(),
    supabase.from("business_hours").select("*"),
  ]);

  if (!service) return [];

  const date = new Date(`${dateStr}T00:00:00`);
  const dayHours = hours?.filter((h) => h.day_of_week === date.getDay()) ?? [];
  if (dayHours.length === 0) return [];

  const dayStart = zonedTimeToUtc(dateStr, 0, 0, 0);
  const dayEnd = zonedTimeToUtc(dateStr, 23, 59, 59);

  const { data: existing } = await supabase
    .from("appointments")
    .select("starts_at, ends_at, services(buffer_minutes)")
    .neq("status", "cancelled")
    .gte("starts_at", dayStart.toISOString())
    .lte("starts_at", dayEnd.toISOString());

  // Supabase's untyped client guesses embedded to-one relations as arrays
  // from the (plural) table name; at runtime this is a single object since
  // appointments.service_id -> services.id is many-to-one.
  type AppointmentWithBuffer = {
    starts_at: string;
    ends_at: string;
    services: { buffer_minutes: number } | null;
  };

  const busy = ((existing ?? []) as unknown as AppointmentWithBuffer[]).map((appt) => ({
    start: new Date(appt.starts_at),
    blockedUntil: new Date(
      new Date(appt.ends_at).getTime() + (appt.services?.buffer_minutes ?? 0) * 60_000,
    ),
  }));

  const durationMs = service.duration_minutes * 60_000;
  const bufferMs = service.buffer_minutes * 60_000;
  const now = new Date();
  const slots: string[] = [];

  for (const window of dayHours) {
    const [startH, startM] = window.start_time.split(":").map(Number);
    const [endH, endM] = window.end_time.split(":").map(Number);

    const windowStart = zonedTimeToUtc(dateStr, startH, startM);
    const windowEnd = zonedTimeToUtc(dateStr, endH, endM);

    for (
      let slotStart = new Date(windowStart);
      slotStart.getTime() + durationMs <= windowEnd.getTime();
      slotStart = new Date(slotStart.getTime() + SLOT_STEP_MINUTES * 60_000)
    ) {
      const slotEnd = new Date(slotStart.getTime() + durationMs);
      const slotBlockedUntil = new Date(slotEnd.getTime() + bufferMs);
      if (slotStart < now) continue;

      const overlaps = busy.some((b) => slotStart < b.blockedUntil && slotBlockedUntil > b.start);
      if (!overlaps) slots.push(slotStart.toISOString());
    }
  }

  return slots;
}
