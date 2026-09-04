"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { deleteCalendarEvent } from "@/lib/google/calendar";

export async function cancelAppointment(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const appointmentId = String(formData.get("appointmentId"));

  const { data: appointment } = await supabase
    .from("appointments")
    .select("id, user_id, google_calendar_event_id")
    .eq("id", appointmentId)
    .eq("user_id", user.id)
    .single();

  if (!appointment) return;

  await supabase.from("appointments").update({ status: "cancelled" }).eq("id", appointmentId);

  if (appointment.google_calendar_event_id) {
    try {
      await deleteCalendarEvent(user.id, appointment.google_calendar_event_id);
    } catch {
      // The appointment is cancelled either way; a stray calendar event is
      // a minor inconvenience, not worth failing the cancellation over.
    }
  }

  revalidatePath("/appointments");
  revalidatePath("/dashboard");
}
