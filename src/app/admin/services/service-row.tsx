"use client";

import { useActionState, useState, useTransition } from "react";
import { updateService, setServiceActive } from "./actions";

type Service = {
  id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  price_cents: number;
  buffer_minutes: number;
  active: boolean;
};

export default function ServiceRow({ service }: { service: Service }) {
  const [state, formAction, pending] = useActionState(updateService, null);
  const [active, setActive] = useState(service.active);
  const [, startTransition] = useTransition();

  function handleToggleActive() {
    const next = !active;
    setActive(next);
    startTransition(() => {
      setServiceActive(service.id, next);
    });
  }

  return (
    <form action={formAction} className={`card space-y-3 ${active ? "" : "opacity-60"}`}>
      <input type="hidden" name="id" value={service.id} />

      <div className="flex items-start justify-between gap-3">
        <input
          name="name"
          defaultValue={service.name}
          className="field-input flex-1 font-medium"
          required
        />
        <button
          type="button"
          onClick={handleToggleActive}
          className={`badge shrink-0 ${active ? "bg-emerald-100 text-emerald-700" : "bg-neutral-100 text-neutral-500"}`}
        >
          {active ? "Active" : "Hidden"}
        </button>
      </div>

      <textarea
        name="description"
        defaultValue={service.description ?? ""}
        rows={2}
        placeholder="Description"
        className="field-input"
      />

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="field-label">Duration (min)</label>
          <input
            type="number"
            name="durationMinutes"
            defaultValue={service.duration_minutes}
            min={5}
            step={5}
            className="field-input"
            required
          />
        </div>
        <div>
          <label className="field-label">Buffer after (min)</label>
          <input
            type="number"
            name="bufferMinutes"
            defaultValue={service.buffer_minutes}
            min={0}
            step={5}
            className="field-input"
          />
        </div>
        <div>
          <label className="field-label">Price ($)</label>
          <input
            type="number"
            name="priceDollars"
            defaultValue={(service.price_cents / 100).toFixed(2)}
            min={0}
            step={0.01}
            className="field-input"
            required
          />
        </div>
      </div>

      {state?.error ? (
        <p className="text-sm text-red-600">{state.error}</p>
      ) : state && !state.error ? (
        <p className="text-sm text-emerald-600">Saved.</p>
      ) : null}

      <button type="submit" disabled={pending} className="btn-secondary btn-sm">
        {pending ? "Saving..." : "Save"}
      </button>
    </form>
  );
}
