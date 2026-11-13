import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { SKILL_PROJECTS_BUCKET, compareForTechList } from "@/lib/skill-projects";

// Server-only loaders for Skill Projects. Admin pages read with the service
// role (the admin layout and requireAdmin() gate them, same as the rest of
// /admin). Tech pages read with the signed-in user's own client, so RLS
// decides what they can see; files are then signed with the service role.

type Client = Awaited<ReturnType<typeof createClient>> | ReturnType<typeof createServiceRoleClient>;

const SIGNED_URL_SECONDS = 60 * 60;

async function signPaths(paths: (string | null | undefined)[]) {
  const unique = [...new Set(paths.filter((p): p is string => !!p))];
  if (unique.length === 0) return new Map<string, string>();

  const { data } = await createServiceRoleClient()
    .storage.from(SKILL_PROJECTS_BUCKET)
    .createSignedUrls(unique, SIGNED_URL_SECONDS);

  return new Map(
    (data ?? []).filter((d) => d.path && d.signedUrl).map((d) => [d.path as string, d.signedUrl]),
  );
}

// === Shapes ==================================================================

export type ProjectReference =
  | { kind: "lookbook"; imageUrl: string | null }
  | { kind: "upload"; imageUrl: string | null }
  | { kind: "link"; url: string };

export type Submission = {
  id: string;
  attemptNumber: number;
  note: string | null;
  goalsChecked: string[];
  submittedAt: string;
  reviewStatus: "pending" | "approved" | "sent_back";
  feedback: string | null;
  reviewedAt: string | null;
  photos: { id: string; url: string | null }[];
  videoLinks: { id: string; url: string }[];
};

export type ProjectDetail = {
  id: string;
  title: string;
  skillTypes: string[];
  status: string;
  priority: string;
  dueDate: string | null;
  instructions: string | null;
  archivedAt: string | null;
  createdAt: string;
  assignedTo: { id: string; name: string };
  linkedService: { id: string; name: string } | null;
  reference: ProjectReference;
  links: { id: string; url: string; label: string | null }[];
  goals: { id: string; text: string }[];
  // Newest attempt first.
  submissions: Submission[];
  // Raw fields the edit form starts from.
  raw: {
    referenceType: string;
    referenceLookbookPhotoId: string | null;
    referenceStoragePath: string | null;
    referenceUrl: string | null;
    linkedServiceId: string | null;
  };
};

type SubmissionRow = {
  id: string;
  attempt_number: number;
  note: string | null;
  goals_checked: string[] | null;
  submitted_at: string;
  review_status: Submission["reviewStatus"];
  feedback: string | null;
  reviewed_at: string | null;
  skill_project_media: {
    id: string;
    media_type: "photo" | "video_link";
    storage_path: string | null;
    url: string | null;
    sort_order: number;
  }[];
};

// === One project =============================================================

async function loadProjectDetail(client: Client, projectId: string): Promise<ProjectDetail | null> {
  const { data: project } = await client
    .from("skill_projects")
    .select(
      `*,
       skill_project_links(id, url, label, sort_order),
       skill_project_goals(id, text, sort_order),
       skill_project_submissions(id, attempt_number, note, goals_checked, submitted_at, review_status, feedback, reviewed_at,
         skill_project_media(id, media_type, storage_path, url, sort_order)),
       services(id, name)`,
    )
    .eq("id", projectId)
    .maybeSingle();

  if (!project) return null;

  // public_profiles is a view, so it can't be embedded above.
  const [{ data: tech }, lookbook] = await Promise.all([
    client.from("public_profiles").select("id, full_name").eq("id", project.assigned_to).maybeSingle(),
    project.reference_type === "lookbook" && project.reference_lookbook_photo_id
      ? client.from("visit_photos").select("image_url").eq("id", project.reference_lookbook_photo_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const submissionRows = (project.skill_project_submissions ?? []) as SubmissionRow[];
  const signed = await signPaths([
    project.reference_type === "upload" ? project.reference_storage_path : null,
    ...submissionRows.flatMap((s) => s.skill_project_media.map((m) => m.storage_path)),
  ]);

  let reference: ProjectReference;
  if (project.reference_type === "link") {
    reference = { kind: "link", url: project.reference_url };
  } else if (project.reference_type === "upload") {
    reference = { kind: "upload", imageUrl: signed.get(project.reference_storage_path) ?? null };
  } else {
    // Only the image: the tech never sees which member posted it.
    reference = { kind: "lookbook", imageUrl: lookbook.data?.image_url ?? null };
  }

  const bySort = <T extends { sort_order: number }>(a: T, b: T) => a.sort_order - b.sort_order;

  return {
    id: project.id,
    title: project.title,
    skillTypes: project.skill_types,
    status: project.status,
    priority: project.priority,
    dueDate: project.due_date,
    instructions: project.instructions,
    archivedAt: project.archived_at,
    createdAt: project.created_at,
    assignedTo: { id: project.assigned_to, name: tech?.full_name ?? "Tech" },
    linkedService: project.services ? { id: project.services.id, name: project.services.name } : null,
    reference,
    links: [...(project.skill_project_links ?? [])].sort(bySort),
    goals: [...(project.skill_project_goals ?? [])].sort(bySort),
    submissions: submissionRows
      .sort((a, b) => b.attempt_number - a.attempt_number)
      .map((s) => {
        const media = [...s.skill_project_media].sort(bySort);
        return {
          id: s.id,
          attemptNumber: s.attempt_number,
          note: s.note,
          goalsChecked: s.goals_checked ?? [],
          submittedAt: s.submitted_at,
          reviewStatus: s.review_status,
          feedback: s.feedback,
          reviewedAt: s.reviewed_at,
          photos: media
            .filter((m) => m.media_type === "photo")
            .map((m) => ({ id: m.id, url: m.storage_path ? (signed.get(m.storage_path) ?? null) : null })),
          videoLinks: media
            .filter((m) => m.media_type === "video_link" && m.url)
            .map((m) => ({ id: m.id, url: m.url as string })),
        };
      }),
    raw: {
      referenceType: project.reference_type,
      referenceLookbookPhotoId: project.reference_lookbook_photo_id,
      referenceStoragePath: project.reference_storage_path,
      referenceUrl: project.reference_url,
      linkedServiceId: project.linked_service_id,
    },
  };
}

export function getProjectForAdmin(projectId: string) {
  return loadProjectDetail(createServiceRoleClient(), projectId);
}

// RLS limits a tech to projects assigned to them (and not archived). The
// explicit checks matter for an account that's admin AND tech: its admin
// access can read every project, but My Projects should only show its own.
export async function getProjectForTech(projectId: string, userId: string) {
  const project = await loadProjectDetail(await createClient(), projectId);
  if (!project || project.assignedTo.id !== userId || project.archivedAt) return null;
  return project;
}

// === Lists ===================================================================

export type AdminProjectRow = {
  id: string;
  title: string;
  skillTypes: string[];
  status: string;
  priority: string;
  dueDate: string | null;
  archivedAt: string | null;
  techName: string;
  attempts: number;
  thumbnailUrl: string | null;
  createdAt: string;
};

export type AdminProjectFilters = { status?: string; skill?: string; tech?: string };

export async function getSkillProjectsForAdmin(filters: AdminProjectFilters): Promise<AdminProjectRow[]> {
  const serviceRole = createServiceRoleClient();

  let query = serviceRole
    .from("skill_projects")
    .select(
      "id, title, skill_types, status, priority, due_date, archived_at, assigned_to, created_at, reference_type, reference_lookbook_photo_id, reference_storage_path, skill_project_submissions(count)",
    )
    .order("created_at", { ascending: false });

  if (filters.status === "archived") query = query.not("archived_at", "is", null);
  else {
    query = query.is("archived_at", null);
    if (filters.status && filters.status !== "all") query = query.eq("status", filters.status);
  }
  if (filters.skill) query = query.contains("skill_types", [filters.skill]);
  if (filters.tech) query = query.eq("assigned_to", filters.tech);

  const { data: projects } = await query;
  const rows = projects ?? [];

  const techIds = [...new Set(rows.map((p) => p.assigned_to))];
  const photoIds = rows.map((p) => p.reference_lookbook_photo_id).filter(Boolean);
  const [{ data: techs }, { data: photos }, signed] = await Promise.all([
    techIds.length
      ? serviceRole.from("profiles").select("id, full_name").in("id", techIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string | null }[] }),
    photoIds.length
      ? serviceRole.from("visit_photos").select("id, image_url").in("id", photoIds)
      : Promise.resolve({ data: [] as { id: string; image_url: string }[] }),
    signPaths(rows.map((p) => (p.reference_type === "upload" ? p.reference_storage_path : null))),
  ]);

  const techName = new Map((techs ?? []).map((t) => [t.id, t.full_name ?? "Tech"]));
  const photoUrl = new Map((photos ?? []).map((p) => [p.id, p.image_url]));

  return rows.map((p) => ({
    id: p.id,
    title: p.title,
    skillTypes: p.skill_types,
    status: p.status,
    priority: p.priority,
    dueDate: p.due_date,
    archivedAt: p.archived_at,
    techName: techName.get(p.assigned_to) ?? "Tech",
    attempts: p.skill_project_submissions?.[0]?.count ?? 0,
    thumbnailUrl:
      p.reference_type === "upload"
        ? (signed.get(p.reference_storage_path) ?? null)
        : p.reference_type === "lookbook"
          ? (photoUrl.get(p.reference_lookbook_photo_id) ?? null)
          : null,
    createdAt: p.created_at,
  }));
}

export async function getWaitingForReviewCount() {
  const { count } = await createServiceRoleClient()
    .from("skill_projects")
    .select("id", { count: "exact", head: true })
    .eq("status", "submitted")
    .is("archived_at", null);

  return count ?? 0;
}

export async function getTechAccounts() {
  const { data } = await createServiceRoleClient()
    .from("profiles")
    .select("id, full_name")
    .eq("is_tech", true)
    .order("full_name");

  return (data ?? []).map((t) => ({ id: t.id as string, name: (t.full_name as string | null) ?? "Unnamed" }));
}

// Recent Look Book photos for the reference picker, most-liked first so the
// looks members want most are easy to find.
export async function getLookBookPhotosForPicker() {
  const { data } = await createServiceRoleClient()
    .from("visit_photos")
    .select("id, image_url, created_at, photo_likes(count)")
    .order("created_at", { ascending: false })
    .limit(60);

  return (data ?? [])
    .map((p) => ({ id: p.id as string, imageUrl: p.image_url as string, likes: p.photo_likes?.[0]?.count ?? 0 }))
    .sort((a, b) => b.likes - a.likes);
}

export type TechProjectRow = {
  id: string;
  title: string;
  skillTypes: string[];
  status: string;
  priority: string;
  dueDate: string | null;
  createdAt: string;
  isNew: boolean;
  // First photo of the approved attempt, for the Completed portfolio.
  portfolioPhotoUrl: string | null;
};

export async function getMyProjects(userId: string): Promise<TechProjectRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("skill_projects")
    .select(
      "id, title, skill_types, status, priority, due_date, created_at, tech_attention_at, tech_seen_at, skill_project_submissions(review_status, skill_project_media(media_type, storage_path, sort_order))",
    )
    .eq("assigned_to", userId)
    .is("archived_at", null);

  const rows = data ?? [];

  const approvedPhotoPath = new Map<string, string>();
  for (const p of rows) {
    const approved = (p.skill_project_submissions ?? []).find(
      (s: { review_status: string }) => s.review_status === "approved",
    );
    const firstPhoto = (approved?.skill_project_media ?? [])
      .filter((m: { media_type: string }) => m.media_type === "photo")
      .sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order)[0];
    if (firstPhoto?.storage_path) approvedPhotoPath.set(p.id, firstPhoto.storage_path);
  }
  const signed = await signPaths([...approvedPhotoPath.values()]);

  return rows
    .map((p) => ({
      id: p.id,
      title: p.title,
      skillTypes: p.skill_types,
      status: p.status,
      priority: p.priority,
      dueDate: p.due_date,
      createdAt: p.created_at,
      isNew: !p.tech_seen_at || p.tech_seen_at < p.tech_attention_at,
      portfolioPhotoUrl: signed.get(approvedPhotoPath.get(p.id) ?? "") ?? null,
    }))
    .sort((a, b) =>
      compareForTechList(
        { due_date: a.dueDate, priority: a.priority, created_at: a.createdAt },
        { due_date: b.dueDate, priority: b.priority, created_at: b.createdAt },
      ),
    );
}

// For the dot on My Projects: anything assigned, sent back or approved that
// the tech hasn't opened since.
export async function hasProjectUpdates(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("skill_projects")
    .select("tech_attention_at, tech_seen_at")
    .eq("assigned_to", userId)
    .is("archived_at", null);
  return (data ?? []).some((p) => !p.tech_seen_at || p.tech_seen_at < p.tech_attention_at);
}
