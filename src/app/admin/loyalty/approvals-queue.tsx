"use client";

import { useEffect, useState, useTransition } from "react";
import {
  approveReviewSubmission,
  rejectReviewSubmission,
  approveRepostSubmission,
  rejectRepostSubmission,
  getSignedReviewProofUrl,
} from "./actions";

type ReviewSubmission = {
  id: string;
  memberName: string;
  proof_link: string | null;
  proof_url: string | null;
  review_platforms: { name: string } | null;
};

type RepostSubmission = {
  id: string;
  memberName: string;
  announcements: { title: string } | null;
};

export default function ApprovalsQueue({
  reviewSubmissions,
  repostSubmissions,
}: {
  reviewSubmissions: ReviewSubmission[];
  repostSubmissions: RepostSubmission[];
}) {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="mb-3 font-medium text-neutral-900">Review submissions</h2>
        {reviewSubmissions.length === 0 ? (
          <p className="text-sm text-neutral-500">Nothing pending.</p>
        ) : (
          <ul className="space-y-3">
            {reviewSubmissions.map((s) => (
              <ReviewSubmissionRow key={s.id} submission={s} />
            ))}
          </ul>
        )}
      </div>

      <div>
        <h2 className="mb-3 font-medium text-neutral-900">Repost submissions</h2>
        {repostSubmissions.length === 0 ? (
          <p className="text-sm text-neutral-500">Nothing pending.</p>
        ) : (
          <ul className="space-y-3">
            {repostSubmissions.map((s) => (
              <RepostSubmissionRow key={s.id} submission={s} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ReviewSubmissionRow({ submission }: { submission: ReviewSubmission }) {
  const [hidden, setHidden] = useState(false);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (submission.proof_url) {
      getSignedReviewProofUrl(submission.proof_url).then(setSignedUrl);
    }
  }, [submission.proof_url]);

  if (hidden) return null;

  function handleApprove() {
    setHidden(true);
    startTransition(() => approveReviewSubmission(submission.id));
  }

  function handleReject() {
    const reason = window.prompt("Reason for rejecting (optional):") ?? "";
    setHidden(true);
    startTransition(() => rejectReviewSubmission(submission.id, reason));
  }

  return (
    <li className="card space-y-3">
      <div className="flex items-center justify-between">
        <p className="font-medium text-neutral-900">
          {submission.memberName} — {submission.review_platforms?.name ?? "Platform"}
        </p>
      </div>

      {submission.proof_link && (
        <a
          href={submission.proof_link}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-sm text-neutral-600 underline"
        >
          {submission.proof_link}
        </a>
      )}

      {signedUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- signed URL to a private bucket, not a next/image-friendly static source
        <img src={signedUrl} alt="Review proof" className="max-h-64 rounded-lg border border-neutral-200" />
      )}

      <div className="flex gap-2">
        <button type="button" onClick={handleApprove} className="btn-primary btn-sm">
          Approve
        </button>
        <button type="button" onClick={handleReject} className="btn-secondary btn-sm">
          Reject
        </button>
      </div>
    </li>
  );
}

function RepostSubmissionRow({ submission }: { submission: RepostSubmission }) {
  const [hidden, setHidden] = useState(false);
  const [, startTransition] = useTransition();

  if (hidden) return null;

  function handleApprove() {
    setHidden(true);
    startTransition(() => approveRepostSubmission(submission.id));
  }

  function handleReject() {
    const reason = window.prompt("Reason for rejecting (optional):") ?? "";
    setHidden(true);
    startTransition(() => rejectRepostSubmission(submission.id, reason));
  }

  return (
    <li className="card flex items-center justify-between">
      <p className="font-medium text-neutral-900">
        {submission.memberName} — {submission.announcements?.title ?? "Post"}
      </p>
      <div className="flex gap-2">
        <button type="button" onClick={handleApprove} className="btn-primary btn-sm">
          Approve
        </button>
        <button type="button" onClick={handleReject} className="btn-secondary btn-sm">
          Reject
        </button>
      </div>
    </li>
  );
}
