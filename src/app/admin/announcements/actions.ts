"use server";

import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { requireAdmin } from "../require-admin";

type AnnouncementFields = {
  category: string;
  title: string;
  description: string | null;
  link_url: string | null;
  event_at: string | null;
  ends_at: string | null;
};

type ParsedAnnouncement =
  | { error: string; fields?: undefined }
  | { error?: undefined; fields: AnnouncementFields };

const VALID_CATEGORIES = ["announcement", "sale", "product", "event"];

function parseAnnouncementFields(formData: FormData): ParsedAnnouncement {
  const title = String(formData.get("title") || "").trim();
  const category = String(formData.get("category") || "announcement");
  const description = String(formData.get("description") || "").trim();
  const linkUrl = String(formData.get("linkUrl") || "").trim();
  const eventAt = String(formData.get("eventAt") || "");
  const endsAt = String(formData.get("endsAt") || "");

  if (!title) return { error: "Title is required." };
  if (!VALID_CATEGORIES.includes(category)) return { error: "Invalid category." };

  return {
    fields: {
      category,
      title,
      description: description || null,
      link_url: linkUrl || null,
      event_at: eventAt ? new Date(eventAt).toISOString() : null,
      ends_at: endsAt ? new Date(endsAt).toISOString() : null,
    },
  };
}

export async function createAnnouncement(
  _prevState: { error: string } | null,
  formData: FormData,
): Promise<{ error: string }> {
  const admin = await requireAdmin();
  if (!admin) return { error: "You must be an admin to do that." };

  const parsed = parseAnnouncementFields(formData);
  if (!parsed.fields) return { error: parsed.error };

  const serviceRole = createServiceRoleClient();
  const { error } = await serviceRole
    .from("announcements")
    .insert({ ...parsed.fields, published: true });
  if (error) return { error: "Could not create that post." };

  revalidatePath("/admin/announcements");
  revalidatePath("/early-access");
  return { error: "" };
}

export async function updateAnnouncement(
  _prevState: { error: string } | null,
  formData: FormData,
): Promise<{ error: string }> {
  const admin = await requireAdmin();
  if (!admin) return { error: "You must be an admin to do that." };

  const id = String(formData.get("id"));
  const parsed = parseAnnouncementFields(formData);
  if (!parsed.fields) return { error: parsed.error };

  const serviceRole = createServiceRoleClient();
  const { error } = await serviceRole.from("announcements").update(parsed.fields).eq("id", id);
  if (error) return { error: "Could not save that post." };

  revalidatePath("/admin/announcements");
  revalidatePath("/early-access");
  return { error: "" };
}

export async function setAnnouncementPublished(id: string, published: boolean) {
  const admin = await requireAdmin();
  if (!admin) return;

  const serviceRole = createServiceRoleClient();
  await serviceRole.from("announcements").update({ published }).eq("id", id);

  revalidatePath("/admin/announcements");
  revalidatePath("/early-access");
}

export async function setAnnouncementImage(id: string, imageUrl: string) {
  const admin = await requireAdmin();
  if (!admin) return;

  const serviceRole = createServiceRoleClient();
  await serviceRole.from("announcements").update({ image_url: imageUrl }).eq("id", id);

  revalidatePath("/admin/announcements");
  revalidatePath("/early-access");
}

export async function deleteAnnouncement(formData: FormData) {
  const admin = await requireAdmin();
  if (!admin) return;

  const id = String(formData.get("id"));
  const serviceRole = createServiceRoleClient();
  await serviceRole.from("announcements").delete().eq("id", id);

  revalidatePath("/admin/announcements");
  revalidatePath("/early-access");
}

