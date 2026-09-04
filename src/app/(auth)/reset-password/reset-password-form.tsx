"use client";

import { useActionState } from "react";
import { updatePassword } from "../actions";

export default function ResetPasswordForm() {
  const [state, formAction, pending] = useActionState(updatePassword, null);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label className="field-label" htmlFor="password">
          New password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={6}
          className="field-input"
        />
      </div>

      <div>
        <label className="field-label" htmlFor="confirmPassword">
          Confirm new password
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          required
          minLength={6}
          className="field-input"
        />
      </div>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? "Saving..." : "Set new password"}
      </button>
    </form>
  );
}
