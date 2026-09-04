import { NextResponse } from "next/server";
import { getAvailableSlots } from "@/lib/slots";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const serviceId = searchParams.get("serviceId");
  const date = searchParams.get("date");
  const excludeAppointmentId = searchParams.get("excludeAppointmentId") ?? undefined;

  if (!serviceId || !date) {
    return NextResponse.json({ error: "serviceId and date are required" }, { status: 400 });
  }

  // Only honor the exclusion (used when rescheduling, so the appointment's
  // own current slot doesn't block itself) if it's actually the caller's own
  // appointment — otherwise this would let anyone peek at another member's
  // reserved slot as if it were free.
  let verifiedExcludeId: string | undefined;
  if (excludeAppointmentId) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data: appointment } = await supabase
        .from("appointments")
        .select("id")
        .eq("id", excludeAppointmentId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (appointment) verifiedExcludeId = appointment.id;
    }
  }

  const slots = await getAvailableSlots(serviceId, date, verifiedExcludeId);
  return NextResponse.json({ slots });
}
