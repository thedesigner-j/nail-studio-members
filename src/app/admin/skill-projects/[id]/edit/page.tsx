import { notFound } from "next/navigation";
import { getAllServices, getCurrentProfile } from "@/lib/data";
import { getLookBookPhotosForPicker, getProjectForAdmin, getTechAccounts } from "@/lib/skill-projects-data";
import { updateSkillProject } from "../../actions";
import ProjectForm from "../../project-form";

export default async function EditSkillProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [project, profile, techs, services, lookbookPhotos] = await Promise.all([
    getProjectForAdmin(id),
    getCurrentProfile(),
    getTechAccounts(),
    getAllServices(),
    getLookBookPhotosForPicker(),
  ]);
  if (!project) notFound();

  // Keep the current tech in the list even if they've since lost the role,
  // so other edits can still be saved (the action allows that one case).
  const techOptions = techs.some((t) => t.id === project.assignedTo.id)
    ? techs
    : [...techs, { id: project.assignedTo.id, name: `${project.assignedTo.name} (no longer a tech)` }];

  const referenceType = project.raw.referenceType as "lookbook" | "upload" | "link";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Edit project</h1>
        <p className="mt-1 text-sm text-neutral-500">{project.title}</p>
      </div>

      <ProjectForm
        action={updateSkillProject}
        initial={{
          projectId: project.id,
          title: project.title,
          skillTypes: project.skillTypes,
          assignedTo: project.assignedTo.id,
          referenceType,
          referenceLookbookPhotoId: project.raw.referenceLookbookPhotoId,
          referenceRemoved: referenceType === "lookbook" && !project.raw.referenceLookbookPhotoId,
          referenceStoragePath: project.raw.referenceStoragePath,
          referencePreviewUrl: project.reference.kind === "upload" ? project.reference.imageUrl : null,
          referenceUrl: project.raw.referenceUrl ?? "",
          links: project.links.map((l) => ({ url: l.url, label: l.label ?? "" })),
          goals: project.goals.map((g) => ({ id: g.id, text: g.text })),
          instructions: project.instructions ?? "",
          dueDate: project.dueDate ?? "",
          priority: project.priority,
          linkedServiceId: project.raw.linkedServiceId ?? "",
        }}
        techs={techOptions}
        services={services.map((s) => ({ id: s.id, name: s.name }))}
        lookbookPhotos={lookbookPhotos}
        adminId={profile?.id ?? ""}
        submitLabel="Save changes"
      />
    </div>
  );
}
