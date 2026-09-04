import ResetPasswordForm from "./reset-password-form";

export default function ResetPasswordPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-neutral-900">Set a new password</h1>
        <p className="mt-1 text-sm text-neutral-500">Choose a new password for your account.</p>
      </div>

      <ResetPasswordForm />
    </div>
  );
}
