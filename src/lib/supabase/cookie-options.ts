// This app is meant to be embedded in a cross-origin iframe (the Webflow
// site), which makes the Supabase auth cookie a third-party cookie from the
// browser's point of view. Browsers default new cookies to SameSite=Lax,
// which is NOT sent on cross-site requests inside an iframe — so the first
// page loads fine (cookie just got set), but the very next navigation looks
// unauthenticated and bounces to /login. SameSite=None (with Secure, which
// it requires) tells the browser this cookie is intentionally meant to be
// used cross-site.
//
// `Secure` cookies are rejected outright over plain HTTP, so this only
// applies in production (Vercel is always HTTPS) — local dev over
// http://localhost keeps the library's normal defaults.
export const iframeCookieOptions =
  process.env.NODE_ENV === "production" ? { sameSite: "none" as const, secure: true } : undefined;
