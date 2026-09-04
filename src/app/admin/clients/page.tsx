import { getAllClientsForAdmin } from "@/lib/data";
import ClientsTable from "./clients-table";

export default async function AdminClientsPage() {
  const clients = await getAllClientsForAdmin();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Clients</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Every member, with bookings, spend, loyalty, and referral activity at a glance.
        </p>
      </div>

      <ClientsTable clients={clients} />
    </div>
  );
}
