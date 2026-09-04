"use client";

import { useActionState, useState, useTransition } from "react";
import { updateAnnouncement, setAnnouncementPublished, deleteAnnouncement } from "./actions";
import ImageUploader from "./image-uploader";

type Announcement = {
  id: string;
  category: string;
  title: string;
  description: string | null;
  image_url: string | null;
  link_url: string | null;
  event_at: string | null;
  ends_at: string | null;
  published: boolean;
};

function toDatetimeLocal(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const offsetMs = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - offsetMs).toISOString().slice(0, 16);
}

function toDateInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const offsetMs = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - offsetMs).toISOString().slice(0, 10);
}

export default function AnnouncementRow({ announcement }: { announcement: Announcement }) {
  const [state, formAction, pending] = useActionState(updateAnnouncement, null);
  const [published, setPublished] = useState(announcement.published);
  const [, startTransition] = useTransition();

  function handleTogglePublished() {
    const next = !published;
    setPublished(next);
    startTransition(() => {
      setAnnouncementPublished(announcement.id, next);
    });
  }

  return (
    <div className={`card space-y-3 ${published ? "" : "opacity-60"}`}>
      <ImageUploader announcementId={announcement.id} imageUrl={announcement.image_url} />

      <form action={formAction} className="space-y-3">
        <input type="hidden" name="id" value={announcement.id} />

        <div className="flex items-start justify-between gap-3">
          <input name="title" defaultValue={announcement.title} className="field-input flex-1 font-medium" required />
          <button
            type="button"
            onClick={handleTogglePublished}
            className={`badge shrink-0 ${published ? "bg-emerald-100 text-emerald-700" : "bg-neutral-100 text-neutral-500"}`}
          >
            {published ? "Published" : "Draft"}
          </button>
        </div>

        <select name="category" defaultValue={announcement.category} className="field-input">
          <option value="announcement">Announcement</option>
          <option value="sale">Sale</option>
          <option value="product">New Product</option>
          <option value="event">Event</option>
        </select>

        <textarea
          name="description"
          defaultValue={announcement.description ?? ""}
          rows={2}
          placeholder="Description"
          className="field-input"
        />

        <input
          name="linkUrl"
          type="url"
          defaultValue={announcement.link_url ?? ""}
          placeholder="Link (optional)"
          className="field-input"
        />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="field-label">Event date/time (optional)</label>
            <input
              type="datetime-local"
              name="eventAt"
              defaultValue={toDatetimeLocal(announcement.event_at)}
              className="field-input"
            />
          </div>
          <div>
            <label className="field-label">Ends (optional)</label>
            <input
              type="date"
              name="endsAt"
              defaultValue={toDateInput(announcement.ends_at)}
              className="field-input"
            />
          </div>
        </div>

        {state?.error ? (
          <p className="text-sm text-red-600">{state.error}</p>
        ) : state && !state.error ? (
          <p className="text-sm text-emerald-600">Saved.</p>
        ) : null}

        <button type="submit" disabled={pending} className="btn-secondary btn-sm">
          {pending ? "Saving..." : "Save"}
        </button>
      </form>

      <form action={deleteAnnouncement}>
        <input type="hidden" name="id" value={announcement.id} />
        <button type="submit" className="text-sm font-medium text-rose-600 hover:underline">
          Delete
        </button>
      </form>
    </div>
  );
}
