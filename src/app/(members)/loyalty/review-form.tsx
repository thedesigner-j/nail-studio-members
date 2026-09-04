"use client";

import { useActionState, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { submitReview } from "./actions";

type Platform = { id: string; name: string };

export default function ReviewForm({ platforms }: { platforms: Platform[] }) {
  const [state, formAction, pending] = useActionState(submitReview, null);

  if (platforms.length === 0) {
    return <p className="text-sm text-neutral-500">No review platforms are set up yet.</p>;
  }

  return (
    <ReviewFormFields
      key={state?.resetToken ?? "initial"}
      platforms={platforms}
      formAction={formAction}
      pending={pending}
      error={state?.error}
    />
  );
}

function ReviewFormFields({
  platforms,
  formAction,
  pending,
  error,
}: {
  platforms: Platform[];
  formAction: (formData: FormData) => void;
  pending: boolean;
  error?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadedPath, setUploadedPath] = useState("");
  const [platformId, setPlatformId] = useState(platforms[0]?.id ?? "");
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const {
      data: { user },
    } = await createClient().auth.getUser();
    if (!user) return;

    setUploading(true);
    try {
      const supabase = createClient();
      const extension = file.name.split(".").pop();
      const path = `${user.id}/review-${Date.now()}.${extension}`;

      const { error: uploadError } = await supabase.storage.from("review-proofs").upload(path, file);
      if (!uploadError) setUploadedPath(path);
    } finally {
      setUploading(false);
    }
  }

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="proofUrl" value={uploadedPath} />

      <div>
        <label className="field-label" htmlFor="platformId">
          Platform
        </label>
        <select
          id="platformId"
          name="platformId"
          value={platformId}
          onChange={(e) => setPlatformId(e.target.value)}
          className="field-input"
        >
          {platforms.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="field-label" htmlFor="proofLink">
          Link to your review (or upload a screenshot below)
        </label>
        <input id="proofLink" name="proofLink" type="url" placeholder="https://..." className="field-input" />
      </div>

      <div>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="btn-secondary btn-sm"
        >
          {uploading ? "Uploading..." : uploadedPath ? "Screenshot attached ✓" : "Upload screenshot"}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png, image/jpeg, image/webp"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button type="submit" disabled={pending} className="btn-primary btn-sm">
        {pending ? "Submitting..." : "Submit for review"}
      </button>
    </form>
  );
}
