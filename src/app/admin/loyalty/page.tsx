import Link from "next/link";
import {
  getRewardSettings,
  getAllAnnouncements,
  getAllReviewPlatforms,
  getPendingReviewSubmissions,
  getPendingRepostSubmissions,
  getAllCreditsWithMember,
  getAllMembersForAdmin,
} from "@/lib/data";
import SettingsForm from "./settings-form";
import ShareablePostsList from "./shareable-posts-list";
import ReviewPlatformsList from "./review-platforms-list";
import ApprovalsQueue from "./approvals-queue";
import LedgerView from "./ledger-view";

const TABS = [
  { key: "settings", label: "Settings" },
  { key: "shareable", label: "Shareable Posts" },
  { key: "platforms", label: "Review Platforms" },
  { key: "approvals", label: "Approvals" },
  { key: "ledger", label: "Ledger" },
] as const;

export default async function AdminLoyaltyPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const activeTab = TABS.some((t) => t.key === tab) ? (tab as (typeof TABS)[number]["key"]) : "settings";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Loyalty</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Configure the dollar-credit rewards program: earn rates, shareable posts, review platforms,
          and pending submissions.
        </p>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-neutral-200">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/admin/loyalty?tab=${t.key}`}
            className={activeTab === t.key ? "tab-link-active" : "tab-link"}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {activeTab === "settings" && <SettingsTab />}
      {activeTab === "shareable" && <ShareableTab />}
      {activeTab === "platforms" && <PlatformsTab />}
      {activeTab === "approvals" && <ApprovalsTab />}
      {activeTab === "ledger" && <LedgerTab />}
    </div>
  );
}

async function SettingsTab() {
  const settings = await getRewardSettings();
  if (!settings) return <p className="text-sm text-red-600">Reward settings row is missing.</p>;
  return <SettingsForm settings={settings} />;
}

async function ShareableTab() {
  const posts = await getAllAnnouncements();
  return <ShareablePostsList posts={posts} />;
}

async function PlatformsTab() {
  const platforms = await getAllReviewPlatforms();
  return <ReviewPlatformsList platforms={platforms} />;
}

async function ApprovalsTab() {
  const [reviewSubmissions, repostSubmissions] = await Promise.all([
    getPendingReviewSubmissions(),
    getPendingRepostSubmissions(),
  ]);
  return <ApprovalsQueue reviewSubmissions={reviewSubmissions} repostSubmissions={repostSubmissions} />;
}

async function LedgerTab() {
  const [credits, members] = await Promise.all([getAllCreditsWithMember(), getAllMembersForAdmin()]);
  return <LedgerView credits={credits} members={members} />;
}
