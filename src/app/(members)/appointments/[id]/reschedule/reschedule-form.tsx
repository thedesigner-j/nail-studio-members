"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { rescheduleAppointment } from "../../actions";
import { formatSlotTime } from "@/lib/format";
import { zonedDateParts } from "@/lib/timezone";

const BOOKING_WINDOW_DAYS = 60;

function pad(n: number) {
  return String(n).padStart(2, "0");
}

// Same open-days-only picker as the booking form — see its comment for why
// this is rooted in the salon's Pacific "today" rather than the browser's.
function buildOpenDays(openDaysOfWeek: Set<number>) {
  const { year, month, day } = zonedDateParts(new Date());
  const start = new Date(year, month - 1, day);
  const days: { iso: string; weekday: string; label: string }[] = [];

  for (let i = 0; i < BOOKING_WINDOW_DAYS; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    if (!openDaysOfWeek.has(d.getDay())) continue;

    days.push({
      iso: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
      weekday: new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(d),
      label: new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(d),
    });
  }

  return days;
}

export default function RescheduleForm({
  appointmentId,
  serviceId,
  openDaysOfWeek,
}: {
  appointmentId: string;
  serviceId: string;
  openDaysOfWeek: number[];
}) {
  const [state, formAction, pending] = useActionState(rescheduleAppointment, null);
  const openDays = useMemo(() => buildOpenDays(new Set(openDaysOfWeek)), [openDaysOfWeek]);
  const [date, setDate] = useState(() => openDays[0]?.iso ?? "");
  const [rawSelectedSlot, setRawSelectedSlot] = useState<string | null>(null);
  const [slotsResult, setSlotsResult] = useState<{ key: string; slots: string[] } | null>(null);

  const loadingSlots = Boolean(date) && slotsResult?.key !== date;
  const slots = slotsResult?.key === date ? slotsResult.slots : [];
  const selectedSlot = slots.includes(rawSelectedSlot ?? "") ? rawSelectedSlot : null;

  useEffect(() => {
    if (!date) return;

    fetch(`/api/appointments/slots?serviceId=${serviceId}&date=${date}&excludeAppointmentId=${appointmentId}`)
      .then((res) => res.json())
      .then((data) => setSlotsResult({ key: date, slots: data.slots ?? [] }));
  }, [date, serviceId, appointmentId]);

  return (
    <form action={formAction} className="card space-y-6">
      <input type="hidden" name="appointmentId" value={appointmentId} />
      <input type="hidden" name="startsAt" value={selectedSlot ?? ""} />

      <div>
        <label className="field-label">New date</label>
        {openDays.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-500">No upcoming open days — check back soon.</p>
        ) : (
          <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
            {openDays.map((d) => (
              <button
                key={d.iso}
                type="button"
                onClick={() => {
                  setDate(d.iso);
                  setRawSelectedSlot(null);
                }}
                className={`flex shrink-0 flex-col items-center rounded-xl border px-3 py-2 text-sm transition-colors ${
                  date === d.iso
                    ? "border-neutral-900 bg-neutral-900 text-white"
                    : "border-neutral-200 bg-white text-neutral-900 hover:border-neutral-400"
                }`}
              >
                <span className="text-xs uppercase tracking-wide opacity-70">{d.weekday}</span>
                <span className="font-medium">{d.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div>
        <label className="field-label">New time</label>
        {loadingSlots ? (
          <p className="mt-2 text-sm text-neutral-500">Loading available times...</p>
        ) : slots.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-500">No open times on this date.</p>
        ) : (
          <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
            {slots.map((slot) => (
              <button
                key={slot}
                type="button"
                onClick={() => setRawSelectedSlot(slot)}
                className={`rounded-full border px-2 py-1.5 text-sm transition-colors ${
                  selectedSlot === slot
                    ? "border-neutral-900 bg-neutral-900 text-white"
                    : "border-neutral-200 bg-white text-neutral-900 hover:border-neutral-400"
                }`}
              >
                {formatSlotTime(slot)}
              </button>
            ))}
          </div>
        )}
      </div>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending || !selectedSlot} className="btn-primary">
          {pending ? "Rescheduling..." : "Confirm new time"}
        </button>
        <Link href="/appointments" className="text-sm text-neutral-500 hover:underline">
          Never mind
        </Link>
      </div>
    </form>
  );
}
