"use client";

import { useActionState } from "react";
import { signUp } from "../actions";

export default function SignupForm({ referralToken }: { referralToken?: string }) {
  const [state, formAction, pending] = useActionState(signUp, null);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="referralToken" value={referralToken ?? ""} />

      <div>
        <label className="field-label" htmlFor="fullName">
          Full name
        </label>
        <input id="fullName" name="fullName" type="text" required className="field-input" />
      </div>

      <div>
        <label className="field-label" htmlFor="email">
          Email
        </label>
        <input id="email" name="email" type="email" required className="field-input" />
      </div>

      <div>
        <label className="field-label" htmlFor="password">
          Password
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

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? "Creating account..." : "Create account"}
      </button>
    </form>
  );
}
