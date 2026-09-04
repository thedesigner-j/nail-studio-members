"use client";

import Link from "next/link";
import { useActionState, useEffect } from "react";
import { signIn } from "../actions";

export default function LoginForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState(signIn, null);

  useEffect(() => {
    if (!state || state.error || !state.next) return;

    const target = `${window.location.origin}${state.next}`;
    // When this form is loaded inside the Webflow embed's iframe, send the
    // whole browser tab to the full app instead of loading it into the
    // iframe — the iframe is only ever meant to show the compact login
    // screen. Navigating window.top from a nested frame is allowed by
    // browsers by default (no sandbox attribute restricts it here).
    if (window.top && window.top !== window.self) {
      window.top.location.href = target;
    } else {
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = target;
    }
  }, [state]);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="next" value={next ?? "/dashboard"} />

      <div>
        <label className="field-label" htmlFor="email">
          Email
        </label>
        <input id="email" name="email" type="email" required className="field-input" />
      </div>

      <div>
        <div className="flex items-center justify-between">
          <label className="field-label mb-0" htmlFor="password">
            Password
          </label>
          <Link href="/forgot-password" className="text-xs font-medium text-neutral-500 underline">
            Forgot password?
          </Link>
        </div>
        <input
          id="password"
          name="password"
          type="password"
          required
          className="field-input mt-1.5"
        />
      </div>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
