import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data";
import { getProjectForTech } from "@/lib/skill-projects-data";
import { SUBMITTABLE_STATUSES } from "@/lib/skill-projects";
import { formatAppointmentTime } from "@/lib/format";
import { todayInBusinessTimezone } from "@/lib/timezone";
import {
  DueAndPriority,
  GoalsChecklist,
  ReferenceView,
  SkillChips,
  StatusBadge,
  SubmissionMedia,
  VideoLink,
} from "@/components/skill-projects/parts";
import { MarkSeen, StartButton } from "./client-bits";

const REVIEW_LABEL = { pending: "Waiting for review", approved: "Approved", sent_back: "Sent back" } as const;

export default async function MyProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ submitted?: string }>;
}) {
  const [{ id }, { submitted }] = await Promise.all([params, searchParams]);
  const profile = await getCurrentProfile();
  if (!profile) return null;
  if (!profile.is_tech) redirect("/dashboard");

  const project = await getProjectForTech(id, profile.id);
  if (!project) notFound();

  const latest = project.submissions[0];
  const canSubmit = SUBMITTABLE_STATUSES.includes(project.status);
  const latestFeedback = latest?.reviewStatus !== "pending" ? latest?.feedback : null;

  return (
    <div className="space-y-6">
      <MarkSeen projectId={project.id} />

      <Link href="/my-projects" className="text-sm font-medium text-neutral-500 hover:text-neutral-900">
        ← My Projects
      </Link>

      {submitted && (
        <p className="rounded-xl bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-700">
          Submitted! The studio will review it, and any feedback will show up here.
        </p>
      )}

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold text-neutral-900">{project.title}</h1>
          <StatusBadge status={project.status} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SkillChips skillTypes={project.skillTypes} />
          <DueAndPriority dueDate={project.dueDate} priority={project.priority} todayIso={todayInBusinessTimezone()} />
        </div>
        {project.linkedService && (
          <p className="text-sm text-neutral-500">Builds toward offering {project.linkedService.name}.</p>
        )}
      </div>

      {project.status === "needs_another_try" && latestFeedback && (
        <section className="rounded-2xl border border-rose-200 bg-rose-50 p-5">
          <p className="text-sm font-semibold text-rose-800">Feedback on attempt {latest.attemptNumber}</p>
          <p className="mt-1 whitespace-pre-line text-sm text-rose-900">{latestFeedback}</p>
        </section>
      )}

      {project.status === "approved" && (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
          <p className="text-sm font-semibold text-emerald-800">Approved. Nice work!</p>
          {latestFeedback && <p className="mt-1 whitespace-pre-line text-sm text-emerald-900">{latestFeedback}</p>}
        </section>
      )}

      <section className="card space-y-3">
        <h2 className="font-medium text-neutral-900">Reference</h2>
        <ReferenceView reference={project.reference} />
      </section>

      {canSubmit && (
        <div className="flex flex-wrap gap-2">
          <Link href={`/my-projects/${project.id}/submit`} className="btn-primary">
            {project.status === "needs_another_try" ? "Submit another try" : "Submit work"}
          </Link>
          {project.status === "assigned" && <StartButton projectId={project.id} />}
        </div>
      )}
      {project.status === "submitted" && (
        <p className="text-sm text-neutral-500">Submitted. Waiting for the studio to review it.</p>
      )}

      {project.links.length > 0 && (
        <section className="card space-y-3">
          <h2 className="font-medium text-neutral-900">Tutorials</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {project.links.map((link) => (
              <VideoLink key={link.id} url={link.url} label={link.label} />
            ))}
          </div>
        </section>
      )}

      {(project.goals.length > 0 || project.instructions) && (
        <section className="card space-y-5">
          {project.goals.length > 0 && (
            <div className="space-y-2">
              <h2 className="font-medium text-neutral-900">Goals</h2>
              <GoalsChecklist goals={project.goals} />
            </div>
          )}
          {project.instructions && (
            <div className="space-y-1">
              <h2 className="font-medium text-neutral-900">Instructions</h2>
              <p className="whitespace-pre-line text-sm text-neutral-700">{project.instructions}</p>
            </div>
          )}
        </section>
      )}

      {project.submissions.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-medium text-neutral-900">Your attempts</h2>
          {project.submissions.map((submission) => (
            <details key={submission.id} className="card" open={submission === latest}>
              <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-neutral-900">
                  Attempt {submission.attemptNumber}
                  <span className="ml-2 text-sm font-normal text-neutral-500">
                    {formatAppointmentTime(submission.submittedAt)}
                  </span>
                </span>
                <span className="text-sm text-neutral-500">{REVIEW_LABEL[submission.reviewStatus]}</span>
              </summary>
              <div className="mt-4 space-y-4">
                <SubmissionMedia submission={submission} />
                {project.goals.length > 0 && <GoalsChecklist goals={project.goals} checked={submission.goalsChecked} />}
                {submission.note && (
                  <p className="whitespace-pre-line text-sm text-neutral-700">
                    <span className="font-medium">Your note: </span>
                    {submission.note}
                  </p>
                )}
                {submission.feedback && (
                  <p className="whitespace-pre-line rounded-xl bg-neutral-50 px-3.5 py-2.5 text-sm text-neutral-700">
                    <span className="font-medium">Studio feedback: </span>
                    {submission.feedback}
                  </p>
                )}
              </div>
            </details>
          ))}
        </section>
      )}
    </div>
  );
}
