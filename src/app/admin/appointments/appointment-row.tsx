"use client";

import { useActionState, useState, useTransition } from "react";
import Image from "next/image";
import { markAppointmentPaidAndCompleted, markAppointmentNoShow, cancelAppointmentAsAdmin } from "./actions";
import { formatAppointmentTime, formatCurrency } from "@/lib/format";

type Appointment = {
  id: string;
  memberName: string;
  starts_at: string;
  price_cents: number;
  deposit_status: string;
  deposit_amount_cents: number;
  services: { name: string } | null;
  reference_photo_url?: string | null;
  collections?: {
    name: string;
    collection_photos?: { visit_photos: { image_url: string } | null }[];
  } | null;
};

export default function AppointmentRow({ appointment }: { appointment: Appointment }) {
  const [state, formAction, pending] = useActionState(markAppointmentPaidAndCompleted, null);
  const [noShowPending, startNoShowTransition] = useTransition();
  const [markedNoShow, setMarkedNoShow] = useState(false);
  const [cancelPending, startCancelTransition] = useTransition();
  const [cancelled, setCancelled] = useState(false);

  const depositPaid = appointment.deposit_status === "paid";
  const paidInFull = depositPaid && appointment.deposit_amount_cents >= appointment.price_cents;
  const remainingCents = depositPaid
    ? Math.max(0, appointment.price_cents - appointment.deposit_amount_cents)
    : appointment.price_cents;

  function handleNoShow() {
    setMarkedNoShow(true);
    startNoShowTransition(() => {
      markAppointmentNoShow(appointment.id);
    });
  }

  function handleCancel() {
    if (!confirm("Cancel this appointment? The client will be emailed, and any card deposit refunded.")) return;
    setCancelled(true);
    startCancelTransition(() => {
      cancelAppointmentAsAdmin(appointment.id);
    });
  }

  if ((state && !state.error) || markedNoShow || cancelled) {
    return (
      <li className="card flex items-center justify-between text-sm text-emerald-700">
        <span>
          {appointment.memberName} — {appointment.services?.name}
        </span>
        <span>{markedNoShow ? "Marked no-show" : cancelled ? "Cancelled" : "Marked paid & completed"}</span>
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
              {paidInFull ? "Paid in full" : `${formatCurrency(appointment.deposit_amount_cents)} deposit paid`}
            </span>
          )}
        </div>
      </div>

      {(appointment.reference_photo_url || appointment.collections) && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-neutral-50 p-2">
          {appointment.reference_photo_url && (
            <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg">
              <Image src={appointment.reference_photo_url} alt="Reference" fill unoptimized className="object-cover" />
            </div>
          )}
          {appointment.collections && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-neutral-500">
                Inspired by &ldquo;{appointment.collections.name}&rdquo;:
              </span>
              <div className="flex -space-x-2">
                {(appointment.collections.collection_photos ?? [])
                  .slice(0, 4)
                  .map((cp, i) =>
                    cp.visit_photos ? (
                      <div key={i} className="relative h-8 w-8 overflow-hidden rounded-full border-2 border-white">
                        <Image src={cp.visit_photos.image_url} alt="" fill unoptimized className="object-cover" />
                      </div>
                    ) : null,
                  )}
              </div>
            </div>
          )}
        </div>
      )}

      <form action={formAction} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="appointmentId" value={appointment.id} />

        <div>
          <label className="field-label">
            {paidInFull
              ? "Additional amount charged ($)"
              : depositPaid
                ? "Remaining balance charged ($)"
                : "Amount charged ($)"}
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
          {paidInFull && <p className="mt-1 text-xs text-neutral-400">Already paid in full — leave at $0 unless charging extra.</p>}
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
        <button
          type="button"
          onClick={handleCancel}
          disabled={cancelPending}
          className="text-sm font-medium text-neutral-500 hover:underline"
        >
          Cancel
        </button>
      </form>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
    </li>
  );
}
