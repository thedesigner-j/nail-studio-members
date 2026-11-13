import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data";
import { getMyProjects, type TechProjectRow } from "@/lib/skill-projects-data";
import { SKILL_TYPES } from "@/lib/skill-projects";
import { todayInBusinessTimezone } from "@/lib/timezone";
import { DueAndPriority, SkillChips, StatusBadge } from "@/components/skill-projects/parts";

const TABS = [
  { key: "todo", label: "To do", statuses: ["assigned", "in_progress", "needs_another_try"] },
  { key: "submitted", label: "Submitted", statuses: ["submitted"] },
  { key: "completed", label: "Completed", statuses: ["approved"] },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default async function MyProjectsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const profile = await getCurrentProfile();
  if (!profile) return null;
  if (!profile.is_tech) redirect("/dashboard");

  const activeTab: TabKey = TABS.some((t) => t.key === tab) ? (tab as TabKey) : "todo";
  const projects = await getMyProjects(profile.id);
  const byTab = Object.fromEntries(
    TABS.map((t) => [t.key, projects.filter((p) => (t.statuses as readonly string[]).includes(p.status))]),
  ) as Record<TabKey, TechProjectRow[]>;
  const todayIso = todayInBusinessTimezone();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">My Projects</h1>
        <p className="mt-1 text-sm text-neutral-500">Practice projects from the studio. Every approved one goes in your portfolio.</p>
      </div>

      <div className="flex gap-1 border-b border-neutral-200">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/my-projects?tab=${t.key}`}
            className={activeTab === t.key ? "tab-link-active" : "tab-link"}
          >
            {t.label}
            {byTab[t.key].length > 0 && <span className="ml-1 text-neutral-400">{byTab[t.key].length}</span>}
          </Link>
        ))}
      </div>

      {activeTab === "completed" ? (
        <Portfolio projects={byTab.completed} />
      ) : byTab[activeTab].length === 0 ? (
        <p className="text-sm text-neutral-500">
          {activeTab === "todo"
            ? "Nothing to do right now. New projects from the studio will show up here."
            : "Nothing waiting for review."}
        </p>
      ) : (
        <ul className="space-y-3">
          {byTab[activeTab].map((project) => (
            <li key={project.id}>
              <Link
                href={`/my-projects/${project.id}`}
                className="block space-y-2 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm shadow-neutral-900/5 hover:border-neutral-300"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="flex items-center gap-2 font-medium text-neutral-900">
                    {project.isNew && <span aria-label="New" className="h-2 w-2 shrink-0 rounded-full bg-rose-500" />}
                    {project.title}
                  </p>
                  <StatusBadge status={project.status} />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <SkillChips skillTypes={project.skillTypes} />
                  <DueAndPriority dueDate={project.dueDate} priority={project.priority} todayIso={todayIso} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Approved work, grouped by skill type. A project with several skill types
// appears under each.
function Portfolio({ projects }: { projects: TechProjectRow[] }) {
  if (projects.length === 0) {
    return <p className="text-sm text-neutral-500">Approved projects build your portfolio here.</p>;
  }

  return (
    <div className="space-y-8">
      {SKILL_TYPES.map((skill) => {
        const items = projects.filter((p) => p.skillTypes.includes(skill.key));
        if (items.length === 0) return null;
        return (
          <section key={skill.key} className="space-y-3">
            <h2 className="font-medium text-neutral-900">
              {skill.label} <span className="text-neutral-400">{items.length}</span>
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {items.map((project) => (
                <Link
                  key={project.id}
                  href={`/my-projects/${project.id}`}
                  className="group relative overflow-hidden rounded-2xl border border-neutral-200 bg-white"
                >
                  {project.portfolioPhotoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- signed URL of unknown size
                    <img
                      src={project.portfolioPhotoUrl}
                      alt={project.title}
                      className="aspect-square w-full object-cover transition-transform group-hover:scale-[1.02]"
                    />
                  ) : (
                    <div className="flex aspect-square items-center justify-center bg-neutral-100 px-3 text-center text-xs text-neutral-500">
                      Video project
                    </div>
                  )}
                  <p className="truncate px-3 py-2 text-sm font-medium text-neutral-900">{project.title}</p>
                </Link>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
