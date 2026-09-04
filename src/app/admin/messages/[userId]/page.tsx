import Link from "next/link";
import { notFound } from "next/navigation";
import { getMessages } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { markThreadRead } from "../actions";
import AdminMessageThread from "./admin-message-thread";

export default async function AdminMessageThreadPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("public_profiles")
    .select("full_name")
    .eq("id", userId)
    .single();
  if (!profile) notFound();

  const messages = await getMessages(userId);
  await markThreadRead(userId);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/messages" className="text-sm text-neutral-500 hover:underline">
          ← All messages
        </Link>
        <h1 className="mt-1 text-2xl font-semibold text-neutral-900">{profile.full_name ?? "A member"}</h1>
      </div>

      <AdminMessageThread userId={userId} initialMessages={messages} />
    </div>
  );
}
