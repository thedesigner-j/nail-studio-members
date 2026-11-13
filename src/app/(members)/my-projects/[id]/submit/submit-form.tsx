"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  MAX_SUBMISSION_PHOTOS,
  MAX_SUBMISSION_VIDEO_LINKS,
  SKILL_PROJECTS_BUCKET,
  youtubeEmbedUrl,
} from "@/lib/skill-projects";
import { submitProject } from "../../actions";

type UploadedPhoto = { path: string; previewUrl: string };

export default function SubmitForm({
  projectId,
  userId,
  goals,
}: {
  projectId: string;
  userId: string;
  goals: { id: string; text: string }[];
}) {
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [uploading, setUploading] = useState(0);
  const [videoLinks, setVideoLinks] = useState<string[]>([]);
  const [goalsChecked, setGoalsChecked] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const slotsLeft = MAX_SUBMISSION_PHOTOS - photos.length - uploading;

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).slice(0, Math.max(0, slotsLeft));
    if (fileRef.current) fileRef.current.value = "";
    if (files.length === 0) return;

    setError("");
    setUploading((n) => n + files.length);
    const supabase = createClient();

    await Promise.all(
      files.map(async (file, i) => {
        try {
          const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
          const path = `submissions/${userId}/${projectId}/${Date.now()}-${i}.${extension}`;
          const { error: uploadError } = await supabase.storage.from(SKILL_PROJECTS_BUCKET).upload(path, file);
          if (uploadError) throw uploadError;
          setPhotos((prev) => [...prev, { path, previewUrl: URL.createObjectURL(file) }]);
        } catch {
          setError("A photo didn't upload. Use JPG, PNG or WebP under 10 MB.");
        } finally {
          setUploading((n) => n - 1);
        }
      }),
    );
  }

  function removePhoto(path: string) {
    setPhotos((prev) => prev.filter((p) => p.path !== path));
    // Not submitted yet, so nothing points at it; tidy it out of storage.
    createClient().storage.from(SKILL_PROJECTS_BUCKET).remove([path]);
  }

  function handleSubmit() {
    setError("");
    startTransition(async () => {
      const result = await submitProject({
        projectId,
        photoPaths: photos.map((p) => p.path),
        videoLinks,
        goalsChecked,
        note,
      });
      // On success the action redirects, so a result means it didn't go through.
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="space-y-6">
      <section className="card space-y-3">
        <div>
          <h2 className="font-medium text-neutral-900">Photos</h2>
          <p className="mt-0.5 text-sm text-neutral-500">Up to {MAX_SUBMISSION_PHOTOS}. Only you and the studio can see them.</p>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {photos.map((photo, i) => (
            <div key={photo.path} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element -- local preview of a just-uploaded photo */}
              <img src={photo.previewUrl} alt={`Photo ${i + 1}`} className="aspect-square w-full rounded-xl object-cover" />
              <button
                type="button"
                onClick={() => removePhoto(photo.path)}
                aria-label={`Remove photo ${i + 1}`}
                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-xs text-white"
              >
                ✕
              </button>
            </div>
          ))}
          {Array.from({ length: uploading }).map((_, i) => (
            <div key={`uploading-${i}`} className="flex aspect-square items-center justify-center rounded-xl bg-neutral-100 text-xs text-neutral-500">
              Uploading...
            </div>
          ))}
          {slotsLeft > 0 && (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex aspect-square items-center justify-center rounded-xl border border-dashed border-neutral-300 text-sm text-neutral-500 hover:border-neutral-400"
            >
              + Photos
            </button>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/png, image/jpeg, image/webp"
          multiple
          className="hidden"
          onChange={handleFiles}
        />
      </section>

      <section className="card space-y-3">
        <div>
          <h2 className="font-medium text-neutral-900">Video links (optional)</h2>
          <p className="mt-0.5 text-sm text-neutral-500">
            Post the video elsewhere and paste the link. On YouTube, choose &quot;Unlisted&quot;. On Google Drive, set
            sharing to &quot;Anyone with the link&quot;.
          </p>
        </div>
        {videoLinks.map((link, i) => (
          <div key={i} className="space-y-1">
            <div className="flex items-center gap-2">
              <input
                type="url"
                value={link}
                onChange={(e) => setVideoLinks((prev) => prev.map((l, j) => (j === i ? e.target.value : l)))}
                placeholder="https://youtu.be/..."
                aria-label={`Video link ${i + 1}`}
                className="field-input"
              />
              <button
                type="button"
                onClick={() => setVideoLinks((prev) => prev.filter((_, j) => j !== i))}
                className="text-sm font-medium text-neutral-500 hover:text-rose-600"
              >
                Remove
              </button>
            </div>
            {link && youtubeEmbedUrl(link) && <p className="text-xs text-emerald-700">YouTube link: it will play in the app.</p>}
          </div>
        ))}
        {videoLinks.length < MAX_SUBMISSION_VIDEO_LINKS && (
          <button type="button" onClick={() => setVideoLinks((prev) => [...prev, ""])} className="btn-secondary btn-sm">
            + Add video link
          </button>
        )}
      </section>

      {goals.length > 0 && (
        <section className="card space-y-3">
          <h2 className="font-medium text-neutral-900">Goals you hit</h2>
          <ul className="space-y-2">
            {goals.map((goal) => (
              <li key={goal.id}>
                <label className="flex cursor-pointer items-start gap-2.5 text-sm text-neutral-900">
                  <input
                    type="checkbox"
                    checked={goalsChecked.includes(goal.id)}
                    onChange={(e) =>
                      setGoalsChecked((prev) =>
                        e.target.checked ? [...prev, goal.id] : prev.filter((g) => g !== goal.id),
                      )
                    }
                    className="mt-0.5 h-4 w-4 rounded border-neutral-300 accent-neutral-900"
                  />
                  {goal.text}
                </label>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card space-y-2">
        <label className="field-label" htmlFor="note">
          Note (optional)
        </label>
        <textarea
          id="note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          maxLength={2000}
          placeholder="What was hard, or what would you do differently?"
          className="field-input"
        />
      </section>

      {error && <p className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={pending || uploading > 0 || (photos.length === 0 && !videoLinks.some((l) => l.trim()))}
          className="btn-primary"
        >
          {pending ? "Submitting..." : "Submit for review"}
        </button>
        <Link href={`/my-projects/${projectId}`} className="text-sm font-medium text-neutral-500 hover:text-neutral-900">
          Cancel
        </Link>
      </div>
    </div>
  );
}
