"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { bookAppointment } from "./actions";
import { formatCurrency, formatDollars, formatSlotTime } from "@/lib/format";
import { zonedDateParts } from "@/lib/timezone";

type Service = {
  id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  price_cents: number;
};

const BOOKING_WINDOW_DAYS = 60;

function pad(n: number) {
  return String(n).padStart(2, "0");
}

// Only the salon's actual open days, so a closed day never appears as a
// pickable option instead of silently showing "no open times" after the
// fact. Rooted in the salon's own Pacific "today" (via zonedDateParts), not
// the visitor's browser timezone, so the list doesn't drift a day off for
// someone browsing from elsewhere.
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

export default function BookingForm({
  services,
  creditBalance,
  depositPercent,
  cancellationRefundHours,
  openDaysOfWeek,
}: {
  services: Service[];
  creditBalance: number;
  depositPercent: number;
  cancellationRefundHours: number;
  openDaysOfWeek: number[];
}) {
  const [state, formAction, pending] = useActionState(bookAppointment, null);
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const openDays = useMemo(() => buildOpenDays(new Set(openDaysOfWeek)), [openDaysOfWeek]);
  const [date, setDate] = useState(() => openDays[0]?.iso ?? "");
  const [rawSelectedSlot, setRawSelectedSlot] = useState<string | null>(null);
  const [slotsResult, setSlotsResult] = useState<{ key: string; slots: string[] } | null>(null);
  const [creditToApply, setCreditToApply] = useState(0);
  const [paymentOption, setPaymentOption] = useState<"deposit" | "full">("deposit");

  const requestKey = `${serviceId}:${date}`;
  const loadingSlots = serviceId !== "" && slotsResult?.key !== requestKey;
  const slots = slotsResult?.key === requestKey ? slotsResult.slots : [];
  const selectedSlot = slots.includes(rawSelectedSlot ?? "") ? rawSelectedSlot : null;

  useEffect(() => {
    if (!serviceId || !date) return;

    fetch(`/api/appointments/slots?serviceId=${serviceId}&date=${date}`)
      .then((res) => res.json())
      .then((data) => setSlotsResult({ key: `${serviceId}:${date}`, slots: data.slots ?? [] }));
  }, [serviceId, date]);

  const selectedService = services.find((s) => s.id === serviceId);
  const depositCents = selectedService ? Math.round(selectedService.price_cents * (depositPercent / 100)) : 0;

  const dueTodayBaseCents =
    paymentOption === "full" ? (selectedService?.price_cents ?? 0) : depositCents;
  const remainingAtVisitCents = selectedService
    ? paymentOption === "full"
      ? 0
      : selectedService.price_cents - depositCents
    : 0;

  const maxCreditApplicable = Math.min(creditBalance, dueTodayBaseCents / 100);
  const clampedCredit = Math.min(creditToApply, maxCreditApplicable);
  const dueTodayCents = Math.max(0, dueTodayBaseCents - Math.round(clampedCredit * 100));

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="serviceId" value={serviceId} />
      <input type="hidden" name="startsAt" value={selectedSlot ?? ""} />
      <input type="hidden" name="creditToApply" value={clampedCredit} />
      <input type="hidden" name="paymentOption" value={paymentOption} />

      <div className="card space-y-6">
        <div>
          <label className="field-label">Service</label>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {services.map((service) => (
              <button
                key={service.id}
                type="button"
                onClick={() => setServiceId(service.id)}
                className={`rounded-xl border p-3 text-left text-sm transition-colors ${
                  serviceId === service.id
                    ? "border-neutral-900 bg-neutral-900 text-white"
                    : "border-neutral-200 bg-white text-neutral-900 hover:border-neutral-400"
                }`}
              >
                <p className="font-medium">{service.name}</p>
                <p
                  className={`mt-1 text-xs ${
                    serviceId === service.id ? "text-neutral-300" : "text-neutral-500"
                  }`}
                >
                  {service.duration_minutes} min · {formatCurrency(service.price_cents)}
                </p>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="field-label">Date</label>
          {openDays.length === 0 ? (
            <p className="mt-2 text-sm text-neutral-500">No upcoming open days — check back soon.</p>
          ) : (
            <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
              {openDays.map((d) => (
                <button
                  key={d.iso}
                  type="button"
                  onClick={() => setDate(d.iso)}
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
          <label className="field-label">Time</label>
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

        {selectedService && depositCents > 0 && (
          <div>
            <label className="field-label">How would you like to pay?</label>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setPaymentOption("deposit")}
                className={`rounded-xl border p-3 text-left text-sm transition-colors ${
                  paymentOption === "deposit"
                    ? "border-neutral-900 bg-neutral-900 text-white"
                    : "border-neutral-200 bg-white text-neutral-900 hover:border-neutral-400"
                }`}
              >
                <p className="font-medium">Pay deposit ({depositPercent}%)</p>
                <p
                  className={`mt-1 text-xs ${
                    paymentOption === "deposit" ? "text-neutral-300" : "text-neutral-500"
                  }`}
                >
                  {formatCurrency(depositCents)} today, rest due at your appointment
                </p>
              </button>
              <button
                type="button"
                onClick={() => setPaymentOption("full")}
                className={`rounded-xl border p-3 text-left text-sm transition-colors ${
                  paymentOption === "full"
                    ? "border-neutral-900 bg-neutral-900 text-white"
                    : "border-neutral-200 bg-white text-neutral-900 hover:border-neutral-400"
                }`}
              >
                <p className="font-medium">Pay in full</p>
                <p
                  className={`mt-1 text-xs ${
                    paymentOption === "full" ? "text-neutral-300" : "text-neutral-500"
                  }`}
                >
                  {formatCurrency(selectedService.price_cents)} today, nothing due later
                </p>
              </button>
            </div>
          </div>
        )}

        {creditBalance > 0 && dueTodayBaseCents > 0 && (
          <div>
            <label className="field-label" htmlFor="creditToApply">
              Apply account credit (optional) — {formatDollars(creditBalance)} available
            </label>
            <input
              id="creditToApply"
              type="number"
              min={0}
              max={maxCreditApplicable}
              step={0.01}
              value={creditToApply || ""}
              onChange={(e) => setCreditToApply(Number(e.target.value) || 0)}
              placeholder="0.00"
              className="field-input w-auto"
            />
            <p className="mt-1 text-xs text-neutral-400">
              Up to {formatDollars(maxCreditApplicable)} can be applied to what&apos;s due today.
            </p>
          </div>
        )}

        <div>
          <label className="field-label" htmlFor="notes">
            Notes (optional)
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={2}
            className="field-input"
            placeholder="Any requests for your nail tech?"
          />
        </div>

        {selectedService && dueTodayBaseCents > 0 && (
          <div className="rounded-xl bg-neutral-50 p-3 text-sm">
            <div className="flex justify-between text-neutral-500">
              <span>Service total</span>
              <span>{formatCurrency(selectedService.price_cents)}</span>
            </div>
            <div className="flex justify-between text-neutral-500">
              <span>{paymentOption === "full" ? "Paying in full" : `Deposit (${depositPercent}%)`}</span>
              <span>{formatCurrency(dueTodayBaseCents)}</span>
            </div>
            {clampedCredit > 0 && (
              <div className="flex justify-between text-emerald-600">
                <span>Credit applied</span>
                <span>-{formatDollars(clampedCredit)}</span>
              </div>
            )}
            <div className="mt-1 flex justify-between border-t border-neutral-200 pt-1 font-medium text-neutral-900">
              <span>Due today</span>
              <span>{formatCurrency(dueTodayCents)}</span>
            </div>
            <div className="flex justify-between text-neutral-400">
              <span>Due at your appointment</span>
              <span>{formatCurrency(remainingAtVisitCents)}</span>
            </div>
          </div>
        )}

        {selectedService && dueTodayBaseCents > 0 && (
          <p className="text-xs text-neutral-500">
            {paymentOption === "full" ? "This payment is" : "Your deposit is"} refundable if you cancel at
            least {cancellationRefundHours} hours before your appointment. Cancelling later, or not showing
            up, forfeits it.
          </p>
        )}

        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

        <button type="submit" disabled={pending || !selectedSlot} className="btn-primary">
          {pending
            ? "Booking..."
            : dueTodayCents > 0
              ? `Pay ${formatCurrency(dueTodayCents)}${paymentOption === "full" ? " in full" : " deposit"} to book`
              : "Confirm booking"}
        </button>
      </div>
    </form>
  );
}
