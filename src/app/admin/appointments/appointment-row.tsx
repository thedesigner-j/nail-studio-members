"use client";

import { useActionState, useState, useTransition } from "react";
import { markAppointmentPaidAndCompleted, markAppointmentNoShow } from "./actions";
import { formatAppointmentTime, formatCurrency } from "@/lib/format";

type Appointment = {
  id: string;
  memberName: string;
  starts_at: string;
  price_cents: number;
  deposit_status: string;
  deposit_amount_cents: number;
  services: { name: string } | null;
};

export default function AppointmentRow({ appointment }: { appointment: Appointment }) {
  const [state, formAction, pending] = useActionState(markAppointmentPaidAndCompleted, null);
  const [noShowPending, startNoShowTransition] = useTransition();
  const [markedNoShow, setMarkedNoShow] = useState(false);

  const depositPaid = appointment.deposit_status === "paid";
  const remainingCents = depositPaid
    ? Math.max(0, appointment.price_cents - appointment.deposit_amount_cents)
    : appointment.price_cents;

  function handleNoShow() {
    setMarkedNoShow(true);
    startNoShowTransition(() => {
      markAppointmentNoShow(appointment.id);
    });
  }

  if ((state && !state.error) || markedNoShow) {
    return (
      <li className="card flex items-center justify-between text-sm text-emerald-700">
        <span>
          {appointment.memberName} — {appointment.services?.name}
        </span>
        <span>{markedNoShow ? "Marked no-show" : "Marked paid & completed"}</span>
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
        <div className="text-right">
          <p className="text-sm text-neutral-500">{formatCurrency(appointment.price_cents)} total</p>
          {depositPaid && (
            <span className="badge bg-emerald-100 text-emerald-700">
              {formatCurrency(appointment.deposit_amount_cents)} deposit paid
            </span>
          )}
        </div>
      </div>

      <form action={formAction} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="appointmentId" value={appointment.id} />

        <div>
          <label className="field-label">
            {depositPaid ? "Remaining balance charged ($)" : "Amount charged ($)"}
          </label>
          <input
            type="number"
            name="amountDollars"
            defaultValue={(remainingCents / 100).toFixed(2)}
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
        <button
          type="button"
          onClick={handleNoShow}
          disabled={noShowPending}
          className="text-sm font-medium text-rose-600 hover:underline"
        >
          Mark no-show
        </button>
      </form>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
    </li>
  );
}
