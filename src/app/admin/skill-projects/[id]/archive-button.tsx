"use client";

import { useTransition } from "react";
import { setProjectArchived } from "../actions";

export default function ArchiveButton({ projectId, archived }: { projectId: string; archived: boolean }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!archived && !window.confirm("Archive this project? The tech will no longer see it. You can restore it later.")) {
          return;
        }
        startTransition(() => setProjectArchived(projectId, !archived));
      }}
      className="btn-secondary btn-sm"
    >
      {pending ? "Saving..." : archived ? "Restore" : "Archive"}
    </button>
  );
}
