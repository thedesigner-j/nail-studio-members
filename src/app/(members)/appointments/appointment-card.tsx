"use client";

import { useState } from "react";
import Link from "next/link";
import { cancelAppointment } from "./actions";
import { formatAppointmentTime, formatCurrency } from "@/lib/format";
import PhotoUploader from "./photo-uploader";

const STATUS_LABEL: Record<string, string> = {
  pending_payment: "Awaiting deposit",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No-show",
};

type Appointment = {
  id: string;
  status: string;
  starts_at: string;
  price_cents: number;
  deposit_status: string;
  deposit_amount_cents: number;
  services: { name: string } | null;
  visit_photos?: { id: string; image_url: string }[];
};

export default function AppointmentCard({
  appointment,
  userId,
  cancellable,
  cancellationRefundHours,
  showPhotoUploader,
}: {
  appointment: Appointment;
  userId: string;
  cancellable: boolean;
  cancellationRefundHours: number;
  showPhotoUploader: boolean;
}) {
  // hoursUntil is computed on click (not during render) since Date.now()
  // is impure — React's purity rules disallow calling it directly in the
  // render body.
  const [confirmState, setConfirmState] = useState<{
    willForfeit: boolean;
    willRefund: boolean;
    canReschedule: boolean;
  } | null>(null);

  const depositPaid = appointment.deposit_status === "paid";
  const paidInFull = depositPaid && appointment.deposit_amount_cents >= appointment.price_cents;
  const remainingCents = appointment.price_cents - appointment.deposit_amount_cents;

  function handleCancelClick() {
    const hoursUntil = (new Date(appointment.starts_at).getTime() - Date.now()) / 3_600_000;
    const hasDeposit = depositPaid && appointment.deposit_amount_cents > 0;
    // Rescheduling is blocked within the same window that forfeits the
    // deposit (see rescheduleAppointment) — no point suggesting it as an
    // escape hatch from a forfeiture that's about to happen either way.
    setConfirmState({
      willForfeit: hasDeposit && hoursUntil < cancellationRefundHours,
      willRefund: hasDeposit && hoursUntil >= cancellationRefundHours,
      canReschedule: hoursUntil >= cancellationRefundHours,
    });
  }

  return (
    <li className="card">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium text-neutral-900">{appointment.services?.name}</p>
          <p className="text-sm text-neutral-500">{formatAppointmentTime(appointment.starts_at)}</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <span className="badge bg-neutral-100 text-neutral-600">
              {STATUS_LABEL[appointment.status] ?? appointment.status}
            </span>
            {paidInFull && <span className="badge bg-emerald-100 text-emerald-700">Paid in full</span>}
            {depositPaid && !paidInFull && (
              <span className="badge bg-amber-100 text-amber-700">
                Remaining balance: {formatCurrency(remainingCents)}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <p className="text-sm text-neutral-500">{formatCurrency(appointment.price_cents)}</p>
          {cancellable && !confirmState && (
            <>
              <Link href={`/appointments/${appointment.id}/reschedule`} className="text-sm font-medium text-neutral-600 hover:underline">
                Reschedule
              </Link>
              <button
                type="button"
                onClick={handleCancelClick}
                className="text-sm font-medium text-rose-600 hover:underline"
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </div>

      {cancellable && confirmState && (
        <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
          <p className="font-medium">
            {confirmState.willForfeit
              ? `Cancelling now forfeits your ${formatCurrency(appointment.deposit_amount_cents)} deposit — it won't be refunded.`
              : confirmState.willRefund
                ? `Your ${formatCurrency(appointment.deposit_amount_cents)} deposit will be refunded since you're cancelling with enough notice.`
                : "Are you sure you want to cancel this appointment?"}
          </p>
          {confirmState.willForfeit && (
            <p className="mt-1 text-rose-700">
              {confirmState.canReschedule
                ? "Need a different time instead? Reschedule and keep your deposit."
                : "It's also too late to reschedule online — contact the studio directly if you need a different time."}
            </p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {confirmState.canReschedule && (
              <Link href={`/appointments/${appointment.id}/reschedule`} className="btn-secondary btn-sm">
                Reschedule instead
              </Link>
            )}
            <form action={cancelAppointment}>
              <input type="hidden" name="appointmentId" value={appointment.id} />
              <button
                type="submit"
                className="rounded-full bg-rose-600 px-3.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-rose-700"
              >
                Yes, cancel appointment
              </button>
            </form>
            <button
              type="button"
              onClick={() => setConfirmState(null)}
              className="text-sm text-neutral-500 hover:underline"
            >
              Keep appointment
            </button>
          </div>
        </div>
      )}

      {showPhotoUploader && appointment.visit_photos && (
        <PhotoUploader appointmentId={appointment.id} userId={userId} initialPhotos={appointment.visit_photos} />
      )}
    </li>
  );
}
