"use client";

import { useState, useTransition } from "react";
import { setPostShareable } from "./actions";

type Post = {
  id: string;
  title: string;
  is_shareable: boolean;
  shareable_starts_at: string | null;
  shareable_ends_at: string | null;
};

function toDateInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

export default function ShareablePostsList({ posts }: { posts: Post[] }) {
  if (posts.length === 0) {
    return <p className="text-sm text-neutral-500">No posts yet — create one in Early Access first.</p>;
  }

  return (
    <ul className="space-y-3">
      {posts.map((post) => (
        <PostRow key={post.id} post={post} />
      ))}
    </ul>
  );
}

function PostRow({ post }: { post: Post }) {
  const [shareable, setShareable] = useState(post.is_shareable);
  const [startsAt, setStartsAt] = useState(toDateInput(post.shareable_starts_at));
  const [endsAt, setEndsAt] = useState(toDateInput(post.shareable_ends_at));
  const [, startTransition] = useTransition();

  function save(next: { shareable?: boolean; startsAt?: string; endsAt?: string }) {
    const nextShareable = next.shareable ?? shareable;
    const nextStarts = next.startsAt ?? startsAt;
    const nextEnds = next.endsAt ?? endsAt;

    if (next.shareable !== undefined) setShareable(next.shareable);
    if (next.startsAt !== undefined) setStartsAt(next.startsAt);
    if (next.endsAt !== undefined) setEndsAt(next.endsAt);

    startTransition(() => {
      setPostShareable(
        post.id,
        nextShareable,
        nextStarts ? new Date(nextStarts).toISOString() : null,
        nextEnds ? new Date(nextEnds).toISOString() : null,
      );
    });
  }

  return (
    <li className="card flex flex-wrap items-center gap-3">
      <label className="flex flex-1 items-center gap-2 text-sm font-medium text-neutral-900">
        <input
          type="checkbox"
          checked={shareable}
          onChange={(e) => save({ shareable: e.target.checked })}
          className="h-4 w-4 rounded border-neutral-300"
        />
        {post.title}
      </label>
      <input
        type="date"
        value={startsAt}
        onChange={(e) => save({ startsAt: e.target.value })}
        className="field-input w-auto py-1.5"
      />
      <span className="text-xs text-neutral-400">to</span>
      <input
        type="date"
        value={endsAt}
        onChange={(e) => save({ endsAt: e.target.value })}
        className="field-input w-auto py-1.5"
      />
    </li>
  );
}
