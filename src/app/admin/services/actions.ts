"use server";

import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { requireAdmin } from "../require-admin";

type ServiceFields = {
  name: string;
  description: string | null;
  duration_minutes: number;
  price_cents: number;
  buffer_minutes: number;
};

type ParsedService = { error: string; fields?: undefined } | { error?: undefined; fields: ServiceFields };

function parseServiceFields(formData: FormData): ParsedService {
  const name = String(formData.get("name") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const durationMinutes = Number(formData.get("durationMinutes"));
  const priceDollars = Number(formData.get("priceDollars"));
  const bufferMinutes = Number(formData.get("bufferMinutes") || 0);

  if (!name) return { error: "Name is required." };
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
    return { error: "Duration must be a positive number of minutes." };
  }
  if (!Number.isFinite(priceDollars) || priceDollars < 0) {
    return { error: "Price must be a non-negative number." };
  }
  if (!Number.isFinite(bufferMinutes) || bufferMinutes < 0) {
    return { error: "Buffer time must be a non-negative number of minutes." };
  }

  return {
    fields: {
      name,
      description: description || null,
      duration_minutes: Math.round(durationMinutes),
      price_cents: Math.round(priceDollars * 100),
      buffer_minutes: Math.round(bufferMinutes),
    },
  };
}

export async function createService(
  _prevState: { error: string } | null,
  formData: FormData,
): Promise<{ error: string }> {
  const admin = await requireAdmin();
  if (!admin) return { error: "You must be an admin to do that." };

  const parsed = parseServiceFields(formData);
  if (!parsed.fields) return { error: parsed.error };

  const serviceRole = createServiceRoleClient();
  const { error } = await serviceRole.from("services").insert({ ...parsed.fields, active: true });
  if (error) return { error: "Could not create that service." };

  revalidatePath("/admin/services");
  revalidatePath("/book");
  return { error: "" };
}

export async function updateService(
  _prevState: { error: string } | null,
  formData: FormData,
): Promise<{ error: string }> {
  const admin = await requireAdmin();
  if (!admin) return { error: "You must be an admin to do that." };

  const id = String(formData.get("id"));
  const parsed = parseServiceFields(formData);
  if (!parsed.fields) return { error: parsed.error };

  const serviceRole = createServiceRoleClient();
  const { error } = await serviceRole.from("services").update(parsed.fields).eq("id", id);
  if (error) return { error: "Could not save that service." };

  revalidatePath("/admin/services");
  revalidatePath("/book");
  return { error: "" };
}

export async function setServiceActive(id: string, active: boolean) {
  const admin = await requireAdmin();
  if (!admin) return;

  const serviceRole = createServiceRoleClient();
  await serviceRole.from("services").update({ active }).eq("id", id);

  revalidatePath("/admin/services");
  revalidatePath("/book");
}
