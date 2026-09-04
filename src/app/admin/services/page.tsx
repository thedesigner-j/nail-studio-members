import { getAllServices } from "@/lib/data";
import ServiceRow from "./service-row";
import NewServiceForm from "./new-service-form";

export default async function AdminServicesPage() {
  const services = await getAllServices();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Services & rates</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Edit the menu members book from. Hidden services stay off the booking page but keep their
          history.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {services.map((service) => (
          <ServiceRow key={service.id} service={service} />
        ))}
        <NewServiceForm />
      </div>
    </div>
  );
}
