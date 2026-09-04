"use client";

import { useActionState } from "react";
import { requestPasswordReset } from "../actions";

export default function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(requestPasswordReset, null);

  if (state?.sent) {
    return (
      <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
        If that email has an account, a reset link is on its way. Check your inbox.
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label className="field-label" htmlFor="email">
          Email
        </label>
        <input id="email" name="email" type="email" required className="field-input" />
      </div>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? "Sending..." : "Send reset link"}
      </button>
    </form>
  );
}
