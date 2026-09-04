import Link from "next/link";
import Image from "next/image";
import {
  getCurrentProfile,
  getUpcomingAppointments,
  getCalendarConnection,
  getVisitCount,
  getCreditBalance,
  getLifetimeEarned,
} from "@/lib/data";
import { formatAppointmentTime, formatCurrency, formatDollars } from "@/lib/format";
import { getTierProgress } from "@/lib/loyalty-tiers";

export default async function DashboardPage() {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  const [upcoming, calendarConnection, visitCount, creditBalance, lifetimeEarned] = await Promise.all([
    getUpcomingAppointments(profile.id),
    getCalendarConnection(profile.id),
    getVisitCount(profile.id),
    getCreditBalance(profile.id),
    getLifetimeEarned(profile.id),
  ]);

  const tier = getTierProgress(lifetimeEarned);

  const nextAppointment = upcoming[0];
  const initial = profile.full_name?.[0]?.toUpperCase() ?? "?";

  return (
    <div className="space-y-8">
      <div className="gradient-hero overflow-hidden rounded-3xl border border-neutral-200">
        <div className="h-24 sm:h-28" />
        <div className="px-6 pb-6 sm:px-8 sm:pb-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-end gap-4">
              <div className="relative -mt-14 h-24 w-24 shrink-0 overflow-hidden rounded-2xl border-4 border-white bg-neutral-900 text-2xl font-semibold text-white shadow-lg sm:h-28 sm:w-28">
                {profile.avatar_url ? (
                  <Image src={profile.avatar_url} alt="" fill unoptimized className="object-cover" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center">{initial}</span>
                )}
              </div>
              <div className="pb-1">
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-semibold text-neutral-900 sm:text-2xl">
                    {profile.full_name ?? "Member"}
                  </h1>
                  <span className="badge bg-neutral-900 text-white">
                    {tier.current.emoji} {tier.current.name}
                  </span>
                </div>
                <p className="mt-0.5 text-sm text-neutral-500">{profile.email}</p>
              </div>
            </div>

            <div className="flex gap-2">
              <Link href="/book" className="btn-primary">
                Book appointment
              </Link>
              <Link href="/messages" className="btn-secondary">
                Message us
              </Link>
            </div>
          </div>

          <div className="mt-6 flex gap-8 border-t border-neutral-200/70 pt-5">
            <div>
              <p className="text-2xl font-semibold text-neutral-900">{formatDollars(creditBalance)}</p>
              <p className="text-sm text-neutral-500">Credit balance</p>
            </div>
            <div>
              <p className="text-2xl font-semibold text-neutral-900">{visitCount}</p>
              <p className="text-sm text-neutral-500">Visits</p>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between">
          <h2 className="font-medium text-neutral-900">Next appointment</h2>
          <Link href="/appointments" className="text-sm font-medium text-neutral-600 underline">
            View all
          </Link>
        </div>

        {nextAppointment ? (
          <div className="mt-3 flex items-center justify-between">
            <div>
              <p className="font-medium text-neutral-900">{nextAppointment.services?.name}</p>
              <p className="text-sm text-neutral-500">
                {formatAppointmentTime(nextAppointment.starts_at)}
              </p>
            </div>
            <p className="text-sm text-neutral-500">
              {formatCurrency(nextAppointment.price_cents)}
            </p>
          </div>
        ) : (
          <div className="mt-3 flex items-center justify-between">
            <p className="text-sm text-neutral-500">No upcoming appointments.</p>
            <Link href="/book" className="btn-primary btn-sm">
              Book now
            </Link>
          </div>
        )}
      </div>

      <div className="card">
        <div className="flex items-center justify-between">
          <h2 className="font-medium text-neutral-900">Loyalty & credit</h2>
          <Link href="/loyalty" className="text-sm font-medium text-neutral-600 underline">
            View details
          </Link>
        </div>
        <p className="mt-1 text-sm text-neutral-500">
          Refer a friend, share a promo, or leave a review to earn account credit.
        </p>
      </div>

      {!calendarConnection && (
        <div className="card border-dashed">
          <h2 className="font-medium text-neutral-900">Sync with Google Calendar</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Connect your Google account so appointments automatically appear on your calendar.
          </p>
          <a href="/api/calendar/connect" className="btn-secondary btn-sm mt-3 inline-flex">
            Connect Google Calendar
          </a>
        </div>
      )}
    </div>
  );
}
