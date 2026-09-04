import Link from "next/link";
import { getMessageThreadsForAdmin } from "@/lib/data";
import { formatAppointmentTime } from "@/lib/format";

export default async function AdminMessagesPage() {
  const threads = await getMessageThreadsForAdmin();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Messages</h1>
        <p className="mt-1 text-sm text-neutral-500">Reply to a member&apos;s thread here.</p>
      </div>

      {threads.length === 0 ? (
        <p className="text-sm text-neutral-500">No messages yet.</p>
      ) : (
        <ul className="space-y-2">
          {threads.map((thread) => (
            <li key={thread.userId}>
              <Link
                href={`/admin/messages/${thread.userId}`}
                className="card flex items-center justify-between gap-3 hover:border-neutral-300"
              >
                <div className="min-w-0">
                  <p className="font-medium text-neutral-900">{thread.memberName}</p>
                  <p className="truncate text-sm text-neutral-500">{thread.lastMessage}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-xs text-neutral-400">{formatAppointmentTime(thread.lastAt)}</span>
                  {thread.unreadCount > 0 && (
                    <span className="badge bg-neutral-900 text-white">{thread.unreadCount}</span>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
