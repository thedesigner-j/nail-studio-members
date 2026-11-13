import { Resend } from "resend";
import { getBranding } from "@/lib/branding";

// Lazy singleton, same reasoning as lib/stripe.ts: constructing this at
// module load time would fail the build whenever RESEND_API_KEY isn't set
// yet, even on routes that never send email at runtime.
let resendClient: Resend | null = null;

function getResend(): Resend {
  if (!resendClient) {
    if (!process.env.RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not configured.");
    }
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
}

// Resend's shared test address works with no domain setup at all, but can
// only send to the email you signed up to Resend with — set EMAIL_FROM
// once a sending domain is verified so real members can receive mail.
// Only the address part of EMAIL_FROM is used: the sender name shown in
// inboxes is the studio name from Admin > Branding.
async function fromAddress() {
  const configured = process.env.EMAIL_FROM || "onboarding@resend.dev";
  const address = configured.match(/<([^>]+)>/)?.[1] ?? configured.trim();
  const { name } = await getBranding();
  return `${name.replace(/[<>"]/g, "")} <${address}>`;
}

export async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }) {
  await getResend().emails.send({ from: await fromAddress(), to, subject, html });
}
