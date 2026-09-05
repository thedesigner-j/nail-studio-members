"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";

type Collection = { id: string; name: string };

export default function ReferencePicker({ userId, collections }: { userId: string; collections: Collection[] }) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [collectionId, setCollectionId] = useState("");
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
      const path = `${userId}/${Date.now()}.${extension}`;

      const { error: uploadError } = await supabase.storage.from("appointment-references").upload(path, file);
      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("appointment-references").getPublicUrl(path);

      setPhotoUrl(publicUrl);
    } catch {
      setError("Could not upload that photo. Try a JPG or PNG under 5MB.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div>
      <label className="field-label">Reference (optional)</label>
      <p className="mb-2 text-xs text-neutral-400">
        Upload a photo of what you want, or point us to one of your saved Look Book collections.
      </p>

      <input type="hidden" name="referencePhotoUrl" value={photoUrl ?? ""} />
      <input type="hidden" name="referenceCollectionId" value={collectionId} />

      <div className="flex flex-wrap items-center gap-3">
        {photoUrl ? (
          <div className="group relative h-16 w-16 shrink-0 overflow-hidden rounded-xl">
            <Image src={photoUrl} alt="Reference" fill unoptimized className="object-cover" />
            <button
              type="button"
              onClick={() => setPhotoUrl(null)}
              className="absolute inset-0 hidden items-center justify-center bg-black/50 text-xs text-white group-hover:flex"
            >
              Remove
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-dashed border-neutral-300 text-xs text-neutral-500 hover:border-neutral-400 disabled:opacity-50"
          >
            {uploading ? "..." : "+ Photo"}
          </button>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/png, image/jpeg, image/webp"
          className="hidden"
          onChange={handleFileChange}
        />

        {collections.length > 0 && (
          <select
            value={collectionId}
            onChange={(e) => setCollectionId(e.target.value)}
            className="field-input w-auto"
          >
            <option value="">Or tag a Look Book collection…</option>
            {collections.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
