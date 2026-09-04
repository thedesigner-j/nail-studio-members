"use client";

import { useActionState, useState, useTransition, useRef, useEffect } from "react";
import { createReviewPlatform, setReviewPlatformActive } from "./actions";

type Platform = { id: string; name: string; is_active: boolean };

export default function ReviewPlatformsList({ platforms }: { platforms: Platform[] }) {
  const [state, formAction, pending] = useActionState(createReviewPlatform, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state && !state.error) formRef.current?.reset();
  }, [state]);

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {platforms.map((platform) => (
          <PlatformRow key={platform.id} platform={platform} />
        ))}
      </ul>

      <form ref={formRef} action={formAction} className="flex items-end gap-2">
        <div className="flex-1">
          <label className="field-label">Add a platform</label>
          <input name="name" placeholder="e.g. Google" className="field-input" required />
        </div>
        <button type="submit" disabled={pending} className="btn-primary btn-sm">
          {pending ? "Adding..." : "Add"}
        </button>
      </form>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
    </div>
  );
}

function PlatformRow({ platform }: { platform: Platform }) {
  const [active, setActive] = useState(platform.is_active);
  const [, startTransition] = useTransition();

  function handleToggle() {
    const next = !active;
    setActive(next);
    startTransition(() => {
      setReviewPlatformActive(platform.id, next);
    });
  }

  return (
    <li className="card flex items-center justify-between">
      <span className="text-sm font-medium text-neutral-900">{platform.name}</span>
      <button
        type="button"
        onClick={handleToggle}
        className={`badge ${active ? "bg-emerald-100 text-emerald-700" : "bg-neutral-100 text-neutral-500"}`}
      >
        {active ? "Active" : "Inactive"}
      </button>
    </li>
  );
}
