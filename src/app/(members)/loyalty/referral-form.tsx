"use client";

import { useState, useTransition } from "react";
import { createReferralInvite } from "./actions";

export default function ReferralForm() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function handleGetLink() {
    setError(null);
    setCopied(false);
    startTransition(async () => {
      const result = await createReferralInvite();
      if (!result.message) {
        setError(result.error);
        return;
      }
      setMessage(result.message);
    });
  }

  async function handleCopy() {
    if (!message) return;
    await navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!message) {
    return (
      <div>
        <button type="button" onClick={handleGetLink} disabled={pending} className="btn-primary">
          {pending ? "Creating link..." : "Get my referral link"}
        </button>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <textarea readOnly value={message} rows={3} className="field-input bg-neutral-50 text-neutral-600" />
      <div className="flex items-center gap-2">
        <button type="button" onClick={handleCopy} className="btn-primary btn-sm">
          {copied ? "Copied! 🎉" : "Copy message"}
        </button>
        <button type="button" onClick={handleGetLink} disabled={pending} className="btn-secondary btn-sm">
          New link
        </button>
      </div>
      <p className="text-xs text-neutral-400">
        Paste this into a text, DM, or email to your friend — however you&apos;d normally reach them.
      </p>
    </div>
  );
}
