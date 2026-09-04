"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { updateAvatarUrl } from "./actions";

export default function AvatarUploader({
  userId,
  avatarUrl,
}: {
  userId: string;
  avatarUrl: string | null;
}) {
  const [preview, setPreview] = useState(avatarUrl);
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
      const path = `${userId}/avatar.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(path);

      // Cache-bust so the new image shows immediately after an overwrite.
      const bustedUrl = `${publicUrl}?t=${Date.now()}`;
      await updateAvatarUrl(bustedUrl);
      setPreview(bustedUrl);
    } catch {
      setError("Could not upload that image. Try a JPG or PNG under 5MB.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="card flex items-center gap-4">
      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-neutral-200">
        {preview && (
          <Image src={preview} alt="Profile picture" fill unoptimized className="object-cover" />
        )}
      </div>

      <div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="btn-secondary btn-sm"
        >
          {uploading ? "Uploading..." : "Change photo"}
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
