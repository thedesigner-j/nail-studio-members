import { getBusinessHours } from "@/lib/data";
import HoursForm from "./hours-form";

export default async function AdminHoursPage() {
  const hours = await getBusinessHours();

  const days = Array.from({ length: 7 }, (_, day) => {
    const row = hours.find((h) => h.day_of_week === day);
    return {
      open: Boolean(row),
      start: row?.start_time?.slice(0, 5) ?? "10:00",
      end: row?.end_time?.slice(0, 5) ?? "18:00",
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Working hours</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Controls which days and times members can book appointments.
        </p>
      </div>

      <HoursForm initialHours={days} />
    </div>
  );
}
