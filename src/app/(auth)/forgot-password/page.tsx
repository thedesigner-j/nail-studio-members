import Link from "next/link";
import ForgotPasswordForm from "./forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-neutral-900">Reset your password</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Enter your email and we&apos;ll send you a link to set a new password.
        </p>
      </div>

      <ForgotPasswordForm />

      <p className="text-center text-sm text-neutral-500">
        <Link href="/login" className="font-medium text-neutral-900 underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
