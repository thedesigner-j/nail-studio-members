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
