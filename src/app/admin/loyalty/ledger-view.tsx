"use client";

import { useActionState, useRef, useEffect, useState, useTransition } from "react";
import { issueManualCredit, revokeCredit } from "./actions";
import { formatDollars, formatShortDate } from "@/lib/format";

type Credit = {
  id: string;
  memberName: string;
  source_type: string;
  amount: number;
  redeemed_amount: number;
  status: string;
  earned_at: string;
  expires_at: string;
};

type Member = { id: string; full_name: string | null };

export default function LedgerView({ credits, members }: { credits: Credit[]; members: Member[] }) {
  return (
    <div className="space-y-6">
      <IssueCreditForm members={members} />

      <ul className="space-y-2">
        {credits.map((credit) => (
          <CreditRow key={credit.id} credit={credit} />
        ))}
      </ul>
    </div>
  );
}

function IssueCreditForm({ members }: { members: Member[] }) {
  const [state, formAction, pending] = useActionState(issueManualCredit, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state && !state.error) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="card space-y-3 border-dashed">
      <p className="field-label mb-0">Issue a manual credit</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <select name="userId" className="field-input" required defaultValue="">
          <option value="" disabled>
            Choose a member
          </option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.full_name ?? m.id}
            </option>
          ))}
        </select>
        <input type="number" name="amount" placeholder="Amount ($)" min={0.01} step={0.01} className="field-input" required />
        <input name="reason" placeholder="Reason" className="field-input" required />
      </div>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button type="submit" disabled={pending} className="btn-primary btn-sm">
        {pending ? "Issuing..." : "Issue credit"}
      </button>
    </form>
  );
}

function CreditRow({ credit }: { credit: Credit }) {
  const [hidden, setHidden] = useState(false);
  const [, startTransition] = useTransition();
  const remaining = credit.amount - credit.redeemed_amount;

  if (hidden) return null;

  function handleRevoke() {
    const reason = window.prompt("Reason for revoking this credit:") ?? "";
    if (!reason) return;
    setHidden(true);
    startTransition(() => {
      const formData = new FormData();
      formData.set("creditId", credit.id);
      formData.set("reason", reason);
      revokeCredit(formData);
    });
  }

  return (
    <li className="card flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-neutral-900">
          {credit.memberName} — {credit.source_type}
        </p>
        <p className="text-xs text-neutral-400">
          Earned {formatShortDate(credit.earned_at)} · Expires {formatShortDate(credit.expires_at)}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <div className="text-right">
          <p className="text-sm font-medium text-neutral-900">
            {formatDollars(remaining)} <span className="text-xs text-neutral-400">of {formatDollars(credit.amount)}</span>
          </p>
          <span className="badge bg-neutral-100 text-neutral-600">{credit.status}</span>
        </div>
        {(credit.status === "pending" || credit.status === "confirmed") && (
          <button type="button" onClick={handleRevoke} className="text-sm font-medium text-rose-600 hover:underline">
            Revoke
          </button>
        )}
      </div>
    </li>
  );
}
