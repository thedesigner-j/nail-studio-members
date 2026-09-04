import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { connectGoogleCalendar } from "@/lib/google/calendar";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${origin}/login`);
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/dashboard?calendar=error`);
  }

  try {
    await connectGoogleCalendar(user.id, code);
    return NextResponse.redirect(`${origin}/dashboard?calendar=connected`);
  } catch {
    return NextResponse.redirect(`${origin}/dashboard?calendar=error`);
  }
}
