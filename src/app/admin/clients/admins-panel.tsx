"use client";

import { useState, useTransition } from "react";
import { demoteAdmin } from "./actions";
import type { AdminAccount } from "@/lib/data";

export default function AdminsPanel({ admins, currentAdminId }: { admins: AdminAccount[]; currentAdminId: string }) {
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());
  const visible = admins.filter((a) => !removedIds.has(a.id));

  return (
    <div className="card">
      <h2 className="font-medium text-neutral-900">Admins</h2>
      <p className="mt-1 text-sm text-neutral-500">Accounts with full access to this admin panel.</p>

      <ul className="mt-3 space-y-2">
        {visible.map((admin) => (
          <AdminRow
            key={admin.id}
            admin={admin}
            canRemove={visible.length > 1 && admin.id !== currentAdminId}
            onRemoved={() => setRemovedIds((prev) => new Set(prev).add(admin.id))}
          />
        ))}
      </ul>
    </div>
  );
}

function AdminRow({
  admin,
  canRemove,
  onRemoved,
}: {
  admin: AdminAccount;
  canRemove: boolean;
  onRemoved: () => void;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <li className="flex items-center justify-between rounded-lg border border-neutral-100 px-3 py-2 text-sm">
      <div>
        <p className="font-medium text-neutral-900">{admin.fullName}</p>
        <p className="text-xs text-neutral-400">{admin.email ?? "—"}</p>
      </div>
      {canRemove && (
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            onRemoved();
            startTransition(() => {
              demoteAdmin(admin.id);
            });
          }}
          className="text-sm font-medium text-rose-600 hover:underline"
        >
          Remove admin
        </button>
      )}
    </li>
  );
}
