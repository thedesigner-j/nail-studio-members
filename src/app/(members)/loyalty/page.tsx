import {
  getCurrentProfile,
  getCreditBalance,
  getLifetimeEarned,
  getCreditHistory,
  getReferralInvites,
  getActiveReviewPlatforms,
  getMyReviewSubmissions,
  getMyRepostSubmissions,
  getClaimableShareablePosts,
} from "@/lib/data";
import { formatDollars, formatShortDate } from "@/lib/format";
import { getTierProgress, TIERS } from "@/lib/loyalty-tiers";
import ReferralForm from "./referral-form";
import ReviewForm from "./review-form";
import RepostForm from "./repost-form";

const SOURCE_META: Record<string, { label: string; emoji: string }> = {
  account_creation: { label: "Joined the studio", emoji: "🎉" },
  session: { label: "Visit cash back", emoji: "💅" },
  referral: { label: "Referral bonus", emoji: "🤝" },
  repost: { label: "Shared a promo", emoji: "📱" },
  review: { label: "Left a review", emoji: "⭐" },
  manual: { label: "Bonus credit", emoji: "🎁" },
};

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  confirmed: "bg-emerald-100 text-emerald-700",
  redeemed: "bg-neutral-100 text-neutral-500",
  expired: "bg-neutral-100 text-neutral-400",
  rejected: "bg-rose-100 text-rose-700",
};

export default async function LoyaltyPage() {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  const [balance, lifetimeEarned, history, invites, platforms, reviewSubmissions, repostSubmissions, claimablePosts] =
    await Promise.all([
      getCreditBalance(profile.id),
      getLifetimeEarned(profile.id),
      getCreditHistory(profile.id),
      getReferralInvites(profile.id),
      getActiveReviewPlatforms(),
      getMyReviewSubmissions(profile.id),
      getMyRepostSubmissions(profile.id),
      getClaimableShareablePosts(profile.id),
    ]);

  const tier = getTierProgress(lifetimeEarned);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Loyalty</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Earn account credit and use it at checkout — the more you visit and share, the more you save.
        </p>
      </div>

      <div className="gradient-hero overflow-hidden rounded-3xl border border-neutral-200 p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="badge bg-neutral-900 text-white">
              {tier.current.emoji} {tier.current.name}
            </span>
            <p className="mt-3 text-sm text-neutral-500">Available credit</p>
            <p className="text-4xl font-semibold text-neutral-900">{formatDollars(balance)}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-neutral-500">Lifetime earned</p>
            <p className="text-2xl font-semibold text-neutral-900">{formatDollars(lifetimeEarned)}</p>
          </div>
        </div>

        <div className="mt-6">
          {tier.next ? (
            <>
              <div className="flex items-center justify-between text-xs text-neutral-500">
                <span>
                  {tier.current.emoji} {tier.current.name}
                </span>
                <span>
                  {formatDollars(tier.amountToNext)} to {tier.next.emoji} {tier.next.name}
                </span>
              </div>
              <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-white/60">
                <div
                  className="h-full rounded-full bg-neutral-900 transition-all"
                  style={{ width: `${tier.progressPercent}%` }}
                />
              </div>
            </>
          ) : (
            <p className="text-sm font-medium text-neutral-700">
              👑 You&apos;ve hit the top tier — thanks for being a regular!
            </p>
          )}
        </div>

        <div className="mt-5 flex gap-3 border-t border-neutral-200/70 pt-4 text-xs text-neutral-400">
          {TIERS.map((t) => (
            <span
              key={t.name}
              className={lifetimeEarned >= t.minEarned ? "font-medium text-neutral-700" : ""}
            >
              {t.emoji} {t.name}
            </span>
          ))}
        </div>
      </div>

      <div>
        <h2 className="mb-3 font-medium text-neutral-900">Ways to earn</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="card">
            <p className="font-medium text-neutral-900">🤝 Refer a friend</p>
            <p className="mt-1 text-sm text-neutral-500">
              Get a link and send it however you like. Credit lands once they complete and pay for
              their first visit.
            </p>
            <div className="mt-3">
              <ReferralForm />
            </div>

            {invites.length > 0 && (
              <ul className="mt-4 space-y-1 border-t border-neutral-100 pt-3">
                {invites.map((invite) => (
                  <li key={invite.id} className="flex items-center justify-between text-sm">
                    <span className="text-neutral-500">Sent {formatShortDate(invite.created_at)}</span>
                    <span className={`badge ${STATUS_STYLE[invite.status] ?? STATUS_STYLE.pending}`}>
                      {invite.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="card">
            <p className="font-medium text-neutral-900">📱 Share a promo</p>
            <p className="mt-1 text-sm text-neutral-500">
              Share one of these on social and mark it done to submit for review.
            </p>
            <div className="mt-3">
              <RepostForm posts={claimablePosts} />
            </div>

            {repostSubmissions.length > 0 && (
              <ul className="mt-4 space-y-1 border-t border-neutral-100 pt-3">
                {repostSubmissions.map((s) => (
                  <li key={s.id} className="flex items-center justify-between text-sm">
                    <span className="text-neutral-500">{s.announcements?.title ?? "Post"}</span>
                    <span className={`badge ${STATUS_STYLE[s.status] ?? STATUS_STYLE.pending}`}>
                      {s.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="card">
            <p className="font-medium text-neutral-900">⭐ Leave a review</p>
            <p className="mt-1 text-sm text-neutral-500">
              Submit a link to your review, or a screenshot — an admin will confirm it.
            </p>
            <div className="mt-3">
              <ReviewForm platforms={platforms} />
            </div>

            {reviewSubmissions.length > 0 && (
              <ul className="mt-4 space-y-1 border-t border-neutral-100 pt-3">
                {reviewSubmissions.map((s) => (
                  <li key={s.id} className="flex items-center justify-between text-sm">
                    <span className="text-neutral-500">{s.review_platforms?.name ?? "Platform"}</span>
                    <span className={`badge ${STATUS_STYLE[s.status] ?? STATUS_STYLE.pending}`}>
                      {s.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <div>
        <h2 className="mb-3 font-medium text-neutral-900">Your earning journey</h2>
        {history.length === 0 ? (
          <p className="text-sm text-neutral-500">
            Nothing yet — book a visit or refer a friend to get your first credit.
          </p>
        ) : (
          <ul className="space-y-2">
            {history.map((credit) => {
              const meta = SOURCE_META[credit.source_type] ?? { label: credit.source_type, emoji: "💰" };
              return (
                <li key={credit.id} className="card flex items-center gap-3">
                  <span className="text-2xl">{meta.emoji}</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-neutral-900">{meta.label}</p>
                    <p className="text-xs text-neutral-400">
                      Earned {formatShortDate(credit.earned_at)} · Expires{" "}
                      {formatShortDate(credit.expires_at)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-emerald-600">+{formatDollars(credit.amount)}</p>
                    <span className={`badge ${STATUS_STYLE[credit.status] ?? STATUS_STYLE.pending}`}>
                      {credit.status}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
