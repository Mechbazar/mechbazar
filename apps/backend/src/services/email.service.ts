import nodemailer, { Transporter } from 'nodemailer';
import { Prisma } from '@prisma/client';
import { env, isEmailConfigured } from '../config/env';
import prisma from '../config/prisma';
import { buildOrderConfirmationEmail, OrderConfirmationInput } from '../emails/orderConfirmation';
import { buildVerifyEmailMessage, buildPasswordResetMessage } from '../emails/authAction';

// Fire-and-forget by design, same contract as utils/notify.ts's notifyUser --
// a failed or skipped send must never roll back or delay the flow that
// triggered it (an order is placed regardless of whether the confirmation
// email goes out). Every attempt is logged to EmailLog either way, including
// SKIPPED, so "did we actually email this customer" is answerable from the DB
// without grepping logs.
let transporter: Transporter | null = null;
function getTransporter(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      // 465 is implicit TLS; every other port (587, 25) uses STARTTLS, which
      // nodemailer negotiates itself once connected -- secure: true on those
      // ports would try TLS from the first byte and fail to connect at all.
      secure: env.SMTP_PORT === 465,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    });
  }
  return transporter;
}

interface SendResult {
  status: 'SKIPPED' | 'SENT' | 'FAILED';
  providerMessageId?: string;
}

async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  text: string;
  template: string;
  meta?: Record<string, unknown>;
}): Promise<SendResult> {
  const { to, subject, html, text, template, meta } = params;

  if (!isEmailConfigured()) {
    await prisma.emailLog.create({
      data: { to, subject, template, status: 'SKIPPED', meta: meta as Prisma.InputJsonValue ?? undefined },
    });
    return { status: 'SKIPPED' };
  }

  try {
    const info = await getTransporter().sendMail({
      from: env.EMAIL_FROM,
      to,
      subject,
      html,
      text,
    });

    await prisma.emailLog.create({
      data: {
        to,
        subject,
        template,
        status: 'SENT',
        providerMessageId: info.messageId,
        meta: meta as Prisma.InputJsonValue ?? undefined,
      },
    });
    return { status: 'SENT', providerMessageId: info.messageId };
  } catch (error) {
    console.error(`[email] send failed (template=${template}, to=${to}):`, error);
    await prisma.emailLog.create({
      data: {
        to,
        subject,
        template,
        status: 'FAILED',
        error: error instanceof Error ? error.message : String(error),
        meta: meta as Prisma.InputJsonValue ?? undefined,
      },
    });
    return { status: 'FAILED' };
  }
}

// Never throws -- called fire-and-forget from order.controller.ts right after
// the order transaction commits, same as notifyUser there. `to` being
// null/empty (phone-only accounts, the majority today -- see User.email being
// optional in schema.prisma) is not an error condition, just nothing to do.
export async function sendOrderConfirmationEmail(to: string | null | undefined, order: OrderConfirmationInput): Promise<void> {
  if (!to) return;
  try {
    const { subject, html, text } = buildOrderConfirmationEmail(order);
    await sendEmail({ to, subject, html, text, template: 'order-confirmation', meta: { orderId: order.orderId } });
  } catch (error) {
    console.error('[email] sendOrderConfirmationEmail error:', error);
  }
}

// Both of these back utils/firebasePassword.ts's verify-email/reset-password
// senders, which deliver through this mailer (Hostinger SMTP) rather than
// Firebase's own automatic send specifically so the link can point at our own
// AuthAction page instead of Firebase's auto-consuming hosted one -- see that
// file for the full story. Unlike sendOrderConfirmationEmail, callers need to
// know whether delivery actually happened (a SKIPPED/FAILED send there is a
// hard failure, not silently telling the user "email sent").
export async function sendVerificationEmail(to: string, link: string): Promise<boolean> {
  const { subject, html, text } = buildVerifyEmailMessage(link);
  const result = await sendEmail({ to, subject, html, text, template: 'verify-email' });
  return result.status === 'SENT';
}

export async function sendPasswordResetEmail(to: string, link: string): Promise<boolean> {
  const { subject, html, text } = buildPasswordResetMessage(link);
  const result = await sendEmail({ to, subject, html, text, template: 'password-reset' });
  return result.status === 'SENT';
}
