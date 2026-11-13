// Shared constants and pure helpers for Skill Projects. Safe to import from
// client components: no database access here (that's in skill-projects-data).

export const SKILL_PROJECTS_BUCKET = "skill-projects";

export const MAX_SUBMISSION_PHOTOS = 10;
export const MAX_SUBMISSION_VIDEO_LINKS = 2;

export const SKILL_TYPES = [
  { key: "nails", label: "Nails" },
  { key: "photography", label: "Photography" },
  { key: "video", label: "Video" },
  { key: "social_graphics", label: "Social graphics" },
] as const;

export type SkillType = (typeof SKILL_TYPES)[number]["key"];

export const SKILL_TYPE_LABEL: Record<string, string> = Object.fromEntries(
  SKILL_TYPES.map((t) => [t.key, t.label]),
);

export const PROJECT_STATUSES = [
  { key: "assigned", label: "Assigned" },
  { key: "in_progress", label: "In progress" },
  { key: "submitted", label: "Submitted" },
  { key: "needs_another_try", label: "Needs another try" },
  { key: "approved", label: "Approved" },
] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number]["key"];

export const STATUS_LABEL: Record<string, string> = Object.fromEntries(
  PROJECT_STATUSES.map((s) => [s.key, s.label]),
);

export const STATUS_BADGE_CLASS: Record<string, string> = {
  assigned: "bg-sky-50 text-sky-700",
  in_progress: "bg-violet-50 text-violet-700",
  submitted: "bg-amber-50 text-amber-700",
  needs_another_try: "bg-rose-50 text-rose-700",
  approved: "bg-emerald-50 text-emerald-700",
};

export const PRIORITIES = [
  { key: "low", label: "Low" },
  { key: "normal", label: "Normal" },
  { key: "high", label: "High" },
] as const;

export const PRIORITY_LABEL: Record<string, string> = Object.fromEntries(
  PRIORITIES.map((p) => [p.key, p.label]),
);

const PRIORITY_RANK: Record<string, number> = { high: 0, normal: 1, low: 2 };

// Statuses the tech can still submit work from.
export const SUBMITTABLE_STATUSES: readonly string[] = ["assigned", "in_progress", "needs_another_try"];

// Tech's list order: soonest due date first (no due date last), then
// highest priority, then newest.
export function compareForTechList(
  a: { due_date: string | null; priority: string; created_at: string },
  b: { due_date: string | null; priority: string; created_at: string },
) {
  if (a.due_date !== b.due_date) {
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    return a.due_date < b.due_date ? -1 : 1;
  }
  const byPriority = (PRIORITY_RANK[a.priority] ?? 1) - (PRIORITY_RANK[b.priority] ?? 1);
  if (byPriority !== 0) return byPriority;
  return b.created_at.localeCompare(a.created_at);
}

// due_date is a plain calendar date ("2026-11-20"), not an instant, so it's
// formatted in UTC to keep it from shifting a day in Pacific time.
export function formatDueDate(date: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric" }).format(
    new Date(`${date}T00:00:00Z`),
  );
}

export function isOverdue(date: string | null, todayIso: string) {
  return !!date && date < todayIso;
}

export function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

// Returns an embeddable player URL for YouTube links (watch, youtu.be,
// shorts, embed), or null for anything else.
export function youtubeEmbedUrl(value: string): string | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\.|^m\./, "");
  let id: string | null = null;

  if (host === "youtu.be") {
    id = url.pathname.slice(1).split("/")[0] || null;
  } else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (url.pathname === "/watch") id = url.searchParams.get("v");
    else {
      const match = url.pathname.match(/^\/(shorts|embed|live)\/([^/?]+)/);
      id = match?.[2] ?? null;
    }
  }

  return id && /^[\w-]{6,}$/.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : null;
}

export function linkHostname(value: string) {
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return value;
  }
}

export function looksLikeImageUrl(value: string) {
  try {
    return /\.(jpe?g|png|webp|gif|avif)$/i.test(new URL(value).pathname);
  } catch {
    return false;
  }
}
