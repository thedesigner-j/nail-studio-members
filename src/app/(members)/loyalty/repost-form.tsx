"use client";

import { useActionState } from "react";
import { submitRepost } from "./actions";

type Post = { id: string; title: string };

export default function RepostForm({ posts }: { posts: Post[] }) {
  const [state, formAction, pending] = useActionState(submitRepost, null);

  if (posts.length === 0) {
    return <p className="text-sm text-neutral-500">No shareable posts right now — check back soon.</p>;
  }

  return (
    <ul className="space-y-2">
      {posts.map((post) => (
        <li key={post.id} className="flex items-center justify-between gap-3 text-sm">
          <span className="text-neutral-900">{post.title}</span>
          <form action={formAction}>
            <input type="hidden" name="announcementId" value={post.id} />
            <button type="submit" disabled={pending} className="btn-secondary btn-sm">
              I shared this
            </button>
          </form>
        </li>
      ))}
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
    </ul>
  );
}
