import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getBusinessHours } from "@/lib/data";
import { formatAppointmentTime } from "@/lib/format";
import RescheduleForm from "./reschedule-form";

export default async function ReschedulePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const { data: appointment } = await supabase
    .from("appointments")
    .select("*, services(name)")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!appointment || (appointment.status !== "confirmed" && appointment.status !== "pending_payment")) {
    notFound();
  }

  const businessHours = await getBusinessHours();
  const openDaysOfWeek = businessHours.map((h) => h.day_of_week);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Reschedule appointment</h1>
        <p className="mt-1 text-sm text-neutral-500">
          {appointment.services?.name} — currently {formatAppointmentTime(appointment.starts_at)}
        </p>
      </div>

      <RescheduleForm appointmentId={appointment.id} serviceId={appointment.service_id} openDaysOfWeek={openDaysOfWeek} />
    </div>
  );
}
