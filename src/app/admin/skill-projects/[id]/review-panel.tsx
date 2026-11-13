"use client";

import { useActionState, useState } from "react";
import { reviewSubmission } from "../actions";

export default function ReviewPanel({ projectId, submissionId }: { projectId: string; submissionId: string }) {
  const [state, formAction, pending] = useActionState(reviewSubmission, null);
  const [feedback, setFeedback] = useState("");

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="submissionId" value={submissionId} />

      <div>
        <label className="field-label" htmlFor="feedback">
          Feedback
        </label>
        <textarea
          id="feedback"
          name="feedback"
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          rows={3}
          placeholder="What looks great, and what to work on next time"
          className="field-input"
        />
        <p className="mt-1 text-xs text-neutral-500">Required to send it back. Optional when approving.</p>
      </div>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

      <div className="flex flex-wrap gap-2">
        <button type="submit" name="decision" value="approve" disabled={pending} className="btn-primary">
          Approve
        </button>
        <button type="submit" name="decision" value="send_back" disabled={pending} className="btn-secondary">
          Send back for another try
        </button>
      </div>
    </form>
  );
}
