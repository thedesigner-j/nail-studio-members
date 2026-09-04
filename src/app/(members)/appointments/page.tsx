import Link from "next/link";
import {
  getCurrentProfile,
  getUpcomingAppointments,
  getAppointmentHistory,
  getPaymentHistory,
  getBookingSettings,
} from "@/lib/data";
import { formatAppointmentTime, formatCurrency } from "@/lib/format";
import AppointmentCard from "./appointment-card";

const TABS = [
  { key: "upcoming", label: "Upcoming" },
  { key: "history", label: "History" },
  { key: "payments", label: "Payments" },
] as const;

export default async function AppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; booked?: string }>;
}) {
  const { tab, booked } = await searchParams;
  const activeTab = TABS.some((t) => t.key === tab) ? (tab as (typeof TABS)[number]["key"]) : "upcoming";

  const profile = await getCurrentProfile();
  if (!profile) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">My appointments</h1>
        {booked && (
          <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            You&apos;re booked! We&apos;ll see you soon.
          </p>
        )}
      </div>

      <div className="flex gap-1 border-b border-neutral-200">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/appointments?tab=${t.key}`}
            className={activeTab === t.key ? "tab-link-active" : "tab-link"}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {activeTab === "payments" ? (
        <PaymentsList userId={profile.id} />
      ) : (
        <AppointmentsList userId={profile.id} tab={activeTab} />
      )}
    </div>
  );
}

async function AppointmentsList({ userId, tab }: { userId: string; tab: "upcoming" | "history" }) {
  const [appointments, bookingSettings] = await Promise.all([
    tab === "upcoming" ? getUpcomingAppointments(userId) : getAppointmentHistory(userId),
    getBookingSettings(),
  ]);
  const cancellationRefundHours = bookingSettings?.cancellation_refund_hours ?? 24;

  if (appointments.length === 0) {
    return (
      <p className="text-sm text-neutral-500">
        {tab === "upcoming" ? "No upcoming appointments." : "No past appointments yet."}
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {appointments.map((appt) => (
        <AppointmentCard
          key={appt.id}
          appointment={appt}
          userId={userId}
          cancellable={tab === "upcoming" && (appt.status === "confirmed" || appt.status === "pending_payment")}
          cancellationRefundHours={cancellationRefundHours}
          showPhotoUploader={tab === "history" && "visit_photos" in appt}
        />
      ))}
    </ul>
  );
}

async function PaymentsList({ userId }: { userId: string }) {
  const payments = await getPaymentHistory(userId);

  if (payments.length === 0) {
    return <p className="text-sm text-neutral-500">No payments recorded yet.</p>;
  }

  return (
    <ul className="space-y-3">
      {payments.map((payment) => (
        <li key={payment.id} className="card flex items-center justify-between">
          <div>
            <p className="font-medium text-neutral-900">
              {payment.appointments?.services?.name ?? "Payment"}
            </p>
            <p className="text-sm text-neutral-500">{formatAppointmentTime(payment.paid_at)}</p>
            <span className="badge mt-1 bg-neutral-100 text-neutral-600">
              {payment.method.replace("_", " ")} · {payment.status}
            </span>
          </div>
          <p className="text-sm font-medium text-neutral-900">
            {formatCurrency(payment.amount_cents)}
          </p>
        </li>
      ))}
    </ul>
  );
}
