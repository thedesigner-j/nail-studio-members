"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { PRIORITIES, SKILL_TYPES, isHttpUrl } from "@/lib/skill-projects";
import { requireAdmin } from "../require-admin";

type FormState = { error: string } | null;

const MAX_LINKS = 10;
const MAX_GOALS = 20;

type ParsedProject = {
  fields: {
    title: string;
    skill_types: string[];
    assigned_to: string;
    reference_type: "lookbook" | "upload" | "link";
    reference_lookbook_photo_id: string | null;
    reference_storage_path: string | null;
    reference_url: string | null;
    instructions: string | null;
    due_date: string | null;
    priority: string;
    linked_service_id: string | null;
  };
  links: { url: string; label: string | null }[];
  goals: { id: string | null; text: string }[];
};

function parseJsonArray(value: FormDataEntryValue | null): unknown[] {
  try {
    const parsed = JSON.parse(String(value ?? "[]"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Validates the project form. Everything that points at another row (the
// tech, the Look Book photo, the service) is checked against the database,
// since the form's hidden fields could be edited before submitting.
async function parseProjectForm(
  formData: FormData,
  // On edit, the project's current assignee stays valid even if they've
  // since lost the tech role, so other changes can still be saved.
  currentAssignee?: string,
): Promise<{ error: string } | { project: ParsedProject }> {
  const serviceRole = createServiceRoleClient();

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { error: "Give the project a title." };

  const validSkills = SKILL_TYPES.map((t) => t.key as string);
  const skillTypes = [...new Set(formData.getAll("skillTypes").map(String))].filter((s) => validSkills.includes(s));
  if (skillTypes.length === 0) return { error: "Pick at least one skill type." };

  const assignedTo = String(formData.get("assignedTo") ?? "");
  const { data: tech } = assignedTo
    ? await serviceRole.from("profiles").select("id, is_tech").eq("id", assignedTo).maybeSingle()
    : { data: null };
  if (!tech || (!tech.is_tech && tech.id !== currentAssignee)) return { error: "Choose a tech to assign this to." };

  const referenceType = String(formData.get("referenceType") ?? "");
  let lookbookPhotoId: string | null = null;
  let storagePath: string | null = null;
  let referenceUrl: string | null = null;

  if (referenceType === "lookbook") {
    lookbookPhotoId = String(formData.get("referenceLookbookPhotoId") ?? "") || null;
    const { data: photo } = lookbookPhotoId
      ? await serviceRole.from("visit_photos").select("id").eq("id", lookbookPhotoId).maybeSingle()
      : { data: null };
    // Editing a project whose Look Book photo was since deleted keeps the
    // "Reference removed" state rather than blocking the save.
    const keepRemoved = !lookbookPhotoId && formData.get("referenceRemoved") === "1";
    if (!photo && !keepRemoved) return { error: "Pick a Look Book photo for the reference." };
  } else if (referenceType === "upload") {
    storagePath = String(formData.get("referenceStoragePath") ?? "") || null;
    if (!storagePath?.startsWith("references/")) return { error: "Upload a reference image first." };
  } else if (referenceType === "link") {
    referenceUrl = String(formData.get("referenceUrl") ?? "").trim() || null;
    if (!referenceUrl || !isHttpUrl(referenceUrl)) return { error: "Enter a full link for the reference, starting with https://" };
  } else {
    return { error: "Choose a reference." };
  }

  const dueDate = String(formData.get("dueDate") ?? "");
  if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return { error: "That due date isn't valid." };

  const priority = String(formData.get("priority") ?? "normal");
  if (!PRIORITIES.some((p) => p.key === priority)) return { error: "Invalid priority." };

  const linkedServiceId = String(formData.get("linkedServiceId") ?? "") || null;
  if (linkedServiceId) {
    const { data: service } = await serviceRole.from("services").select("id").eq("id", linkedServiceId).maybeSingle();
    if (!service) return { error: "That service no longer exists." };
  }

  const links = parseJsonArray(formData.get("links"))
    .map((l) => {
      const link = l as { url?: unknown; label?: unknown };
      return { url: String(link.url ?? "").trim(), label: String(link.label ?? "").trim() || null };
    })
    .filter((l) => l.url);
  if (links.length > MAX_LINKS) return { error: `Add up to ${MAX_LINKS} learning links.` };
  const badLink = links.find((l) => !isHttpUrl(l.url));
  if (badLink) return { error: `"${badLink.url}" isn't a full link. It should start with https://` };

  const goals = parseJsonArray(formData.get("goals"))
    .map((g) => {
      const goal = g as { id?: unknown; text?: unknown };
      return { id: typeof goal.id === "string" && goal.id ? goal.id : null, text: String(goal.text ?? "").trim() };
    })
    .filter((g) => g.text);
  if (goals.length > MAX_GOALS) return { error: `Add up to ${MAX_GOALS} goals.` };

  const instructions = String(formData.get("instructions") ?? "").trim();

  return {
    project: {
      fields: {
        title,
        skill_types: skillTypes,
        assigned_to: assignedTo,
        reference_type: referenceType,
        reference_lookbook_photo_id: lookbookPhotoId,
        reference_storage_path: storagePath,
        reference_url: referenceUrl,
        instructions: instructions || null,
        due_date: dueDate || null,
        priority,
        linked_service_id: linkedServiceId,
      },
      links,
      goals,
    },
  };
}

function revalidateProjectPages(projectId?: string) {
  revalidatePath("/admin", "layout");
  revalidatePath("/admin/skill-projects");
  revalidatePath("/my-projects", "layout");
  if (projectId) revalidatePath(`/admin/skill-projects/${projectId}`);
}

export async function createSkillProject(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  if (!admin) return { error: "You must be an admin to do that." };

  const parsed = await parseProjectForm(formData);
  if ("error" in parsed) return parsed;
  const { fields, links, goals } = parsed.project;

  const serviceRole = createServiceRoleClient();
  const { data: project, error } = await serviceRole
    .from("skill_projects")
    .insert({ ...fields, created_by: admin.id })
    .select("id")
    .single();
  if (error || !project) return { error: "Could not create that project." };

  const [linksResult, goalsResult] = await Promise.all([
    links.length
      ? serviceRole
          .from("skill_project_links")
          .insert(links.map((l, i) => ({ project_id: project.id, url: l.url, label: l.label, sort_order: i })))
      : Promise.resolve({ error: null }),
    goals.length
      ? serviceRole
          .from("skill_project_goals")
          .insert(goals.map((g, i) => ({ project_id: project.id, text: g.text, sort_order: i })))
      : Promise.resolve({ error: null }),
  ]);

  if (linksResult.error || goalsResult.error) {
    await serviceRole.from("skill_projects").delete().eq("id", project.id);
    return { error: "Could not save the project's links or goals." };
  }

  revalidateProjectPages(project.id);
  redirect(`/admin/skill-projects/${project.id}?created=1`);
}

export async function updateSkillProject(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  if (!admin) return { error: "You must be an admin to do that." };

  const projectId = String(formData.get("projectId") ?? "");
  const serviceRole = createServiceRoleClient();
  const { data: existing } = await serviceRole
    .from("skill_projects")
    .select("id, assigned_to")
    .eq("id", projectId)
    .maybeSingle();
  if (!existing) return { error: "That project no longer exists." };

  const parsed = await parseProjectForm(formData, existing.assigned_to);
  if ("error" in parsed) return parsed;
  const { fields, links, goals } = parsed.project;

  const reassigned = existing.assigned_to !== fields.assigned_to;
  const { error } = await serviceRole
    .from("skill_projects")
    .update({
      ...fields,
      updated_at: new Date().toISOString(),
      // A newly assigned tech should see it as new.
      ...(reassigned ? { tech_attention_at: new Date().toISOString(), tech_seen_at: null } : {}),
    })
    .eq("id", projectId);
  if (error) return { error: "Could not save those changes." };

  // Links have no history, so replace them wholesale.
  await serviceRole.from("skill_project_links").delete().eq("project_id", projectId);
  if (links.length) {
    await serviceRole
      .from("skill_project_links")
      .insert(links.map((l, i) => ({ project_id: projectId, url: l.url, label: l.label, sort_order: i })));
  }

  // Goals are referenced by past attempts' checklists, so keep the ids of
  // goals that are still there and only add or remove the rest.
  const { data: currentGoals } = await serviceRole.from("skill_project_goals").select("id").eq("project_id", projectId);
  const currentIds = new Set((currentGoals ?? []).map((g) => g.id));
  const keptIds = new Set(goals.map((g) => g.id).filter((id): id is string => !!id && currentIds.has(id)));

  const removed = [...currentIds].filter((id) => !keptIds.has(id));
  if (removed.length) await serviceRole.from("skill_project_goals").delete().in("id", removed);

  await Promise.all(
    goals.map((g, i) =>
      g.id && keptIds.has(g.id)
        ? serviceRole.from("skill_project_goals").update({ text: g.text, sort_order: i }).eq("id", g.id)
        : serviceRole.from("skill_project_goals").insert({ project_id: projectId, text: g.text, sort_order: i }),
    ),
  );

  revalidateProjectPages(projectId);
  redirect(`/admin/skill-projects/${projectId}?saved=1`);
}

export async function reviewSubmission(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  if (!admin) return { error: "You must be an admin to do that." };

  const projectId = String(formData.get("projectId") ?? "");
  const submissionId = String(formData.get("submissionId") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const feedback = String(formData.get("feedback") ?? "").trim();

  if (decision !== "approve" && decision !== "send_back") return { error: "Choose Approve or Send back." };
  if (decision === "send_back" && !feedback) {
    return { error: "Add feedback so the tech knows what to work on." };
  }

  const serviceRole = createServiceRoleClient();
  const { data: submission } = await serviceRole
    .from("skill_project_submissions")
    .select("id, review_status")
    .eq("id", submissionId)
    .eq("project_id", projectId)
    .maybeSingle();

  if (!submission || submission.review_status !== "pending") {
    return { error: "This attempt has already been reviewed." };
  }

  const now = new Date().toISOString();
  await serviceRole
    .from("skill_project_submissions")
    .update({
      review_status: decision === "approve" ? "approved" : "sent_back",
      feedback: feedback || null,
      reviewed_by: admin.id,
      reviewed_at: now,
    })
    .eq("id", submissionId);

  await serviceRole
    .from("skill_projects")
    .update({
      status: decision === "approve" ? "approved" : "needs_another_try",
      tech_attention_at: now,
      updated_at: now,
    })
    .eq("id", projectId);

  revalidateProjectPages(projectId);
  return { error: "" };
}

export async function setProjectArchived(projectId: string, archived: boolean) {
  const admin = await requireAdmin();
  if (!admin) return;

  await createServiceRoleClient()
    .from("skill_projects")
    .update({ archived_at: archived ? new Date().toISOString() : null, updated_at: new Date().toISOString() })
    .eq("id", projectId);

  revalidateProjectPages(projectId);
}
