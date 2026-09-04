import { getActiveServices, getCurrentProfile, getCreditBalance } from "@/lib/data";
import BookingForm from "./booking-form";

export default async function BookPage() {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  const [services, creditBalance] = await Promise.all([
    getActiveServices(),
    getCreditBalance(profile.id),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Book an appointment</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Pick a service, then a date and time that works for you.
        </p>
      </div>

      <BookingForm services={services} creditBalance={creditBalance} />
    </div>
  );
}
