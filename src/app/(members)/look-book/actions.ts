"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function toggleLike(photoId: string, liked: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  if (liked) {
    await supabase.from("photo_likes").delete().eq("photo_id", photoId).eq("user_id", user.id);
  } else {
    await supabase.from("photo_likes").insert({ photo_id: photoId, user_id: user.id });
  }

  revalidatePath("/look-book");
}

export async function saveToCollection(
  photoId: string,
  collectionId: string,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("collection_photos")
    .upsert({ collection_id: collectionId, photo_id: photoId });

  if (error) return { error: "Could not save that photo. Try again." };

  revalidatePath("/look-book");
  revalidatePath("/collections");
  return { error: null };
}

export async function createCollectionAndSave(photoId: string, name: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in.", collection: null };

  const { data: collection, error } = await supabase
    .from("collections")
    .insert({ user_id: user.id, name })
    .select("id, name")
    .single();

  if (error || !collection) return { error: "Could not create that collection.", collection: null };

  const { error: linkError } = await supabase
    .from("collection_photos")
    .insert({ collection_id: collection.id, photo_id: photoId });

  if (linkError) return { error: "Created the collection, but couldn't add the photo to it.", collection: null };

  revalidatePath("/look-book");
  revalidatePath("/collections");
  return { error: null, collection };
}
