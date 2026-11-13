"use client";

import { startTransition, useActionState, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { PRIORITIES, SKILL_PROJECTS_BUCKET, SKILL_TYPES } from "@/lib/skill-projects";
import type { ProjectFormInitial, ReferenceType } from "./form-defaults";

type FormState = { error: string } | null;

const REFERENCE_TABS: { key: ReferenceType; label: string }[] = [
  { key: "lookbook", label: "Look Book" },
  { key: "upload", label: "Upload" },
  { key: "link", label: "Link" },
];

// Submitted from onSubmit rather than <form action>: with action, React
// resets the form after every run, which wipes fields and leaves checkboxes
// out of sync with state whenever the server sends back an error to fix.
export default function ProjectForm({
  action,
  initial,
  techs,
  services,
  lookbookPhotos,
  adminId,
  submitLabel,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  initial: ProjectFormInitial;
  techs: { id: string; name: string }[];
  services: { id: string; name: string }[];
  lookbookPhotos: { id: string; imageUrl: string; likes: number }[];
  adminId: string;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);

  const [title, setTitle] = useState(initial.title);
  const [skillTypes, setSkillTypes] = useState<string[]>(initial.skillTypes);
  const [assignedTo, setAssignedTo] = useState(initial.assignedTo || (techs.length === 1 ? techs[0].id : ""));
  const [referenceType, setReferenceType] = useState<ReferenceType>(initial.referenceType);
  const [lookbookPhotoId, setLookbookPhotoId] = useState(initial.referenceLookbookPhotoId);
  const [storagePath, setStoragePath] = useState(initial.referenceStoragePath);
  const [uploadPreview, setUploadPreview] = useState(initial.referencePreviewUrl);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [referenceUrl, setReferenceUrl] = useState(initial.referenceUrl);
  const [links, setLinks] = useState(initial.links);
  const [goals, setGoals] = useState(initial.goals);
  const [instructions, setInstructions] = useState(initial.instructions);
  const [dueDate, setDueDate] = useState(initial.dueDate);
  const [priority, setPriority] = useState(initial.priority);
  const [linkedServiceId, setLinkedServiceId] = useState(initial.linkedServiceId);
  const fileRef = useRef<HTMLInputElement>(null);

  // The photo picked from the Look Book may be older than the 60 shown here.
  const selectedNotInGrid = lookbookPhotoId && !lookbookPhotos.some((p) => p.id === lookbookPhotoId);

  async function handleReferenceUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError("");
    setUploading(true);
    try {
      const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `references/${adminId}/${Date.now()}.${extension}`;
      const { error } = await createClient().storage.from(SKILL_PROJECTS_BUCKET).upload(path, file);
      if (error) throw error;
      setStoragePath(path);
      setUploadPreview(URL.createObjectURL(file));
    } catch {
      setUploadError("Could not upload that image. Try a JPG, PNG or WebP under 10 MB.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        startTransition(() => formAction(formData));
      }}
      className="space-y-6"
    >
      {initial.projectId && <input type="hidden" name="projectId" value={initial.projectId} />}
      <input type="hidden" name="referenceType" value={referenceType} />
      <input type="hidden" name="referenceLookbookPhotoId" value={lookbookPhotoId ?? ""} />
      <input type="hidden" name="referenceRemoved" value={initial.referenceRemoved && !lookbookPhotoId ? "1" : "0"} />
      <input type="hidden" name="referenceStoragePath" value={storagePath ?? ""} />
      <input type="hidden" name="links" value={JSON.stringify(links)} />
      <input type="hidden" name="goals" value={JSON.stringify(goals)} />

      <section className="card space-y-4">
        <div>
          <label className="field-label" htmlFor="title">
            Title
          </label>
          <input
            id="title"
            name="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Chrome French tips"
            className="field-input"
            required
          />
        </div>

        <fieldset>
          <legend className="field-label">Skill types</legend>
          <div className="flex flex-wrap gap-2">
            {SKILL_TYPES.map((skill) => {
              const on = skillTypes.includes(skill.key);
              return (
                <label
                  key={skill.key}
                  className={`cursor-pointer rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
                    on ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300 text-neutral-700"
                  }`}
                >
                  <input
                    type="checkbox"
                    name="skillTypes"
                    value={skill.key}
                    checked={on}
                    onChange={() =>
                      setSkillTypes((prev) => (on ? prev.filter((s) => s !== skill.key) : [...prev, skill.key]))
                    }
                    className="sr-only"
                  />
                  {skill.label}
                </label>
              );
            })}
          </div>
        </fieldset>

        <div>
          <label className="field-label" htmlFor="assignedTo">
            Assigned to
          </label>
          {techs.length === 0 ? (
            <p className="rounded-xl bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800">
              No techs yet. Make someone a tech on the{" "}
              <Link href="/admin/clients" className="font-medium underline">
                Clients
              </Link>{" "}
              page first.
            </p>
          ) : (
            <select
              id="assignedTo"
              name="assignedTo"
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              className="field-input"
              required
            >
              <option value="" disabled>
                Choose a tech
              </option>
              {techs.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </section>

      <section className="card space-y-4">
        <div>
          <h2 className="font-medium text-neutral-900">Reference</h2>
          <p className="mt-0.5 text-sm text-neutral-500">The look the tech is working toward.</p>
        </div>

        <div className="flex gap-1 border-b border-neutral-200" role="tablist">
          {REFERENCE_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={referenceType === tab.key}
              onClick={() => setReferenceType(tab.key)}
              className={referenceType === tab.key ? "tab-link-active" : "tab-link"}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {referenceType === "lookbook" && (
          <div className="space-y-3">
            {initial.referenceRemoved && !lookbookPhotoId && (
              <p className="rounded-xl bg-neutral-100 px-3.5 py-2.5 text-sm text-neutral-600">
                The original reference was removed by the member who posted it. Pick another photo, or leave it as is.
              </p>
            )}
            {selectedNotInGrid && (
              <p className="text-sm text-neutral-600">A Look Book photo is selected. Pick another below to change it.</p>
            )}
            {lookbookPhotos.length === 0 ? (
              <p className="text-sm text-neutral-500">No Look Book photos yet. Upload an image or use a link instead.</p>
            ) : (
              <div className="grid max-h-80 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-5">
                {lookbookPhotos.map((photo) => {
                  const selected = photo.id === lookbookPhotoId;
                  return (
                    <button
                      key={photo.id}
                      type="button"
                      onClick={() => setLookbookPhotoId(photo.id)}
                      aria-pressed={selected}
                      aria-label={`Look Book photo with ${photo.likes} likes`}
                      className={`relative overflow-hidden rounded-xl ring-offset-2 ${
                        selected ? "ring-2 ring-neutral-900" : "hover:opacity-80"
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- Look Book photos have unknown dimensions */}
                      <img src={photo.imageUrl} alt="" className="aspect-square w-full object-cover" />
                      {photo.likes > 0 && (
                        <span className="badge absolute bottom-1 left-1 bg-white/90 px-1.5 py-0.5 text-[10px] text-rose-600">
                          ♥ {photo.likes}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {referenceType === "upload" && (
          <div className="flex items-center gap-4">
            {uploadPreview ? (
              // eslint-disable-next-line @next/next/no-img-element -- local preview of the uploaded file
              <img src={uploadPreview} alt="Uploaded reference" className="h-28 w-28 rounded-xl object-cover" />
            ) : (
              <div className="flex h-28 w-28 items-center justify-center rounded-xl border border-dashed border-neutral-300 text-xs text-neutral-400">
                No image
              </div>
            )}
            <div>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="btn-secondary btn-sm"
              >
                {uploading ? "Uploading..." : uploadPreview ? "Replace image" : "Upload image"}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/png, image/jpeg, image/webp"
                className="hidden"
                onChange={handleReferenceUpload}
              />
              <p className="mt-1.5 text-xs text-neutral-500">Kept private: only you and the tech can see it.</p>
              {uploadError && <p className="mt-1 text-xs text-red-600">{uploadError}</p>}
            </div>
          </div>
        )}

        {referenceType === "link" && (
          <div>
            <input
              name="referenceUrl"
              type="url"
              value={referenceUrl}
              onChange={(e) => setReferenceUrl(e.target.value)}
              placeholder="https://www.instagram.com/p/..."
              className="field-input"
            />
            <p className="mt-1.5 text-xs text-neutral-500">
              Instagram, Pinterest or any page. Only the link is saved, never a copy of the image.
            </p>
          </div>
        )}
      </section>

      <section className="card space-y-4">
        <div>
          <h2 className="font-medium text-neutral-900">Learning links</h2>
          <p className="mt-0.5 text-sm text-neutral-500">Tutorials to learn from. YouTube links play right in the app.</p>
        </div>

        {links.map((link, i) => (
          <div key={i} className="flex flex-col gap-2 rounded-xl border border-neutral-200 p-3 sm:flex-row">
            <input
              type="url"
              value={link.url}
              onChange={(e) => setLinks((prev) => prev.map((l, j) => (j === i ? { ...l, url: e.target.value } : l)))}
              placeholder="https://youtube.com/watch?v=..."
              aria-label={`Link ${i + 1}`}
              className="field-input"
            />
            <input
              value={link.label}
              onChange={(e) => setLinks((prev) => prev.map((l, j) => (j === i ? { ...l, label: e.target.value } : l)))}
              placeholder="Label (optional)"
              aria-label={`Label for link ${i + 1}`}
              className="field-input sm:max-w-56"
            />
            <button
              type="button"
              onClick={() => setLinks((prev) => prev.filter((_, j) => j !== i))}
              className="self-end text-sm font-medium text-neutral-500 hover:text-rose-600 sm:self-center"
            >
              Remove
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={() => setLinks((prev) => [...prev, { url: "", label: "" }])}
          className="btn-secondary btn-sm"
        >
          + Add link
        </button>
      </section>

      <section className="card space-y-4">
        <div>
          <h2 className="font-medium text-neutral-900">Goals</h2>
          <p className="mt-0.5 text-sm text-neutral-500">
            What &quot;done&quot; means. The tech ticks each one when they submit.
          </p>
        </div>

        {goals.map((goal, i) => (
          <div key={goal.id ?? `new-${i}`} className="flex items-center gap-2">
            <span aria-hidden className="h-4 w-4 shrink-0 rounded border border-neutral-300" />
            <input
              value={goal.text}
              onChange={(e) => setGoals((prev) => prev.map((g, j) => (j === i ? { ...g, text: e.target.value } : g)))}
              placeholder="Even smile line on all 10 nails"
              aria-label={`Goal ${i + 1}`}
              className="field-input"
            />
            <button
              type="button"
              onClick={() => setGoals((prev) => prev.filter((_, j) => j !== i))}
              className="text-sm font-medium text-neutral-500 hover:text-rose-600"
            >
              Remove
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={() => setGoals((prev) => [...prev, { id: null, text: "" }])}
          className="btn-secondary btn-sm"
        >
          + Add goal
        </button>
      </section>

      <section className="card space-y-4">
        <div>
          <label className="field-label" htmlFor="instructions">
            Instructions (optional)
          </label>
          <textarea
            id="instructions"
            name="instructions"
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            rows={4}
            placeholder="Anything else the tech should know"
            className="field-input"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="field-label" htmlFor="dueDate">
              Due date (optional)
            </label>
            <input
              id="dueDate"
              name="dueDate"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="field-input"
            />
          </div>
          <div>
            <label className="field-label" htmlFor="priority">
              Priority
            </label>
            <select
              id="priority"
              name="priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="field-input"
            >
              {PRIORITIES.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="linkedServiceId">
              Builds toward (optional)
            </label>
            <select
              id="linkedServiceId"
              name="linkedServiceId"
              value={linkedServiceId}
              onChange={(e) => setLinkedServiceId(e.target.value)}
              className="field-input"
            >
              <option value="">No service</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {state?.error && <p className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700">{state.error}</p>}

      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending || uploading || techs.length === 0} className="btn-primary">
          {pending ? "Saving..." : submitLabel}
        </button>
        <Link
          href={initial.projectId ? `/admin/skill-projects/${initial.projectId}` : "/admin/skill-projects"}
          className="text-sm font-medium text-neutral-500 hover:text-neutral-900"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
