"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function removeFromCollection(formData: FormData) {
  const supabase = await createClient();
  const collectionId = String(formData.get("collectionId"));
  const photoId = String(formData.get("photoId"));

  await supabase
    .from("collection_photos")
    .delete()
    .eq("collection_id", collectionId)
    .eq("photo_id", photoId);

  revalidatePath(`/collections/${collectionId}`);
  revalidatePath("/collections");
}
