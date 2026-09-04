import { getCurrentProfile, getMessages } from "@/lib/data";
import MessageThread from "./message-thread";

export default async function MessagesPage() {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  const messages = await getMessages(profile.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Messages</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Send a note to the studio — we&apos;ll reply here.
        </p>
      </div>

      <MessageThread userId={profile.id} initialMessages={messages} />
    </div>
  );
}
