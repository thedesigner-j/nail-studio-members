import { getAllClientsForAdmin, getAdminAccounts, getCurrentProfile } from "@/lib/data";
import ClientsTable from "./clients-table";
import AdminsPanel from "./admins-panel";

export default async function AdminClientsPage() {
  const [clients, admins, profile] = await Promise.all([
    getAllClientsForAdmin(),
    getAdminAccounts(),
    getCurrentProfile(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Clients</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Every member, with bookings, spend, loyalty, and referral activity at a glance.
        </p>
      </div>

      <AdminsPanel admins={admins} currentAdminId={profile?.id ?? ""} />

      <ClientsTable clients={clients} />
    </div>
  );
}
