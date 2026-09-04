"use client";

import { useActionState, useRef, useEffect } from "react";
import { createService } from "./actions";

export default function NewServiceForm() {
  const [state, formAction, pending] = useActionState(createService, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state && !state.error) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="card space-y-3 border-dashed">
      <p className="field-label mb-0">Add a service</p>

      <input name="name" placeholder="Service name" className="field-input" required />
      <textarea name="description" placeholder="Description (optional)" rows={2} className="field-input" />

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="field-label">Duration (min)</label>
          <input
            type="number"
            name="durationMinutes"
            defaultValue={30}
            min={5}
            step={5}
            className="field-input"
            required
          />
        </div>
        <div>
          <label className="field-label">Buffer after (min)</label>
          <input
            type="number"
            name="bufferMinutes"
            defaultValue={0}
            min={0}
            step={5}
            className="field-input"
          />
        </div>
        <div>
          <label className="field-label">Price ($)</label>
          <input
            type="number"
            name="priceDollars"
            defaultValue={35}
            min={0}
            step={0.01}
            className="field-input"
            required
          />
        </div>
      </div>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button type="submit" disabled={pending} className="btn-primary btn-sm">
        {pending ? "Adding..." : "Add service"}
      </button>
    </form>
  );
}
