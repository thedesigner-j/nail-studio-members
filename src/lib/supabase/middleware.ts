import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { iframeCookieOptions } from "./cookie-options";

const PUBLIC_PATHS = [
  "/login",
  "/signup",
  "/join-",
  "/forgot-password",
  "/auth/callback",
  // Server-to-server callbacks with no user session/cookies at all — Stripe
  // signs its own requests instead, verified inside the route handler.
  "/api/stripe/webhook",
];

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, { ...options, ...iframeCookieOptions }),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublicPath = PUBLIC_PATHS.some((path) => request.nextUrl.pathname.startsWith(path));

  if (!user && !isPublicPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  // No server-side "already authenticated -> redirect to /dashboard" here
  // for the (auth) pages: that redirect would land inside the Webflow
  // embed's iframe if this request came from there. RedirectIfAuthenticated
  // handles this client-side instead, where it can detect the iframe case
  // and break out to the full browser tab.

  return supabaseResponse;
}
