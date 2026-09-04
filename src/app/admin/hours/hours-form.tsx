"use client";

import { useActionState, useState } from "react";
import { updateBusinessHours } from "./actions";

const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type DayHours = { open: boolean; start: string; end: string };

export default function HoursForm({ initialHours }: { initialHours: DayHours[] }) {
  const [state, formAction, pending] = useActionState(updateBusinessHours, null);
  const [days, setDays] = useState(initialHours);

  function updateDay(index: number, patch: Partial<DayHours>) {
    setDays((prev) => prev.map((d, i) => (i === index ? { ...d, ...patch } : d)));
  }

  return (
    <form action={formAction} className="card space-y-4">
      {days.map((day, index) => (
        <div key={index} className="flex flex-wrap items-center gap-3 border-b border-neutral-100 pb-4 last:border-0 last:pb-0">
          <label className="flex w-32 shrink-0 items-center gap-2 text-sm font-medium text-neutral-900">
            <input
              type="checkbox"
              name={`open-${index}`}
              checked={day.open}
              onChange={(e) => updateDay(index, { open: e.target.checked })}
              className="h-4 w-4 rounded border-neutral-300"
            />
            {DAY_LABELS[index]}
          </label>

          {day.open ? (
            <div className="flex items-center gap-2">
              <input
                type="time"
                name={`start-${index}`}
                value={day.start}
                onChange={(e) => updateDay(index, { start: e.target.value })}
                className="field-input w-auto py-1.5"
              />
              <span className="text-sm text-neutral-400">to</span>
              <input
                type="time"
                name={`end-${index}`}
                value={day.end}
                onChange={(e) => updateDay(index, { end: e.target.value })}
                className="field-input w-auto py-1.5"
              />
            </div>
          ) : (
            <span className="text-sm text-neutral-400">Closed</span>
          )}
        </div>
      ))}

      {state?.error ? (
        <p className="text-sm text-red-600">{state.error}</p>
      ) : state && !state.error ? (
        <p className="text-sm text-emerald-600">Saved.</p>
      ) : null}

      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? "Saving..." : "Save hours"}
      </button>
    </form>
  );
}
