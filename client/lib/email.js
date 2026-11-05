import nodemailer from 'nodemailer';
export async function sendOnboardingConfirmationEmail({ toEmail, fullName, surname, ticketId }) {
  const supportEmail = process.env.SUPPORT_EMAIL || 'support@familytree.org';
  console.log(`[Email Notification] Confirmation email for Ticket #${ticketId} sent to ${toEmail}`);
  return { messageId: 'mock-mail' };
}
