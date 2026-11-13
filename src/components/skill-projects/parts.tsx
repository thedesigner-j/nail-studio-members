// Display pieces shared by the admin and tech Skill Projects screens. No
// hooks, so they render on the server.
import type { ProjectReference, Submission } from "@/lib/skill-projects-data";
import {
  PRIORITY_LABEL,
  SKILL_TYPE_LABEL,
  STATUS_BADGE_CLASS,
  STATUS_LABEL,
  formatDueDate,
  linkHostname,
  looksLikeImageUrl,
  youtubeEmbedUrl,
} from "@/lib/skill-projects";

export function StatusBadge({ status, archived }: { status: string; archived?: boolean }) {
  if (archived) return <span className="badge bg-neutral-100 text-neutral-500">Archived</span>;
  return (
    <span className={`badge ${STATUS_BADGE_CLASS[status] ?? "bg-neutral-100 text-neutral-600"}`}>
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

export function SkillChips({ skillTypes }: { skillTypes: string[] }) {
  return (
    <span className="flex flex-wrap gap-1">
      {skillTypes.map((s) => (
        <span key={s} className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600">
          {SKILL_TYPE_LABEL[s] ?? s}
        </span>
      ))}
    </span>
  );
}

export function DueAndPriority({
  dueDate,
  priority,
  todayIso,
}: {
  dueDate: string | null;
  priority: string;
  todayIso: string;
}) {
  const overdue = !!dueDate && dueDate < todayIso;
  return (
    <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500">
      {dueDate && (
        <span className={overdue ? "font-medium text-rose-600" : ""}>
          {overdue ? "Overdue: " : "Due "}
          {formatDueDate(dueDate)}
        </span>
      )}
      {priority !== "normal" && (
        <span className={priority === "high" ? "font-medium text-neutral-900" : ""}>
          {PRIORITY_LABEL[priority]} priority
        </span>
      )}
    </span>
  );
}

export function ReferenceView({ reference }: { reference: ProjectReference }) {
  if (reference.kind === "link") {
    return (
      <div className="space-y-2">
        {looksLikeImageUrl(reference.url) && (
          // eslint-disable-next-line @next/next/no-img-element -- outside image of unknown size
          <img src={reference.url} alt="Reference" className="max-h-96 w-full rounded-xl object-contain bg-neutral-100" />
        )}
        <a
          href={reference.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200 px-4 py-3 text-sm hover:bg-neutral-50"
        >
          <span>
            <span className="block font-medium text-neutral-900">Open the reference</span>
            <span className="block text-xs text-neutral-500">{linkHostname(reference.url)}</span>
          </span>
          <span aria-hidden>↗</span>
        </a>
      </div>
    );
  }

  if (!reference.imageUrl) {
    return (
      <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-neutral-300 bg-neutral-50 px-6 text-center text-sm text-neutral-500">
        {reference.kind === "lookbook"
          ? "Reference removed. The member deleted this Look Book photo."
          : "Reference image unavailable."}
      </div>
    );
  }

  return (
    <a href={reference.imageUrl} target="_blank" rel="noopener noreferrer" className="block">
      {/* eslint-disable-next-line @next/next/no-img-element -- reference photos have unknown dimensions */}
      <img src={reference.imageUrl} alt="Reference" className="max-h-[28rem] w-full rounded-xl bg-neutral-100 object-contain" />
    </a>
  );
}

export function VideoLink({ url, label }: { url: string; label?: string | null }) {
  const embed = youtubeEmbedUrl(url);
  if (embed) {
    return (
      <div className="space-y-1">
        <div className="aspect-video overflow-hidden rounded-xl bg-neutral-900">
          <iframe
            src={embed}
            title={label ?? "Video"}
            className="h-full w-full"
            allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
        {label && <p className="text-sm font-medium text-neutral-900">{label}</p>}
      </div>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200 px-4 py-3 text-sm hover:bg-neutral-50"
    >
      <span className="min-w-0">
        <span className="block truncate font-medium text-neutral-900">{label || "Watch video"}</span>
        <span className="block truncate text-xs text-neutral-500">{linkHostname(url)}</span>
      </span>
      <span aria-hidden>↗</span>
    </a>
  );
}

export function GoalsChecklist({
  goals,
  checked,
}: {
  goals: { id: string; text: string }[];
  // Omit to show the goals without ticks (before anything is submitted).
  checked?: string[];
}) {
  if (goals.length === 0) return null;
  return (
    <ul className="space-y-1.5">
      {goals.map((goal) => {
        const done = checked?.includes(goal.id);
        return (
          <li key={goal.id} className="flex items-start gap-2 text-sm">
            <span
              aria-hidden
              className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] ${
                done ? "border-emerald-600 bg-emerald-600 text-white" : "border-neutral-300"
              }`}
            >
              {done ? "✓" : ""}
            </span>
            <span className={checked && !done ? "text-neutral-500" : "text-neutral-900"}>{goal.text}</span>
            {checked && <span className="sr-only">{done ? "(ticked)" : "(not ticked)"}</span>}
          </li>
        );
      })}
    </ul>
  );
}

export function SubmissionMedia({ submission }: { submission: Submission }) {
  return (
    <div className="space-y-3">
      {submission.photos.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {submission.photos.map((photo, i) =>
            photo.url ? (
              <a key={photo.id} href={photo.url} target="_blank" rel="noopener noreferrer" className="block">
                {/* eslint-disable-next-line @next/next/no-img-element -- signed URL of unknown dimensions */}
                <img
                  src={photo.url}
                  alt={`Attempt ${submission.attemptNumber}, photo ${i + 1}`}
                  className="aspect-square w-full rounded-xl bg-neutral-100 object-cover"
                />
              </a>
            ) : (
              <div key={photo.id} className="aspect-square rounded-xl bg-neutral-100" />
            ),
          )}
        </div>
      )}
      {submission.videoLinks.map((video) => (
        <VideoLink key={video.id} url={video.url} />
      ))}
    </div>
  );
}
