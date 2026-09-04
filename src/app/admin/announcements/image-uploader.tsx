"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { setAnnouncementImage } from "./actions";

export default function ImageUploader({
  announcementId,
  imageUrl,
}: {
  announcementId: string;
  imageUrl: string | null;
}) {
  const [preview, setPreview] = useState(imageUrl);
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
      const path = `${announcementId}/cover-${Date.now()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from("announcements")
        .upload(path, file);
      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("announcements").getPublicUrl(path);

      await setAnnouncementImage(announcementId, publicUrl);
      setPreview(publicUrl);
    } catch {
      setError("Could not upload that image. Try a JPG or PNG under 5MB.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element -- admin-supplied cover image of unknown dimensions
        <img src={preview} alt="" className="h-16 w-24 rounded-lg object-cover" />
      ) : (
        <div className="flex h-16 w-24 items-center justify-center rounded-lg border border-dashed border-neutral-300 text-xs text-neutral-400">
          No image
        </div>
      )}
      <div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="btn-secondary btn-sm"
        >
          {uploading ? "Uploading..." : preview ? "Replace image" : "Add image"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/png, image/jpeg, image/webp"
          className="hidden"
          onChange={handleFileChange}
        />
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </div>
    </div>
  );
}
