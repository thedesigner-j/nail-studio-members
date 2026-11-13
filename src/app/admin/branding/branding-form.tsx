"use client";

import { startTransition, useActionState, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import BrandMark from "@/components/brand-mark";
import type { Branding } from "@/lib/branding";
import { updateBranding } from "./actions";

export default function BrandingForm({ initial }: { initial: Branding }) {
  const [state, formAction, pending] = useActionState(updateBranding, null);
  const [name, setName] = useState(initial.name);
  const [logoUrl, setLogoUrl] = useState(initial.logoUrl);
  const [showNameWithLogo, setShowNameWithLogo] = useState(initial.showNameWithLogo);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const preview: Branding = { name: name.trim() || "Your studio", logoUrl, showNameWithLogo };
  const dirty =
    name !== initial.name || logoUrl !== initial.logoUrl || showNameWithLogo !== initial.showNameWithLogo;

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (fileRef.current) fileRef.current.value = "";
    if (!file) return;

    setUploadError("");
    setUploading(true);
    try {
      const supabase = createClient();
      const extension = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `logo-${Date.now()}.${extension}`;
      const { error } = await supabase.storage.from("branding").upload(path, file, { contentType: file.type });
      if (error) throw error;
      setLogoUrl(supabase.storage.from("branding").getPublicUrl(path).data.publicUrl);
    } catch {
      setUploadError("Could not upload that file. Use a PNG, JPG, WebP or SVG under 2 MB.");
    } finally {
      setUploading(false);
    }
  }

  return (
    // Submitted from onSubmit, not <form action>, so React doesn't reset
    // the fields after saving (see the Skill Projects form).
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        startTransition(() => formAction(formData));
      }}
      className="space-y-6"
    >
      <input type="hidden" name="logoUrl" value={logoUrl ?? ""} />

      <section className="card space-y-5">
        <div>
          <label className="field-label" htmlFor="name">
            Studio name
          </label>
          <input
            id="name"
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            required
            className="field-input"
          />
        </div>

        <div>
          <p className="field-label">Logo</p>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex h-20 w-40 items-center justify-center rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-2">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- uploaded logo of unknown dimensions
                <img src={logoUrl} alt="Current logo" className="max-h-full max-w-full object-contain" />
              ) : (
                <span className="text-xs text-neutral-400">No logo</span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="btn-secondary btn-sm"
              >
                {uploading ? "Uploading..." : logoUrl ? "Replace logo" : "Upload logo"}
              </button>
              {logoUrl && (
                <button
                  type="button"
                  onClick={() => setLogoUrl(null)}
                  className="text-sm font-medium text-neutral-500 hover:text-rose-600"
                >
                  Remove logo
                </button>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/png, image/jpeg, image/webp, image/svg+xml"
              className="hidden"
              onChange={handleUpload}
            />
          </div>
          <p className="mt-2 text-xs text-neutral-500">
            PNG with a transparent background, or SVG, looks best. Up to 2 MB. It&apos;s shown about 32 pixels tall.
          </p>
          {uploadError && <p className="mt-1 text-xs text-red-600">{uploadError}</p>}
        </div>

        <label className="flex cursor-pointer items-start gap-2.5 text-sm text-neutral-900">
          <input
            type="checkbox"
            name="showNameWithLogo"
            checked={showNameWithLogo}
            onChange={(e) => setShowNameWithLogo(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-neutral-900"
          />
          <span>
            Show the name next to the logo
            <span className="block text-xs text-neutral-500">Turn off if your logo already spells out the name.</span>
          </span>
        </label>
      </section>

      <section className="card space-y-4">
        <h2 className="font-medium text-neutral-900">Preview</h2>
        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">App header</p>
          <div className="flex items-center justify-between rounded-xl border border-neutral-200 bg-white px-4 py-3">
            <BrandMark branding={preview} />
            <span className="h-9 w-9 shrink-0 rounded-full bg-neutral-900" aria-hidden />
          </div>
        </div>
        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Login screen</p>
          <div className="gradient-hero rounded-xl p-5">
            <div className="mx-auto max-w-xs rounded-2xl border border-neutral-200 bg-white p-5">
              <BrandMark branding={preview} size="lg" />
              <p className="mt-4 text-lg font-semibold text-neutral-900">Welcome back</p>
              <p className="text-sm text-neutral-500">Sign in to your member account.</p>
            </div>
          </div>
        </div>
        <p className="text-xs text-neutral-500">
          The name is also used in the browser tab, emails (including the sender name), referral messages and
          Google Calendar events.
        </p>
      </section>

      {state?.error && <p className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700">{state.error}</p>}
      {state?.saved && !dirty && (
        <p className="rounded-xl bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-700">Saved. It&apos;s live everywhere now.</p>
      )}

      <button type="submit" disabled={pending || uploading || !dirty} className="btn-primary">
        {pending ? "Saving..." : "Save branding"}
      </button>
    </form>
  );
}
