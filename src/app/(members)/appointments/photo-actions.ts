"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const MAX_PHOTOS_PER_APPOINTMENT = 3;

export async function addVisitPhoto(appointmentId: string, imageUrl: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in.", photo: null };

  const { count } = await supabase
    .from("visit_photos")
    .select("id", { count: "exact", head: true })
    .eq("appointment_id", appointmentId);

  if ((count ?? 0) >= MAX_PHOTOS_PER_APPOINTMENT) {
    return {
      error: `You can add up to ${MAX_PHOTOS_PER_APPOINTMENT} photos per visit.`,
      photo: null,
    };
  }

  const { data, error } = await supabase
    .from("visit_photos")
    .insert({
      appointment_id: appointmentId,
      user_id: user.id,
      image_url: imageUrl,
    })
    .select("id, image_url")
    .single();

  if (error || !data) return { error: "Could not save that photo.", photo: null };

  revalidatePath("/appointments");
  revalidatePath("/look-book");
  return { error: null, photo: data };
}

export async function deleteVisitPhoto(photoId: string) {
  const supabase = await createClient();
  await supabase.from("visit_photos").delete().eq("id", photoId);

  revalidatePath("/appointments");
  revalidatePath("/look-book");
}
