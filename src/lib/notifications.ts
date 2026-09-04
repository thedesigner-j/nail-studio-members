import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email";
import { formatAppointmentTime, formatCurrency } from "@/lib/format";

export async function sendBookingConfirmationEmail(params: {
  to: string;
  memberName: string | null;
  serviceName: string;
  startsAt: string;
  paidTodayCents: number;
  remainingCents: number;
}) {
  const firstName = params.memberName?.split(" ")[0] ?? "there";

  const html = `
    <div style="font-family: -apple-system, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #171717;">
      <h1 style="font-size: 20px; margin: 0 0 4px;">You're booked, ${firstName}! 🎉</h1>
      <p style="color: #525252; margin: 0 0 16px;">Here's your confirmation for Nail Studio.</p>
      <div style="background: #fafaf9; border-radius: 12px; padding: 16px; margin-bottom: 16px;">
        <p style="margin: 0 0 4px; font-weight: 600;">${params.serviceName}</p>
        <p style="margin: 0; color: #525252;">${formatAppointmentTime(params.startsAt)}</p>
      </div>
      <p style="margin: 4px 0;">Paid today: <strong>${formatCurrency(params.paidTodayCents)}</strong></p>
      ${
        params.remainingCents > 0
          ? `<p style="margin: 4px 0;">Due at your appointment: <strong>${formatCurrency(params.remainingCents)}</strong></p>`
          : ""
      }
      <p style="margin-top: 24px; color: #525252;">See you soon!</p>
    </div>
  `;

  await sendEmail({
    to: params.to,
    subject: `Booking confirmed: ${params.serviceName} on ${formatAppointmentTime(params.startsAt)}`,
    html,
  });
}

export async function sendRescheduleEmail(params: {
  to: string;
  memberName: string | null;
  serviceName: string;
  previousStartsAt: string;
  newStartsAt: string;
}) {
  const firstName = params.memberName?.split(" ")[0] ?? "there";

  const html = `
    <div style="font-family: -apple-system, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #171717;">
      <h1 style="font-size: 20px; margin: 0 0 4px;">Appointment rescheduled</h1>
      <p style="color: #525252; margin: 0 0 16px;">Hi ${firstName}, your appointment below has a new time.</p>
      <div style="background: #fafaf9; border-radius: 12px; padding: 16px; margin-bottom: 16px;">
        <p style="margin: 0 0 4px; font-weight: 600;">${params.serviceName}</p>
        <p style="margin: 0; color: #a3a3a3; text-decoration: line-through;">${formatAppointmentTime(params.previousStartsAt)}</p>
        <p style="margin: 4px 0 0; color: #171717; font-weight: 600;">${formatAppointmentTime(params.newStartsAt)}</p>
      </div>
      <p style="margin-top: 24px; color: #525252;">See you then!</p>
    </div>
  `;

  await sendEmail({
    to: params.to,
    subject: `Rescheduled: ${params.serviceName} — now ${formatAppointmentTime(params.newStartsAt)}`,
    html,
  });
}

export async function sendCancellationEmail(params: {
  to: string;
  memberName: string | null;
  serviceName: string;
  startsAt: string;
  cancelledByStudio: boolean;
  refundedCents: number;
}) {
  const firstName = params.memberName?.split(" ")[0] ?? "there";

  const html = `
    <div style="font-family: -apple-system, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #171717;">
      <h1 style="font-size: 20px; margin: 0 0 4px;">Appointment cancelled</h1>
      <p style="color: #525252; margin: 0 0 16px;">
        ${
          params.cancelledByStudio
            ? `Hi ${firstName}, the studio had to cancel your appointment below. Sorry for the inconvenience — reach out or rebook whenever works for you.`
            : `Hi ${firstName}, this confirms your appointment below has been cancelled.`
        }
      </p>
      <div style="background: #fafaf9; border-radius: 12px; padding: 16px; margin-bottom: 16px;">
        <p style="margin: 0 0 4px; font-weight: 600;">${params.serviceName}</p>
        <p style="margin: 0; color: #525252;">${formatAppointmentTime(params.startsAt)}</p>
      </div>
      ${
        params.refundedCents > 0
          ? `<p style="margin: 4px 0;">Refunded: <strong>${formatCurrency(params.refundedCents)}</strong></p>`
          : ""
      }
    </div>
  `;

  await sendEmail({
    to: params.to,
    subject: `Cancelled: ${params.serviceName} on ${formatAppointmentTime(params.startsAt)}`,
    html,
  });
}

export async function sendAdminCancellationNotice(params: {
  to: string[];
  memberName: string | null;
  serviceName: string;
  startsAt: string;
}) {
  if (params.to.length === 0) return;

  const html = `
    <div style="font-family: -apple-system, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #171717;">
      <h1 style="font-size: 20px; margin: 0 0 4px;">A client cancelled</h1>
      <div style="background: #fafaf9; border-radius: 12px; padding: 16px;">
        <p style="margin: 0 0 4px; font-weight: 600;">${params.serviceName}</p>
        <p style="margin: 0; color: #525252;">${formatAppointmentTime(params.startsAt)}</p>
        <p style="margin: 8px 0 0; color: #525252;">${params.memberName ?? "A member"}</p>
      </div>
    </div>
  `;

  await Promise.all(
    params.to.map((to) =>
      sendEmail({
        to,
        subject: `Client cancelled: ${params.serviceName} on ${formatAppointmentTime(params.startsAt)}`,
        html,
      }),
    ),
  );
}

export async function sendAdminRescheduleNotice(params: {
  to: string[];
  memberName: string | null;
  serviceName: string;
  previousStartsAt: string;
  newStartsAt: string;
}) {
  if (params.to.length === 0) return;

  const html = `
    <div style="font-family: -apple-system, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #171717;">
      <h1 style="font-size: 20px; margin: 0 0 4px;">A client rescheduled</h1>
      <div style="background: #fafaf9; border-radius: 12px; padding: 16px;">
        <p style="margin: 0 0 4px; font-weight: 600;">${params.serviceName}</p>
        <p style="margin: 0; color: #a3a3a3; text-decoration: line-through;">${formatAppointmentTime(params.previousStartsAt)}</p>
        <p style="margin: 4px 0 0; color: #171717; font-weight: 600;">${formatAppointmentTime(params.newStartsAt)}</p>
        <p style="margin: 8px 0 0; color: #525252;">${params.memberName ?? "A member"}</p>
      </div>
    </div>
  `;

  await Promise.all(
    params.to.map((to) =>
      sendEmail({
        to,
        subject: `Client rescheduled: ${params.serviceName} — now ${formatAppointmentTime(params.newStartsAt)}`,
        html,
      }),
    ),
  );
}

export async function sendNewMessageEmail(params: { to: string; memberName: string | null }) {
  const firstName = params.memberName?.split(" ")[0] ?? "there";
  const appUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";

  const html = `
    <div style="font-family: -apple-system, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #171717;">
      <h1 style="font-size: 20px; margin: 0 0 4px;">New message from the studio</h1>
      <p style="color: #525252; margin: 0 0 16px;">Hi ${firstName}, you've got a new message — log in to read and reply.</p>
      ${
        appUrl
          ? `<a href="${appUrl}/messages" style="display: inline-block; background: #171717; color: #fff; text-decoration: none; padding: 10px 16px; border-radius: 8px; font-size: 14px;">View message</a>`
          : ""
      }
    </div>
  `;

  await sendEmail({ to: params.to, subject: "New message from Nail Studio", html });
}

// Every profile flagged is_admin gets studio notification emails (a client
// cancelling, etc.) — auth.users isn't exposed via the normal data API, so
// each admin's email has to come from the admin API rather than a join.
export async function getAdminEmails(serviceRole: SupabaseClient): Promise<string[]> {
  const { data: admins } = await serviceRole.from("profiles").select("id").eq("is_admin", true);

  const emails = await Promise.all(
    (admins ?? []).map(async (admin) => {
      const { data } = await serviceRole.auth.admin.getUserById(admin.id);
      return data?.user?.email ?? null;
    }),
  );

  return emails.filter((email): email is string => Boolean(email));
}
