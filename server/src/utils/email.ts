import nodemailer from "nodemailer";
import { env } from "../config/env";

let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (!env.smtp.isConfigured) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.port === 465,
      auth: { user: env.smtp.user, pass: env.smtp.pass },
    });
  }
  return transporter;
}

export async function sendEmail(to: string, subject: string, text: string, html?: string) {
  const t = getTransporter();

  if (!t) {
    // Dev fallback: no SMTP configured, print to server console so the flow is still testable.
    // eslint-disable-next-line no-console
    console.log(`\n[EMAIL - SMTP not configured, printing instead]\nTo: ${to}\nSubject: ${subject}\n${text}\n`);
    return;
  }

  await t.sendMail({ from: env.smtp.from, to, subject, text, html });
}
