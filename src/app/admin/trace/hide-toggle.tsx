"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setTraceSetHidden } from "./actions";

export default function HideToggle({ setId, hidden }: { setId: string; hidden: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  return (
    <div className="text-right">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError("");
            const res = await setTraceSetHidden(setId, !hidden);
            if (!res.ok) setError(res.error);
            else router.refresh();
          })
        }
        className="btn-secondary btn-sm"
      >
        {pending ? "Saving..." : hidden ? "Show to techs" : "Hide"}
      </button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
