"use client";

import { useActionState } from "react";
import { markAppointmentPaidAndCompleted } from "./actions";
import { formatAppointmentTime, formatCurrency } from "@/lib/format";

type Appointment = {
  id: string;
  memberName: string;
  starts_at: string;
  price_cents: number;
  services: { name: string } | null;
};

export default function AppointmentRow({ appointment }: { appointment: Appointment }) {
  const [state, formAction, pending] = useActionState(markAppointmentPaidAndCompleted, null);

  if (state && !state.error) {
    return (
      <li className="card flex items-center justify-between text-sm text-emerald-700">
        <span>
          {appointment.memberName} — {appointment.services?.name}
        </span>
        <span>Marked paid & completed</span>
      </li>
    );
  }

  return (
    <li className="card space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium text-neutral-900">
            {appointment.memberName} — {appointment.services?.name}
          </p>
          <p className="text-sm text-neutral-500">{formatAppointmentTime(appointment.starts_at)}</p>
        </div>
        <p className="text-sm text-neutral-500">{formatCurrency(appointment.price_cents)}</p>
      </div>

      <form action={formAction} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="appointmentId" value={appointment.id} />

        <div>
          <label className="field-label">Amount charged ($)</label>
          <input
            type="number"
            name="amountDollars"
            defaultValue={(appointment.price_cents / 100).toFixed(2)}
            min={0}
            step={0.01}
            className="field-input w-32"
            required
          />
        </div>

        <div>
          <label className="field-label">Method</label>
          <select name="method" defaultValue="in_person" className="field-input w-32">
            <option value="in_person">In person</option>
            <option value="card">Card</option>
            <option value="cash">Cash</option>
            <option value="other">Other</option>
          </select>
        </div>

        <button type="submit" disabled={pending} className="btn-primary btn-sm">
          {pending ? "Saving..." : "Mark paid & completed"}
        </button>
      </form>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
    </li>
  );
}
