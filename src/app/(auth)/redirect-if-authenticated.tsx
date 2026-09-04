"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

// Runs on every (auth) page (login/signup/forgot-password/join-*). If the
// visitor already has a valid session — e.g. they're revisiting the
// Webflow page that embeds /login — this sends them straight to the app.
// Done client-side (not in middleware) specifically so it can detect and
// handle the iframe case: breaking out to the full browser tab instead of
// loading the dashboard inside the small embedded iframe.
export default function RedirectIfAuthenticated() {
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;

      // Plain window navigation, not useRouter().push(): the iframe branch
      // needs window.top specifically, which the Next.js router can't
      // target, so both branches use the same low-level API for consistency.
      const target = `${window.location.origin}/dashboard`;
      if (window.top && window.top !== window.self) {
        window.top.location.href = target;
      } else {
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.href = target;
      }
    });
  }, []);

  return null;
}
