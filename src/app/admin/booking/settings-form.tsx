"use client";

import { useActionState } from "react";
import { updateBookingSettings } from "./actions";

type Settings = {
  deposit_percent: number;
  cancellation_refund_hours: number;
};

export default function SettingsForm({ settings }: { settings: Settings }) {
  const [state, formAction, pending] = useActionState(updateBookingSettings, null);

  return (
    <form action={formAction} className="card grid gap-4 sm:grid-cols-2">
      <div>
        <label className="field-label">Deposit (% of service price)</label>
        <input
          type="number"
          name="depositPercent"
          defaultValue={settings.deposit_percent}
          min={0}
          max={100}
          step={1}
          className="field-input"
          required
        />
        <p className="mt-1 text-xs text-neutral-400">
          Charged via Stripe at the time of booking. Set to 0 to require no deposit.
        </p>
      </div>

      <div>
        <label className="field-label">Cancellation refund window (hours)</label>
        <input
          type="number"
          name="cancellationRefundHours"
          defaultValue={settings.cancellation_refund_hours}
          min={0}
          step={1}
          className="field-input"
          required
        />
        <p className="mt-1 text-xs text-neutral-400">
          Cancelling at least this many hours before the appointment refunds the deposit;
          cancelling later forfeits it, same as a no-show.
        </p>
      </div>

      <div className="sm:col-span-2">
        {state?.error ? (
          <p className="text-sm text-red-600">{state.error}</p>
        ) : state && !state.error ? (
          <p className="text-sm text-emerald-600">Saved.</p>
        ) : null}

        <button type="submit" disabled={pending} className="btn-primary mt-2">
          {pending ? "Saving..." : "Save settings"}
        </button>
      </div>
    </form>
  );
}
