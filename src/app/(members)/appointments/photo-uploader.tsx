"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { addVisitPhoto, deleteVisitPhoto } from "./photo-actions";

type Photo = { id: string; image_url: string };

const MAX_PHOTOS = 3;

export default function PhotoUploader({
  appointmentId,
  userId,
  initialPhotos,
}: {
  appointmentId: string;
  userId: string;
  initialPhotos: Photo[];
}) {
  const [photos, setPhotos] = useState(initialPhotos);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError("");
    setUploading(true);

    try {
      const supabase = createClient();
      const extension = file.name.split(".").pop();
      const path = `${userId}/${appointmentId}/${Date.now()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from("visit-photos")
        .upload(path, file);
      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("visit-photos").getPublicUrl(path);

      const result = await addVisitPhoto(appointmentId, publicUrl);
      if (result.error || !result.photo) {
        setError(result.error ?? "Could not save that photo.");
        return;
      }

      setPhotos((prev) => [...prev, result.photo]);
    } catch {
      setError("Could not upload that photo. Try a JPG or PNG under 5MB.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleDelete(photoId: string) {
    setPhotos((prev) => prev.filter((p) => p.id !== photoId));
    await deleteVisitPhoto(photoId);
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {photos.map((photo) => (
        <div key={photo.id} className="group relative h-16 w-16 overflow-hidden rounded-xl">
          <Image src={photo.image_url} alt="Visit photo" fill unoptimized className="object-cover" />
          <button
            type="button"
            onClick={() => handleDelete(photo.id)}
            className="absolute inset-0 hidden items-center justify-center bg-black/50 text-xs text-white group-hover:flex"
          >
            Remove
          </button>
        </div>
      ))}

      {photos.length < MAX_PHOTOS && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex h-16 w-16 items-center justify-center rounded-xl border border-dashed border-neutral-300 text-xs text-neutral-500 hover:border-neutral-400 disabled:opacity-50"
        >
          {uploading ? "..." : "+ Add"}
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/png, image/jpeg, image/webp"
        className="hidden"
        onChange={handleFileChange}
      />

      {error && <p className="w-full text-xs text-red-600">{error}</p>}
    </div>
  );
}
