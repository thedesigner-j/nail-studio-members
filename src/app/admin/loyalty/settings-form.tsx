"use client";

import { useActionState } from "react";
import { updateRewardSettings } from "./actions";

type Settings = {
  session_credit_percent: number;
  account_creation_credit: number;
  referral_credit: number;
  repost_credit: number;
  review_credit: number;
  credit_expiration_days: number;
  referral_link_expiration_days: number;
};

export default function SettingsForm({ settings }: { settings: Settings }) {
  const [state, formAction, pending] = useActionState(updateRewardSettings, null);

  return (
    <form action={formAction} className="card grid gap-4 sm:grid-cols-2">
      <div>
        <label className="field-label">Session credit (% of ticket)</label>
        <input
          type="number"
          name="sessionCreditPercent"
          defaultValue={settings.session_credit_percent}
          min={0}
          step={0.1}
          className="field-input"
          required
        />
      </div>
      <div>
        <label className="field-label">Account creation credit ($)</label>
        <input
          type="number"
          name="accountCreationCredit"
          defaultValue={settings.account_creation_credit}
          min={0}
          step={0.01}
          className="field-input"
          required
        />
      </div>
      <div>
        <label className="field-label">Referral credit ($)</label>
        <input
          type="number"
          name="referralCredit"
          defaultValue={settings.referral_credit}
          min={0}
          step={0.01}
          className="field-input"
          required
        />
      </div>
      <div>
        <label className="field-label">Repost credit ($)</label>
        <input
          type="number"
          name="repostCredit"
          defaultValue={settings.repost_credit}
          min={0}
          step={0.01}
          className="field-input"
          required
        />
      </div>
      <div>
        <label className="field-label">Review credit ($)</label>
        <input
          type="number"
          name="reviewCredit"
          defaultValue={settings.review_credit}
          min={0}
          step={0.01}
          className="field-input"
          required
        />
      </div>
      <div>
        <label className="field-label">Credit expiration (days)</label>
        <input
          type="number"
          name="creditExpirationDays"
          defaultValue={settings.credit_expiration_days}
          min={1}
          className="field-input"
          required
        />
      </div>
      <div>
        <label className="field-label">Referral link expiration (days)</label>
        <input
          type="number"
          name="referralLinkExpirationDays"
          defaultValue={settings.referral_link_expiration_days}
          min={1}
          className="field-input"
          required
        />
      </div>

      <div className="sm:col-span-2">
        {state?.error ? (
          <p className="text-sm text-red-600">{state.error}</p>
        ) : state && !state.error ? (
          <p className="text-sm text-emerald-600">Saved.</p>
        ) : null}

        <button type="submit" disabled={pending} className="btn-primary mt-2">
          {pending ? "Saving..." : "Save settings"}
        </button>
      </div>
    </form>
  );
}
