"use server";

import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { requireAdmin } from "../require-admin";

const DAY_COUNT = 7;

export async function updateBusinessHours(_prevState: { error: string } | null, formData: FormData) {
  const admin = await requireAdmin();
  if (!admin) return { error: "You must be an admin to do that." };

  const rows: { day_of_week: number; start_time: string; end_time: string }[] = [];

  for (let day = 0; day < DAY_COUNT; day++) {
    if (!formData.get(`open-${day}`)) continue;

    const start = String(formData.get(`start-${day}`) || "");
    const end = String(formData.get(`end-${day}`) || "");
    if (!start || !end) continue;

    if (start >= end) {
      return { error: "Closing time must be after opening time." };
    }

    rows.push({ day_of_week: day, start_time: start, end_time: end });
  }

  const serviceRole = createServiceRoleClient();

  await serviceRole.from("business_hours").delete().neq("day_of_week", -1);
  if (rows.length > 0) {
    const { error } = await serviceRole.from("business_hours").insert(rows);
    if (error) return { error: "Could not save working hours." };
  }

  revalidatePath("/admin/hours");
  revalidatePath("/book");
  return { error: "" };
}
