import nodemailer from 'nodemailer';
import { config } from '../config.js';

let transporter;
function getTransporter() {
  if (!config.smtp.host) return null;
  transporter ??= nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.port === 465,
    auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
  });
  return transporter;
}

/** Sends an alert email. Without SMTP configured, logs to the console. Never throws. */
export async function sendAlert({ to, subject, text }) {
  const t = getTransporter();
  if (!t) {
    if (!config.isTest) console.log(`[alert] to=${to} | ${subject}\n${text}`);
    return;
  }
  try {
    await t.sendMail({ from: config.smtp.from, to, subject, text });
  } catch (err) {
    console.error('[alert] failed to send email:', err.message);
  }
}
