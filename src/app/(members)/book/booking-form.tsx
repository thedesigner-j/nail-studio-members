"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { bookAppointment } from "./actions";
import { formatCurrency, formatDollars, formatSlotTime } from "@/lib/format";

type Service = {
  id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  price_cents: number;
};

function todayISODate() {
  return new Date().toISOString().slice(0, 10);
}

export default function BookingForm({
  services,
  creditBalance,
  depositPercent,
}: {
  services: Service[];
  creditBalance: number;
  depositPercent: number;
}) {
  const [state, formAction, pending] = useActionState(bookAppointment, null);
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [date, setDate] = useState(todayISODate());
  const [rawSelectedSlot, setRawSelectedSlot] = useState<string | null>(null);
  const [slotsResult, setSlotsResult] = useState<{ key: string; slots: string[] } | null>(null);
  const [creditToApply, setCreditToApply] = useState(0);
  const [paymentOption, setPaymentOption] = useState<"deposit" | "full">("deposit");

  const maxDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 60);
    return d.toISOString().slice(0, 10);
  }, []);

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
          <label className="field-label" htmlFor="date">
            Date
          </label>
          <input
            id="date"
            type="date"
            value={date}
            min={todayISODate()}
            max={maxDate}
            onChange={(e) => setDate(e.target.value)}
            className="field-input w-auto"
          />
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
