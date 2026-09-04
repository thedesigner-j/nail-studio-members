import { getAllAnnouncements } from "@/lib/data";
import AnnouncementRow from "./announcement-row";
import NewAnnouncementForm from "./new-announcement-form";

export default async function AdminAnnouncementsPage() {
  const announcements = await getAllAnnouncements();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Early Access posts</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Sales, new products, and events members see before anyone else.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {announcements.map((announcement) => (
          <AnnouncementRow key={announcement.id} announcement={announcement} />
        ))}
        <NewAnnouncementForm />
      </div>
    </div>
  );
}
