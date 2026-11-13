"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import {
  MAX_SUBMISSION_PHOTOS,
  MAX_SUBMISSION_VIDEO_LINKS,
  SUBMITTABLE_STATUSES,
  isHttpUrl,
} from "@/lib/skill-projects";

const MAX_NOTE_LENGTH = 2000;

// Server actions can be called directly, so each one re-checks that the
// caller is a tech and that this project is assigned to them.
async function requireOwnProject(projectId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const serviceRole = createServiceRoleClient();
  const [{ data: profile }, { data: project }] = await Promise.all([
    serviceRole.from("profiles").select("is_tech").eq("id", user.id).single(),
    serviceRole
      .from("skill_projects")
      .select("id, status, assigned_to, archived_at")
      .eq("id", projectId)
      .maybeSingle(),
  ]);

  if (!profile?.is_tech || !project || project.assigned_to !== user.id || project.archived_at) return null;
  return { userId: user.id, project, serviceRole };
}

function revalidateProject(projectId: string) {
  revalidatePath("/my-projects");
  revalidatePath(`/my-projects/${projectId}`);
  revalidatePath("/admin", "layout");
}

// Clears the dot on My Projects once the tech has actually opened it.
export async function markProjectSeen(projectId: string) {
  const owned = await requireOwnProject(projectId);
  if (!owned) return;

  await owned.serviceRole
    .from("skill_projects")
    .update({ tech_seen_at: new Date().toISOString() })
    .eq("id", projectId);

  revalidatePath("/my-projects");
  revalidatePath(`/my-projects/${projectId}`);
}

export async function startProject(projectId: string) {
  const owned = await requireOwnProject(projectId);
  if (!owned || owned.project.status !== "assigned") return;

  await owned.serviceRole
    .from("skill_projects")
    .update({ status: "in_progress", updated_at: new Date().toISOString() })
    .eq("id", projectId);

  revalidateProject(projectId);
}

export type SubmitInput = {
  projectId: string;
  photoPaths: string[];
  videoLinks: string[];
  goalsChecked: string[];
  note: string;
};

export async function submitProject(input: SubmitInput): Promise<{ error: string }> {
  const owned = await requireOwnProject(input.projectId);
  if (!owned) return { error: "You can't submit work for this project." };
  if (!SUBMITTABLE_STATUSES.includes(owned.project.status)) {
    return { error: "This project isn't waiting for a submission right now." };
  }

  // Photos must already be uploaded into this tech's own folder for this
  // project (the storage policy only lets them write there).
  const folder = `submissions/${owned.userId}/${input.projectId}/`;
  const photoPaths = [...new Set(input.photoPaths)];
  if (photoPaths.some((p) => !p.startsWith(folder) || p.includes(".."))) {
    return { error: "One of those photos didn't upload correctly. Remove it and try again." };
  }
  if (photoPaths.length > MAX_SUBMISSION_PHOTOS) return { error: `Add up to ${MAX_SUBMISSION_PHOTOS} photos.` };

  const videoLinks = [...new Set(input.videoLinks.map((l) => l.trim()).filter(Boolean))];
  if (videoLinks.length > MAX_SUBMISSION_VIDEO_LINKS) {
    return { error: `Add up to ${MAX_SUBMISSION_VIDEO_LINKS} video links.` };
  }
  const badLink = videoLinks.find((l) => !isHttpUrl(l));
  if (badLink) return { error: `"${badLink}" isn't a full link. It should start with https://` };

  if (photoPaths.length === 0 && videoLinks.length === 0) {
    return { error: "Add at least one photo or video link." };
  }

  const note = input.note.trim();
  if (note.length > MAX_NOTE_LENGTH) return { error: "Keep the note under 2,000 characters." };

  const { serviceRole } = owned;
  const [{ data: goals }, { data: lastAttempt }] = await Promise.all([
    serviceRole.from("skill_project_goals").select("id").eq("project_id", input.projectId),
    serviceRole
      .from("skill_project_submissions")
      .select("attempt_number")
      .eq("project_id", input.projectId)
      .order("attempt_number", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const goalIds = new Set((goals ?? []).map((g) => g.id));

  const { data: submission, error } = await serviceRole
    .from("skill_project_submissions")
    .insert({
      project_id: input.projectId,
      attempt_number: (lastAttempt?.attempt_number ?? 0) + 1,
      note: note || null,
      goals_checked: [...new Set(input.goalsChecked)].filter((id) => goalIds.has(id)),
    })
    .select("id")
    .single();
  if (error || !submission) return { error: "Could not submit. Please try again." };

  const media = [
    ...photoPaths.map((path, i) => ({
      submission_id: submission.id,
      media_type: "photo",
      storage_path: path,
      sort_order: i,
    })),
    ...videoLinks.map((url, i) => ({
      submission_id: submission.id,
      media_type: "video_link",
      url,
      sort_order: photoPaths.length + i,
    })),
  ];
  const { error: mediaError } = await serviceRole.from("skill_project_media").insert(media);
  if (mediaError) {
    await serviceRole.from("skill_project_submissions").delete().eq("id", submission.id);
    return { error: "Could not save your photos and links. Please try again." };
  }

  await serviceRole
    .from("skill_projects")
    .update({ status: "submitted", updated_at: new Date().toISOString() })
    .eq("id", input.projectId);

  revalidateProject(input.projectId);
  redirect(`/my-projects/${input.projectId}?submitted=1`);
}
