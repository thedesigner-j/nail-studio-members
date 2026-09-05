import {
  getActiveServices,
  getCurrentProfile,
  getCreditBalance,
  getBookingSettings,
  getBusinessHours,
  getMyCollections,
} from "@/lib/data";
import BookingForm from "./booking-form";

export default async function BookPage({
  searchParams,
}: {
  searchParams: Promise<{ depositCancelled?: string }>;
}) {
  const { depositCancelled } = await searchParams;
  const profile = await getCurrentProfile();
  if (!profile) return null;

  const [services, creditBalance, bookingSettings, businessHours, collections] = await Promise.all([
    getActiveServices(),
    getCreditBalance(profile.id),
    getBookingSettings(),
    getBusinessHours(),
    getMyCollections(profile.id),
  ]);
  const openDaysOfWeek = businessHours.map((h) => h.day_of_week);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Book an appointment</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Pick a service, then a date and time that works for you.
        </p>
      </div>

      {depositCancelled && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
          Deposit payment was cancelled — your slot wasn&apos;t held. Feel free to try again.
        </p>
      )}

      <BookingForm
        services={services}
        creditBalance={creditBalance}
        depositPercent={bookingSettings?.deposit_percent ?? 20}
        cancellationRefundHours={bookingSettings?.cancellation_refund_hours ?? 24}
        openDaysOfWeek={openDaysOfWeek}
        collections={collections.map((c) => ({ id: c.id, name: c.name }))}
        userId={profile.id}
      />
    </div>
  );
}
