import { getBookingSettings } from "@/lib/data";
import SettingsForm from "./settings-form";

export default async function AdminBookingPage() {
  const settings = await getBookingSettings();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Booking & deposits</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Control the deposit members pay to confirm a booking, and the cancellation policy around it.
        </p>
      </div>

      {settings ? (
        <SettingsForm settings={settings} />
      ) : (
        <p className="text-sm text-red-600">Booking settings row is missing.</p>
      )}
    </div>
  );
}
