import Link from "next/link";
import SignupForm from "../signup/signup-form";
import { getRewardSettings } from "@/lib/data";
import { formatDollars } from "@/lib/format";

export default async function JoinPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const settings = await getRewardSettings();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-neutral-900">You&apos;re invited</h1>
        <p className="mt-1 text-sm text-neutral-500">
          A friend sent you here — create an account and get{" "}
          {settings ? formatDollars(settings.account_creation_credit) : "credit"} toward your first
          visit.
        </p>
      </div>

      <SignupForm referralToken={token} />

      <p className="text-center text-sm text-neutral-500">
        Already a member?{" "}
        <Link href="/login" className="font-medium text-neutral-900 underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
