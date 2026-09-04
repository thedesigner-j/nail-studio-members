import Link from "next/link";
import { getAppointmentsForCalendar, getBusinessHours } from "@/lib/data";
import { zonedDateParts, zonedTimeToUtc } from "@/lib/timezone";
import WeekCalendar from "./week-calendar";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function toIso(year: number, month: number, day: number) {
  return `${year}-${pad(month)}-${pad(day)}`;
}

function addDays(year: number, month: number, day: number, delta: number) {
  const d = new Date(year, month - 1, day);
  d.setDate(d.getDate() + delta);
  return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
}

function getHourBounds(hours: { start_time: string; end_time: string }[]) {
  if (hours.length === 0) return { startHour: 9, endHour: 18 };

  const startHours = hours.map((h) => Number(h.start_time.split(":")[0]));
  const endHours = hours.map((h) => {
    const [hh, mm] = h.end_time.split(":").map(Number);
    return mm > 0 ? hh + 1 : hh;
  });

  return { startHour: Math.min(...startHours), endHour: Math.max(...endHours) };
}

export default async function AdminCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const { week } = await searchParams;

  const anchor =
    week && /^\d{4}-\d{2}-\d{2}$/.test(week)
      ? { year: Number(week.slice(0, 4)), month: Number(week.slice(5, 7)), day: Number(week.slice(8, 10)) }
      : zonedDateParts(new Date());

  // Snap to the Sunday of that week — day-of-week math is timezone-agnostic
  // once you have the correct Y/M/D, so a plain local Date is fine here.
  const anchorWeekday = new Date(anchor.year, anchor.month - 1, anchor.day).getDay();
  const sunday = addDays(anchor.year, anchor.month, anchor.day, -anchorWeekday);

  const days = Array.from({ length: 7 }, (_, i) => {
    const { year, month, day } = addDays(sunday.year, sunday.month, sunday.day, i);
    const iso = toIso(year, month, day);
    const dateObj = new Date(year, month - 1, day);
    return {
      iso,
      weekday: new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(dateObj),
      label: new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(dateObj),
    };
  });

  const nextSunday = addDays(sunday.year, sunday.month, sunday.day, 7);
  const weekStartUtc = zonedTimeToUtc(days[0].iso, 0, 0, 0);
  const weekEndUtc = zonedTimeToUtc(toIso(nextSunday.year, nextSunday.month, nextSunday.day), 0, 0, 0);

  const [appointments, businessHours] = await Promise.all([
    getAppointmentsForCalendar(weekStartUtc.toISOString(), weekEndUtc.toISOString()),
    getBusinessHours(),
  ]);

  const { startHour, endHour } = getHourBounds(businessHours);
  const prevWeek = addDays(sunday.year, sunday.month, sunday.day, -7);
  const nextWeek = addDays(sunday.year, sunday.month, sunday.day, 7);
  const today = zonedDateParts(new Date());

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Calendar</h1>
          <p className="mt-1 text-sm text-neutral-500">
            {days[0].label} – {days[6].label}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/admin/calendar?week=${toIso(prevWeek.year, prevWeek.month, prevWeek.day)}`} className="btn-secondary btn-sm">
            ← Prev
          </Link>
          <Link href={`/admin/calendar?week=${toIso(today.year, today.month, today.day)}`} className="btn-secondary btn-sm">
            Today
          </Link>
          <Link href={`/admin/calendar?week=${toIso(nextWeek.year, nextWeek.month, nextWeek.day)}`} className="btn-secondary btn-sm">
            Next →
          </Link>
        </div>
      </div>

      <WeekCalendar days={days} appointments={appointments} startHour={startHour} endHour={endHour} />
    </div>
  );
}
