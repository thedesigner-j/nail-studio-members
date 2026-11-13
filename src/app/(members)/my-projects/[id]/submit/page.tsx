import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data";
import { getProjectForTech } from "@/lib/skill-projects-data";
import { SUBMITTABLE_STATUSES } from "@/lib/skill-projects";
import { ReferenceView } from "@/components/skill-projects/parts";
import SubmitForm from "./submit-form";

export default async function SubmitProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  if (!profile) return null;
  if (!profile.is_tech) redirect("/dashboard");

  const project = await getProjectForTech(id, profile.id);
  if (!project) notFound();
  if (!SUBMITTABLE_STATUSES.includes(project.status)) redirect(`/my-projects/${project.id}`);

  const attempt = (project.submissions[0]?.attemptNumber ?? 0) + 1;

  return (
    <div className="space-y-6">
      <Link href={`/my-projects/${project.id}`} className="text-sm font-medium text-neutral-500 hover:text-neutral-900">
        ← {project.title}
      </Link>

      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">
          {attempt > 1 ? `Submit attempt ${attempt}` : "Submit your work"}
        </h1>
        <p className="mt-1 text-sm text-neutral-500">{project.title}</p>
      </div>

      <details className="card">
        <summary className="cursor-pointer text-sm font-medium text-neutral-900">Show the reference</summary>
        <div className="mt-3">
          <ReferenceView reference={project.reference} />
        </div>
      </details>

      <SubmitForm projectId={project.id} userId={profile.id} goals={project.goals} />
    </div>
  );
}
