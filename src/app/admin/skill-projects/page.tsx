import Link from "next/link";
import { getSkillProjectsForAdmin, getTechAccounts, getWaitingForReviewCount } from "@/lib/skill-projects-data";
import { DueAndPriority, SkillChips, StatusBadge } from "@/components/skill-projects/parts";
import { todayInBusinessTimezone } from "@/lib/timezone";
import ProjectFilters from "./filters";

export default async function AdminSkillProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; skill?: string; tech?: string }>;
}) {
  const filters = await searchParams;
  const [projects, techs, waitingCount] = await Promise.all([
    getSkillProjectsForAdmin(filters),
    getTechAccounts(),
    getWaitingForReviewCount(),
  ]);
  const todayIso = todayInBusinessTimezone();
  const filtered = !!(filters.status || filters.skill || filters.tech);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Skill Projects</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Practice projects for your techs: assign, review, and send back with feedback.
          </p>
        </div>
        <Link href="/admin/skill-projects/new" className="btn-primary">
          + New project
        </Link>
      </div>

      <Link
        href="/admin/skill-projects?status=submitted"
        className={`flex items-center justify-between rounded-2xl border px-5 py-4 ${
          waitingCount > 0 ? "border-amber-200 bg-amber-50" : "border-neutral-200 bg-white"
        }`}
      >
        <span className="text-sm font-medium text-neutral-900">Waiting for review</span>
        <span className={`text-2xl font-semibold ${waitingCount > 0 ? "text-amber-700" : "text-neutral-400"}`}>
          {waitingCount}
        </span>
      </Link>

      <ProjectFilters techs={techs} />

      {projects.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500">
          {filtered ? "No projects match those filters." : "No projects yet. Create one to get your tech practicing."}
        </p>
      ) : (
        <ul className="space-y-3">
          {projects.map((project) => (
            <li key={project.id}>
              <Link
                href={`/admin/skill-projects/${project.id}`}
                className="flex gap-3 rounded-2xl border border-neutral-200 bg-white p-3 shadow-sm shadow-neutral-900/5 hover:border-neutral-300"
              >
                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-neutral-100 text-xs text-neutral-400">
                  {project.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- reference thumbnail of unknown size
                    <img src={project.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    "Link ↗"
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="truncate font-medium text-neutral-900">{project.title}</p>
                    <StatusBadge status={project.status} archived={!!project.archivedAt} />
                  </div>
                  <p className="text-sm text-neutral-500">
                    {project.techName}
                    {project.attempts > 0 && ` · ${project.attempts} attempt${project.attempts === 1 ? "" : "s"}`}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <SkillChips skillTypes={project.skillTypes} />
                    <DueAndPriority dueDate={project.dueDate} priority={project.priority} todayIso={todayIso} />
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
