"use server";

import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { requireAdmin } from "../require-admin";

// is_admin isn't in the member-facing column grants (see
// 0003_security_hardening.sql: authenticated can only update full_name,
// avatar_url, phone on their own profile) — a member can't self-promote via
// the API even if they tried, so this only needs the requireAdmin() gate
// plus the service role to actually make the write.
export async function promoteToAdmin(userId: string) {
  const admin = await requireAdmin();
  if (!admin) return;

  const serviceRole = createServiceRoleClient();
  await serviceRole.from("profiles").update({ is_admin: true }).eq("id", userId);

  revalidatePath("/admin/clients");
}

export async function demoteAdmin(userId: string) {
  const admin = await requireAdmin();
  if (!admin) return;

  // Refuse to remove your own access (easy way to accidentally lock
  // yourself out) or the last remaining admin account.
  if (admin.id === userId) return;

  const serviceRole = createServiceRoleClient();
  const { count } = await serviceRole
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("is_admin", true);
  if ((count ?? 0) <= 1) return;

  await serviceRole.from("profiles").update({ is_admin: false }).eq("id", userId);

  revalidatePath("/admin/clients");
}
