"use client";

import { useEffect, useTransition } from "react";
import { markProjectSeen, startProject } from "../actions";

// Fires on an actual page view (not a link prefetch), same as Early Access.
export function MarkSeen({ projectId }: { projectId: string }) {
  useEffect(() => {
    markProjectSeen(projectId);
  }, [projectId]);

  return null;
}

export function StartButton({ projectId }: { projectId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => startProject(projectId))}
      className="btn-secondary"
    >
      {pending ? "Starting..." : "Start"}
    </button>
  );
}
