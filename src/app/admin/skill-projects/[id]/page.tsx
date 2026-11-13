import Link from "next/link";
import { notFound } from "next/navigation";
import { getProjectForAdmin } from "@/lib/skill-projects-data";
import type { Submission } from "@/lib/skill-projects-data";
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
import ReviewPanel from "./review-panel";
import ArchiveButton from "./archive-button";

const REVIEW_LABEL: Record<Submission["reviewStatus"], string> = {
  pending: "Waiting for review",
  approved: "Approved",
  sent_back: "Sent back",
};

export default async function AdminSkillProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string; saved?: string }>;
}) {
  const [{ id }, { created, saved }] = await Promise.all([params, searchParams]);
  const project = await getProjectForAdmin(id);
  if (!project) notFound();

  const latest = project.submissions[0];
  const awaitingReview = latest?.reviewStatus === "pending" && !project.archivedAt;
  const earlier = awaitingReview ? project.submissions.slice(1) : project.submissions;

  return (
    <div className="space-y-6">
      <Link href="/admin/skill-projects" className="text-sm font-medium text-neutral-500 hover:text-neutral-900">
        ← Skill Projects
      </Link>

      {(created || saved) && (
        <p className="rounded-xl bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-700">
          {created ? `Project created. ${project.assignedTo.name} will see it in My Projects.` : "Changes saved."}
        </p>
      )}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold text-neutral-900">{project.title}</h1>
            <StatusBadge status={project.status} archived={!!project.archivedAt} />
          </div>
          <p className="text-sm text-neutral-500">
            Assigned to {project.assignedTo.name}
            {project.linkedService && <> · builds toward {project.linkedService.name}</>}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <SkillChips skillTypes={project.skillTypes} />
            <DueAndPriority dueDate={project.dueDate} priority={project.priority} todayIso={todayInBusinessTimezone()} />
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/admin/skill-projects/${project.id}/edit`} className="btn-secondary btn-sm">
            Edit
          </Link>
          <ArchiveButton projectId={project.id} archived={!!project.archivedAt} />
        </div>
      </div>

      {awaitingReview ? (
        <section className="card space-y-5 border-amber-200">
          <h2 className="font-medium text-neutral-900">Review attempt {latest.attemptNumber}</h2>
          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Reference</p>
              <ReferenceView reference={project.reference} />
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                Submitted {formatAppointmentTime(latest.submittedAt)}
              </p>
              <SubmissionMedia submission={latest} />
            </div>
          </div>

          {project.goals.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Goals the tech ticked</p>
              <GoalsChecklist goals={project.goals} checked={latest.goalsChecked} />
            </div>
          )}

          {latest.note && (
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Tech&apos;s note</p>
              <p className="whitespace-pre-line text-sm text-neutral-700">{latest.note}</p>
            </div>
          )}

          <ReviewPanel projectId={project.id} submissionId={latest.id} />
        </section>
      ) : (
        <section className="card space-y-3">
          <h2 className="font-medium text-neutral-900">Reference</h2>
          <ReferenceView reference={project.reference} />
          {project.submissions.length === 0 && !project.archivedAt && (
            <p className="text-sm text-neutral-500">
              {project.status === "in_progress"
                ? `${project.assignedTo.name} has started working on this.`
                : `Waiting for ${project.assignedTo.name} to submit an attempt.`}
            </p>
          )}
        </section>
      )}

      {(project.links.length > 0 || project.instructions || (!awaitingReview && project.goals.length > 0)) && (
        <section className="card space-y-5">
          {!awaitingReview && project.goals.length > 0 && (
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
          {project.links.length > 0 && (
            <div className="space-y-3">
              <h2 className="font-medium text-neutral-900">Learning links</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {project.links.map((link) => (
                  <VideoLink key={link.id} url={link.url} label={link.label} />
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {earlier.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-medium text-neutral-900">{awaitingReview ? "Earlier attempts" : "Attempts"}</h2>
          {earlier.map((submission) => (
            <details key={submission.id} className="card group" open={!awaitingReview && submission === earlier[0]}>
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
                {project.goals.length > 0 && (
                  <GoalsChecklist goals={project.goals} checked={submission.goalsChecked} />
                )}
                {submission.note && (
                  <p className="whitespace-pre-line text-sm text-neutral-700">
                    <span className="font-medium">Note: </span>
                    {submission.note}
                  </p>
                )}
                {submission.feedback && (
                  <p className="whitespace-pre-line rounded-xl bg-neutral-50 px-3.5 py-2.5 text-sm text-neutral-700">
                    <span className="font-medium">Your feedback: </span>
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
