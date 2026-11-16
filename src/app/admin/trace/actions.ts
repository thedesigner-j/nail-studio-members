"use server";

import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { FigmaError, figmaConfig } from "@/lib/figma";
import {
  downloadPending,
  exportBatch,
  finishSync,
  recordSyncError,
  startSync,
  type StartResult,
} from "@/lib/trace-sync";
import { requireAdmin } from "../require-admin";

// The sync runs as a few short steps driven by the admin page, so no single
// request runs long. Every step re-checks the caller is an admin.

type Result<T> = ({ ok: true } & T) | { ok: false; error: string };

function friendly(error: unknown) {
  if (error instanceof FigmaError) return error.message;
  const message = error instanceof Error ? error.message : String(error);
  if (/trace_|relation .* does not exist|schema cache/i.test(message)) {
    return "Trace isn't set up in the database yet. Run the 0019_trace.sql update in Supabase first.";
  }
  return "Something went wrong while syncing. Please try again.";
}

async function fail(error: unknown): Promise<{ ok: false; error: string }> {
  if (!(error instanceof FigmaError)) console.error("Trace sync failed:", error);
  const message = friendly(error);
  try {
    await recordSyncError(message);
  } catch {
    // The table may be missing; the message above already says so.
  }
  return { ok: false, error: message };
}

export async function startTraceSync(force: boolean): Promise<Result<{ result: StartResult }>> {
  if (!(await requireAdmin())) return { ok: false, error: "You must be an admin to do that." };
  if (!figmaConfig().configured) {
    return { ok: false, error: "Figma isn't connected yet. Follow the setup steps on this page first." };
  }
  try {
    return { ok: true, result: await startSync(force) };
  } catch (error) {
    return fail(error);
  }
}

export async function exportTraceArt(ids: string[]): Promise<Result<{ exported: number; blank: number }>> {
  if (!(await requireAdmin())) return { ok: false, error: "You must be an admin to do that." };
  try {
    return { ok: true, ...(await exportBatch(ids.filter((id) => typeof id === "string"))) };
  } catch (error) {
    return fail(error);
  }
}

export async function downloadTraceArt(): Promise<
  Result<{ processed: number; changed: number; failed: number; remaining: number }>
> {
  if (!(await requireAdmin())) return { ok: false, error: "You must be an admin to do that." };
  try {
    return { ok: true, ...(await downloadPending()) };
  } catch (error) {
    return fail(error);
  }
}

export async function finishTraceSync(version: string, fileName: string): Promise<Result<object>> {
  if (!(await requireAdmin())) return { ok: false, error: "You must be an admin to do that." };
  try {
    await finishSync(String(version ?? ""), String(fileName ?? ""));
    revalidatePath("/trace", "layout");
    revalidatePath("/admin/trace");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function setTraceSetHidden(setId: string, hidden: boolean): Promise<Result<object>> {
  if (!(await requireAdmin())) return { ok: false, error: "You must be an admin to do that." };
  const { error } = await createServiceRoleClient()
    .from("trace_sets")
    .update({ hidden: !!hidden })
    .eq("id", String(setId));
  if (error) return { ok: false, error: "Could not update that set. Please try again." };
  revalidatePath("/trace", "layout");
  revalidatePath("/admin/trace");
  return { ok: true };
}
