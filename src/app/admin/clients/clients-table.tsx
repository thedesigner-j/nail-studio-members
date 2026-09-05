"use client";

import { useMemo, useState, useTransition } from "react";
import Image from "next/image";
import type { AdminClientRow } from "@/lib/data";
import { formatCurrency, formatDollars, formatShortDate } from "@/lib/format";
import { promoteToAdmin } from "./actions";

type SortKey = "totalSpentCents" | "totalBookings" | "memberSince" | "creditBalance" | "lastVisitAt";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "totalSpentCents", label: "Total spent" },
  { key: "totalBookings", label: "Bookings" },
  { key: "lastVisitAt", label: "Last visit" },
  { key: "creditBalance", label: "Credit balance" },
  { key: "memberSince", label: "Member since" },
];

export default function ClientsTable({ clients }: { clients: AdminClientRow[] }) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("totalSpentCents");
  const [promotedIds, setPromotedIds] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const remaining = clients.filter((c) => !promotedIds.has(c.id));
    const q = query.trim().toLowerCase();
    const rows = q
      ? remaining.filter(
          (c) =>
            c.fullName.toLowerCase().includes(q) ||
            c.email?.toLowerCase().includes(q) ||
            c.phone?.toLowerCase().includes(q),
        )
      : remaining;

    return [...rows].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av === null) return 1;
      if (bv === null) return -1;
      return av < bv ? 1 : av > bv ? -1 : 0;
    });
  }, [clients, promotedIds, query, sortKey]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, email, or phone"
          className="field-input max-w-xs"
        />
        <div className="flex items-center gap-1.5 text-sm text-neutral-500">
          Sort by
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="field-input w-auto py-1.5"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <span className="ml-auto text-sm text-neutral-400">
          {filtered.length} of {clients.length} clients
        </span>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-xs uppercase tracking-wide text-neutral-400">
              <th className="px-4 py-3 font-medium">Client</th>
              <th className="px-4 py-3 font-medium">Member since</th>
              <th className="px-4 py-3 font-medium">Bookings</th>
              <th className="px-4 py-3 font-medium">Last visit</th>
              <th className="px-4 py-3 font-medium">Next appt</th>
              <th className="px-4 py-3 font-medium">No-shows / Cancels</th>
              <th className="px-4 py-3 font-medium">Total spent</th>
              <th className="px-4 py-3 font-medium">Credit balance</th>
              <th className="px-4 py-3 font-medium">Lifetime earned</th>
              <th className="px-4 py-3 font-medium">Referrals</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((client) => (
              <tr key={client.id} className="border-b border-neutral-100 last:border-0">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full bg-neutral-200">
                      {client.avatarUrl && (
                        <Image src={client.avatarUrl} alt="" fill unoptimized className="object-cover" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-neutral-900">{client.fullName}</p>
                      <p className="text-xs text-neutral-400">{client.email ?? client.phone ?? "—"}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-neutral-500">{formatShortDate(client.memberSince)}</td>
                <td className="px-4 py-3 text-neutral-900">{client.totalBookings}</td>
                <td className="px-4 py-3 text-neutral-500">
                  {client.lastVisitAt ? formatShortDate(client.lastVisitAt) : "—"}
                </td>
                <td className="px-4 py-3 text-neutral-500">
                  {client.nextAppointmentAt ? formatShortDate(client.nextAppointmentAt) : "—"}
                </td>
                <td className="px-4 py-3 text-neutral-500">
                  {client.noShows} / {client.cancellations}
                </td>
                <td className="px-4 py-3 font-medium text-neutral-900">
                  {formatCurrency(client.totalSpentCents)}
                </td>
                <td className="px-4 py-3 text-neutral-900">{formatDollars(client.creditBalance)}</td>
                <td className="px-4 py-3 text-neutral-500">{formatDollars(client.lifetimeEarned)}</td>
                <td className="px-4 py-3 text-neutral-500">
                  {client.referralsConfirmed}/{client.referralsSent}
                </td>
                <td className="px-4 py-3">
                  <MakeAdminButton clientId={client.id} onPromoted={() => setPromotedIds((prev) => new Set(prev).add(client.id))} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <p className="p-6 text-center text-sm text-neutral-500">No clients match that search.</p>
        )}
      </div>
    </div>
  );
}

function MakeAdminButton({ clientId, onPromoted }: { clientId: string; onPromoted: () => void }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        onPromoted();
        startTransition(() => {
          promoteToAdmin(clientId);
        });
      }}
      className="whitespace-nowrap text-sm font-medium text-neutral-500 hover:text-neutral-900 hover:underline"
    >
      Make admin
    </button>
  );
}
