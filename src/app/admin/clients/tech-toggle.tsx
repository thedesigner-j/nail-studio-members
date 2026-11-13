"use client";

import { useState, useTransition } from "react";
import { setTechRole } from "./actions";

// Shows a "Tech" badge plus a button to grant or remove the role. Updates
// optimistically, same as the admin buttons beside it.
export default function TechToggle({ userId, initialIsTech }: { userId: string; initialIsTech: boolean }) {
  const [isTech, setIsTech] = useState(initialIsTech);
  const [pending, startTransition] = useTransition();

  return (
    <span className="inline-flex items-center gap-2">
      {isTech && <span className="badge bg-violet-50 text-violet-700">Tech</span>}
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          const next = !isTech;
          setIsTech(next);
          startTransition(() => setTechRole(userId, next));
        }}
        className="whitespace-nowrap text-sm font-medium text-neutral-500 hover:text-neutral-900 hover:underline"
      >
        {isTech ? "Remove tech" : "Make tech"}
      </button>
    </span>
  );
}
