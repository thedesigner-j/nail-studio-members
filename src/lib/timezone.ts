// The salon has one physical location (Las Vegas), so every wall-clock time
// in the app — business hours, booking slots, day boundaries — means Pacific
// time, regardless of what timezone the server process or a visitor's
// browser happens to be in. Vercel's Node runtime defaults to UTC, so
// without this, `Date#setHours` and unqualified `Intl.DateTimeFormat` calls
// silently drift by 7-8 hours depending on the reader/writer's own TZ.
export const BUSINESS_TIMEZONE = "America/Los_Angeles";

function getTimeZoneOffsetMinutes(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);

  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));

  return (asUtc - date.getTime()) / 60_000;
}

// Converts a wall-clock time on a given calendar date, as read in
// `timeZone`, to the UTC instant it actually represents — e.g. "10:00" on
// business_hours meaning 10am Pacific, not 10am UTC. Approximates the
// offset using the wall-clock time itself rather than the true instant,
// which is exact except within the hour of a DST transition.
export function zonedTimeToUtc(
  dateStr: string,
  hours: number,
  minutes: number,
  seconds = 0,
  timeZone: string = BUSINESS_TIMEZONE,
): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  const guess = new Date(Date.UTC(year, month - 1, day, hours, minutes, seconds));
  const offsetMinutes = getTimeZoneOffsetMinutes(guess, timeZone);
  return new Date(guess.getTime() - offsetMinutes * 60_000);
}

// Same idea, for a `<input type="datetime-local">` value ("YYYY-MM-DDTHH:MM"
// or with seconds) — admin-entered event times mean Pacific wall-clock too,
// not whatever timezone the server process happens to run in.
export function zonedDateTimeLocalToUtc(value: string, timeZone: string = BUSINESS_TIMEZONE): Date {
  const [dateStr, timeStr] = value.split("T");
  const [hours, minutes, seconds] = timeStr.split(":").map(Number);
  return zonedTimeToUtc(dateStr, hours, minutes, seconds || 0, timeZone);
}

// The wall-clock hour/minute `date` falls on as read in `timeZone` — used to
// position an appointment block within a day's time grid (e.g. the admin
// calendar), where "how far down the column" has to be Pacific hours, not
// whatever timezone the browser rendering it happens to be in.
export function zonedHourMinute(date: Date, timeZone: string = BUSINESS_TIMEZONE): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(date);

  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { hour: get("hour"), minute: get("minute") };
}

// The calendar date (year/month/day) `date` falls on as read in `timeZone`
// — e.g. what day it is in Vegas right now, which can differ from what day
// it is in the browser's own timezone. Used to build the booking date
// picker's "today" without it drifting a day off from the salon's actual
// business day for a visitor browsing from elsewhere.
export function zonedDateParts(
  date: Date,
  timeZone: string = BUSINESS_TIMEZONE,
): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}
