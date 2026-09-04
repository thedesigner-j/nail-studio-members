"use client";

import { useMemo } from "react";
import { formatSlotTime } from "@/lib/format";
import { zonedDateParts, zonedHourMinute } from "@/lib/timezone";

const HOUR_HEIGHT = 56;

type Appointment = {
  id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  memberName: string;
  services: { name: string } | null;
};

type Day = { iso: string; weekday: string; label: string };

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function formatHourLabel(hour: number) {
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour} ${period}`;
}

const STATUS_STYLE: Record<string, string> = {
  confirmed: "border-indigo-300 bg-indigo-50 text-indigo-900",
  pending_payment: "border-amber-300 bg-amber-50 text-amber-900",
  completed: "border-neutral-300 bg-neutral-100 text-neutral-500",
  no_show: "border-rose-300 bg-rose-50 text-rose-700",
};

export default function WeekCalendar({
  days,
  appointments,
  startHour,
  endHour,
}: {
  days: Day[];
  appointments: Appointment[];
  startHour: number;
  endHour: number;
}) {
  const byDay = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const day of days) map.set(day.iso, []);
    for (const appt of appointments) {
      const { year, month, day } = zonedDateParts(new Date(appt.starts_at));
      const iso = `${year}-${pad(month)}-${pad(day)}`;
      map.get(iso)?.push(appt);
    }
    return map;
  }, [days, appointments]);

  const hours = Array.from({ length: Math.max(endHour - startHour, 1) }, (_, i) => startHour + i);
  const totalHeight = hours.length * HOUR_HEIGHT;

  return (
    <div className="card overflow-x-auto p-0">
      <div className="grid min-w-[720px]" style={{ gridTemplateColumns: `56px repeat(${days.length}, 1fr)` }}>
        <div className="border-b border-neutral-200" />
        {days.map((day) => (
          <div key={day.iso} className="border-b border-l border-neutral-200 px-2 py-2 text-center">
            <p className="text-xs font-medium uppercase text-neutral-400">{day.weekday}</p>
            <p className="text-sm font-semibold text-neutral-900">{day.label}</p>
          </div>
        ))}

        <div className="relative" style={{ height: totalHeight }}>
          {hours.map((h, i) => (
            <div
              key={h}
              className="absolute right-1 -translate-y-1/2 text-[10px] text-neutral-400"
              style={{ top: i * HOUR_HEIGHT }}
            >
              {formatHourLabel(h)}
            </div>
          ))}
        </div>

        {days.map((day) => (
          <div key={day.iso} className="relative border-l border-neutral-200" style={{ height: totalHeight }}>
            {hours.map((h, i) => (
              <div key={h} className="absolute left-0 right-0 border-t border-neutral-100" style={{ top: i * HOUR_HEIGHT }} />
            ))}

            {(byDay.get(day.iso) ?? []).map((appt) => {
              const { hour, minute } = zonedHourMinute(new Date(appt.starts_at));
              const durationMinutes = (new Date(appt.ends_at).getTime() - new Date(appt.starts_at).getTime()) / 60_000;
              const top = (((hour - startHour) * 60 + minute) / 60) * HOUR_HEIGHT;
              const height = Math.max((durationMinutes / 60) * HOUR_HEIGHT, 22);

              return (
                <div
                  key={appt.id}
                  className={`absolute left-1 right-1 overflow-hidden rounded-lg border px-1.5 py-1 text-[11px] leading-tight ${
                    STATUS_STYLE[appt.status] ?? STATUS_STYLE.confirmed
                  }`}
                  style={{ top, height }}
                  title={`${appt.memberName} — ${appt.services?.name ?? "Appointment"} — ${formatSlotTime(appt.starts_at)}`}
                >
                  <p className="truncate font-medium">{appt.memberName}</p>
                  <p className="truncate opacity-80">{appt.services?.name}</p>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
