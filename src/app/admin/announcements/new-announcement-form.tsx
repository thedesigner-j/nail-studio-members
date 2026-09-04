"use client";

import { useActionState, useRef, useEffect } from "react";
import { createAnnouncement } from "./actions";

export default function NewAnnouncementForm() {
  const [state, formAction, pending] = useActionState(createAnnouncement, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state && !state.error) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="card space-y-3 border-dashed">
      <p className="field-label mb-0">Add a post</p>

      <input name="title" placeholder="Title" className="field-input" required />

      <select name="category" defaultValue="announcement" className="field-input">
        <option value="announcement">Announcement</option>
        <option value="sale">Sale</option>
        <option value="product">New Product</option>
        <option value="event">Event</option>
      </select>

      <textarea name="description" placeholder="Description (optional)" rows={2} className="field-input" />
      <input name="linkUrl" type="url" placeholder="Link (optional)" className="field-input" />

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="field-label">Event date/time (optional)</label>
          <input type="datetime-local" name="eventAt" className="field-input" />
        </div>
        <div>
          <label className="field-label">Ends (optional)</label>
          <input type="date" name="endsAt" className="field-input" />
        </div>
      </div>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button type="submit" disabled={pending} className="btn-primary btn-sm">
        {pending ? "Adding..." : "Add post"}
      </button>

      <p className="text-xs text-neutral-400">You can add a cover image after creating the post.</p>
    </form>
  );
}
