import nodemailer from 'nodemailer';

const APP_URL = (process.env.APP_URL || 'https://family-tree-lineage.vercel.app').replace(/\/+$/, '');
const MAIL_FROM = process.env.MAIL_FROM || 'Family Tree Portal <noreply@family-tree-lineage.vercel.app>';

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST || (process.env.GMAIL_USER ? 'smtp.gmail.com' : undefined);
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER || process.env.GMAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD;

  if (!host || !user || !pass) {
    if (process.env.NODE_ENV === 'production') {
      console.warn('[Email] Note: SMTP credentials are not configured in environment variables (SMTP_HOST, SMTP_USER, SMTP_PASS). Using simulated mode.');
    } else {
      console.warn('[Email] Warning: SMTP configuration missing. Using simulated email transport for development and tests.');
    }
    return null;
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass
    }
  });

  return transporter;
}

/**
 * Generic email dispatcher with logging and fallback
 */
export async function sendEmail({ to, subject, html, text }) {
  const client = getTransporter();

  if (!client) {
    console.log(`[Email Simulated] To: ${to} | Subject: ${subject}`);
    return { ok: true, simulated: true };
  }

  try {
    const info = await client.sendMail({
      from: MAIL_FROM,
      to,
      subject,
      text,
      html
    });
    return { ok: true, messageId: info.messageId, simulated: false };
  } catch (err) {
    console.error(`[Email Error] Failed to send email to ${to}:`, err.message);
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`Email delivery failed: ${err.message}`);
    }
    return { ok: false, error: err.message, simulated: false };
  }
}

/**
 * Send OTP verification code
 */
export async function sendOtpEmail({ toEmail, otpCode, purpose }) {
  const subject = `Your Family Tree Portal verification code: ${otpCode}`;
  const text = `Your 6-digit verification code for ${purpose} is: ${otpCode}\n\nThis code is valid for 5 minutes. Do not share this code with anyone.\n\nFamily Tree Portal: ${APP_URL}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
      <h2 style="color: #1e293b; margin-top: 0;">Family Tree Portal Verification</h2>
      <p style="color: #475569; font-size: 15px;">You requested a verification code for <strong>${purpose}</strong>.</p>
      <div style="background-color: #f1f5f9; padding: 16px; border-radius: 6px; text-align: center; margin: 24px 0;">
        <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #0f172a;">${otpCode}</span>
      </div>
      <p style="color: #64748b; font-size: 13px;">This code will expire in 5 minutes. If you did not request this code, you can safely ignore this email.</p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
      <p style="color: #94a3b8; font-size: 12px; margin-bottom: 0;"><a href="${APP_URL}" style="color: #3b82f6;">Family Tree Portal</a></p>
    </div>
  `;

  const res = await sendEmail({ to: toEmail, subject, html, text });
  if (res.simulated) {
    return { ...res, previewCode: otpCode };
  }
  return res;
}

/**
 * Send Ticket Received confirmation
 */
export async function sendTicketReceivedEmail({ toEmail, fullName, ticketId, requestType }) {
  const ticketUrl = `${APP_URL}/ticket?ticket_id=${ticketId}`;
  const subject = `Request Ticket Received #${ticketId}`;
  const text = `Hello ${fullName || 'User'},\n\nYour request (${requestType}) has been received successfully.\nTicket ID: #${ticketId}\n\nYou can check the status of your ticket at:\n${ticketUrl}\n\nFamily Tree Portal`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
      <h2 style="color: #1e293b; margin-top: 0;">Request Received</h2>
      <p style="color: #475569;">Hello <strong>${fullName || 'User'}</strong>,</p>
      <p style="color: #475569;">Your request for <strong>${requestType}</strong> has been submitted to the Admin for review.</p>
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 6px; margin: 16px 0;">
        <p style="margin: 0; color: #334155;"><strong>Ticket ID:</strong> #${ticketId}</p>
      </div>
      <p style="margin-top: 20px;">
        <a href="${ticketUrl}" style="background-color: #2563eb; color: #ffffff; padding: 10px 18px; text-decoration: none; border-radius: 6px; display: inline-block;">View Ticket Status</a>
      </p>
    </div>
  `;

  return sendEmail({ to: toEmail, subject, html, text });
}

/**
 * Send Approval Notification
 */
export async function sendApprovalEmail({ toEmail, fullName, ticketId, memberRefId }) {
  const portalUrl = `${APP_URL}`;
  const subject = `Request #${ticketId} Approved`;
  const text = `Hello ${fullName || 'User'},\n\nYour request #${ticketId} has been approved by the Admin.\n${memberRefId ? `Your Member Reference ID is: ${memberRefId}\n` : ''}\nView the Family Tree: ${portalUrl}\n\nFamily Tree Portal`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
      <h2 style="color: #166534; margin-top: 0;">Request Approved</h2>
      <p style="color: #475569;">Hello <strong>${fullName || 'User'}</strong>,</p>
      <p style="color: #475569;">Your request #${ticketId} has been approved by the Admin and added to the Family Tree.</p>
      ${memberRefId ? `<p style="color: #1e293b;"><strong>Member Reference ID:</strong> ${memberRefId}</p>` : ''}
      <p style="margin-top: 20px;">
        <a href="${portalUrl}" style="background-color: #16a34a; color: #ffffff; padding: 10px 18px; text-decoration: none; border-radius: 6px; display: inline-block;">Open Family Tree</a>
      </p>
    </div>
  `;

  return sendEmail({ to: toEmail, subject, html, text });
}

/**
 * Send Rejection Notification
 */
export async function sendRejectionEmail({ toEmail, fullName, ticketId, remarks }) {
  const subject = `Update on Request #${ticketId}`;
  const text = `Hello ${fullName || 'User'},\n\nYour request #${ticketId} could not be approved by the Admin at this time.\nRemarks: ${remarks || 'No specific remarks provided.'}\n\nFamily Tree Portal: ${APP_URL}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
      <h2 style="color: #991b1b; margin-top: 0;">Request Update</h2>
      <p style="color: #475569;">Hello <strong>${fullName || 'User'}</strong>,</p>
      <p style="color: #475569;">Your request #${ticketId} could not be approved by the Admin at this time.</p>
      <div style="background-color: #fef2f2; border: 1px solid #fecaca; padding: 12px; border-radius: 6px; margin: 16px 0;">
        <p style="margin: 0; color: #991b1b;"><strong>Admin Remarks:</strong> ${remarks || 'No specific remarks provided.'}</p>
      </div>
    </div>
  `;

  return sendEmail({ to: toEmail, subject, html, text });
}

// Backwards compatibility alias
export async function sendOnboardingConfirmationEmail({ toEmail, fullName, surname, ticketId }) {
  return sendTicketReceivedEmail({ toEmail, fullName, ticketId, requestType: `Onboard Surname (${surname})` });
}
