"use client";

import { useActionState } from "react";
import { updateProfile } from "./actions";

type Profile = {
  full_name: string | null;
  phone: string | null;
  email?: string;
};

export default function ProfileForm({ profile }: { profile: Profile }) {
  const [state, formAction, pending] = useActionState(updateProfile, null);

  return (
    <form action={formAction} className="card max-w-sm space-y-4">
      <div>
        <label className="field-label" htmlFor="fullName">
          Full name
        </label>
        <input
          id="fullName"
          name="fullName"
          defaultValue={profile.full_name ?? ""}
          className="field-input"
        />
      </div>

      <div>
        <label className="field-label">Email</label>
        <p className="rounded-xl bg-neutral-100 px-3.5 py-2.5 text-sm text-neutral-500">
          {profile.email}
        </p>
      </div>

      <div>
        <label className="field-label" htmlFor="phone">
          Phone
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          defaultValue={profile.phone ?? ""}
          className="field-input"
        />
      </div>

      {state?.error ? (
        <p className="text-sm text-red-600">{state.error}</p>
      ) : state && !state.error ? (
        <p className="text-sm text-emerald-600">Saved.</p>
      ) : null}

      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? "Saving..." : "Save changes"}
      </button>
    </form>
  );
}
