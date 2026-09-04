import { getActiveAnnouncements } from "@/lib/data";
import { formatAppointmentTime, formatShortDate } from "@/lib/format";
import MarkSeen from "./mark-seen";

const CATEGORY_STYLE: Record<string, { label: string; className: string }> = {
  sale: { label: "Sale", className: "bg-rose-100 text-rose-700" },
  product: { label: "New Product", className: "bg-violet-100 text-violet-700" },
  event: { label: "Event", className: "bg-amber-100 text-amber-700" },
  announcement: { label: "Announcement", className: "bg-neutral-100 text-neutral-600" },
};

export default async function EarlyAccessPage() {
  const announcements = await getActiveAnnouncements();

  return (
    <div className="space-y-6">
      <MarkSeen />
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Early Access</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Sales, new products, and events — for members first.
        </p>
      </div>

      {announcements.length === 0 ? (
        <p className="text-sm text-neutral-500">Nothing posted yet — check back soon.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {announcements.map((item) => {
            const category = CATEGORY_STYLE[item.category] ?? CATEGORY_STYLE.announcement;
            return (
              <div key={item.id} className="card overflow-hidden p-0">
                {item.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element -- admin-supplied cover image of unknown dimensions
                  <img src={item.image_url} alt="" className="block h-40 w-full object-cover" />
                )}
                <div className="space-y-2 p-5">
                  <span className={`badge ${category.className}`}>{category.label}</span>
                  <h2 className="font-medium text-neutral-900">{item.title}</h2>
                  {item.description && <p className="text-sm text-neutral-500">{item.description}</p>}
                  {item.event_at && (
                    <p className="text-xs font-medium text-neutral-400">
                      {formatAppointmentTime(item.event_at)}
                    </p>
                  )}
                  {item.ends_at && (
                    <p className="text-xs font-medium text-neutral-400">
                      Ends {formatShortDate(item.ends_at)}
                    </p>
                  )}
                  {item.link_url && (
                    <a
                      href={item.link_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-secondary btn-sm mt-2 inline-flex"
                    >
                      Learn more
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
