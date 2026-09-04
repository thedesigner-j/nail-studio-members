import { BUSINESS_TIMEZONE } from "@/lib/timezone";

export function formatCurrency(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    cents / 100,
  );
}

// For reward_credits.amount and friends, which are stored as plain dollar
// numerics (not cents) per the loyalty credit ledger's schema.
export function formatDollars(amount: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

// Every appointment time is shown in the salon's own local time (Las
// Vegas), not the viewer's device timezone — a client checking their
// booking from another timezone should still see the time they'll actually
// need to show up, not a converted one.
export function formatAppointmentTime(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TIMEZONE,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatSlotTime(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TIMEZONE,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatShortDate(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TIMEZONE,
    month: "short",
    day: "numeric",
  }).format(new Date(iso));
}
