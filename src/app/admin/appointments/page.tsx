import { getConfirmedAppointmentsForAdmin } from "@/lib/data";
import AppointmentRow from "./appointment-row";

export default async function AdminAppointmentsPage() {
  const appointments = await getConfirmedAppointmentsForAdmin();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Appointments</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Mark a visit paid and completed once it&apos;s done — this is what triggers session credit and
          referral confirmation.
        </p>
      </div>

      {appointments.length === 0 ? (
        <p className="text-sm text-neutral-500">No confirmed appointments waiting.</p>
      ) : (
        <ul className="space-y-3">
          {appointments.map((appointment) => (
            <AppointmentRow key={appointment.id} appointment={appointment} />
          ))}
        </ul>
      )}
    </div>
  );
}
