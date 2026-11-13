import { getAllServices, getCurrentProfile } from "@/lib/data";
import { getLookBookPhotosForPicker, getTechAccounts } from "@/lib/skill-projects-data";
import { createSkillProject } from "../actions";
import ProjectForm from "../project-form";
import { EMPTY_PROJECT } from "../form-defaults";

export default async function NewSkillProjectPage({
  searchParams,
}: {
  // ?photo=<visit photo id> comes from "Make a practice project" on the Look Book.
  searchParams: Promise<{ photo?: string }>;
}) {
  const { photo } = await searchParams;
  const [profile, techs, services, lookbookPhotos] = await Promise.all([
    getCurrentProfile(),
    getTechAccounts(),
    getAllServices(),
    getLookBookPhotosForPicker(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">New skill project</h1>
        <p className="mt-1 text-sm text-neutral-500">The tech is notified in the app as soon as you create it.</p>
      </div>

      <ProjectForm
        action={createSkillProject}
        initial={{ ...EMPTY_PROJECT, referenceLookbookPhotoId: photo ?? null }}
        techs={techs}
        services={services.map((s) => ({ id: s.id, name: s.name }))}
        lookbookPhotos={lookbookPhotos}
        adminId={profile?.id ?? ""}
        submitLabel="Create project"
      />
    </div>
  );
}
