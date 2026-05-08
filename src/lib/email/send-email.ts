/**
 * Thin wrapper around the Resend REST API.
 *
 * Resend is used instead of SMTP to send transactional emails (approval /
 * rejection notifications).  Sign up at https://resend.com — free tier is
 * 3 000 emails/month.
 *
 * Required env vars:
 *   RESEND_API_KEY  — your Resend API key
 *   EMAIL_FROM      — verified sender address (e.g. "noreply@yourdomain.com")
 *                     During development you can use "onboarding@resend.dev"
 *                     which works without domain verification.
 */

const RESEND_API_URL = "https://api.resend.com/emails";

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

/**
 * Sends an email via Resend.
 * Throws if the API call fails.
 */
export async function sendEmail(opts: SendEmailOptions): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from   = process.env.EMAIL_FROM ?? "onboarding@resend.dev";

  if (!apiKey) {
    console.warn("[email] RESEND_API_KEY is not set — skipping email send.");
    return;
  }

  const res = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from,
      to: [opts.to],
      subject: opts.subject,
      html: opts.html,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend API error ${res.status}: ${body}`);
  }
}

// ---------------------------------------------------------------------------
// Email templates
// ---------------------------------------------------------------------------

const appName  = "GA40";
const loginUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://ga40prj.vercel.app";

/**
 * Approval email — sent when an admin approves a sign-up request.
 * Includes the system-generated password.
 * Bilingual: Romanian section first, then English.
 */
export function buildApprovalEmail(opts: {
  username: string;
  password: string;
}): { subject: string; html: string } {
  return {
    subject: `Cont aprobat / Account approved — ${appName}`,
    html: `
<!DOCTYPE html>
<html lang="ro">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:sans-serif;max-width:520px;margin:40px auto;color:#1a1a1a;line-height:1.6">

  <!-- ── Secțiunea română ── -->
  <h2 style="margin-bottom:4px">${appName} — Cont Aprobat</h2>
  <p>Bună ziua, <strong>${opts.username}</strong>,</p>
  <p>Cererea ta de cont a fost aprobată. Te poți conecta folosind datele de mai jos.</p>
  <table style="border-collapse:collapse;margin:24px 0;width:100%">
    <tr>
      <td style="padding:8px 12px;background:#f4f4f5;font-weight:600;width:120px;border-radius:4px 0 0 4px">Utilizator</td>
      <td style="padding:8px 12px;background:#f4f4f5;border-radius:0 4px 4px 0">${opts.username}</td>
    </tr>
    <tr><td colspan="2" style="height:4px"></td></tr>
    <tr>
      <td style="padding:8px 12px;background:#f4f4f5;font-weight:600;border-radius:4px 0 0 4px">Parolă</td>
      <td style="padding:8px 12px;background:#f4f4f5;font-family:monospace;border-radius:0 4px 4px 0">${opts.password}</td>
    </tr>
  </table>
  <p>
    <a href="${loginUrl}/login"
       style="display:inline-block;background:#2563eb;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600">
      Conectare la ${appName}
    </a>
  </p>
  <p style="color:#666;font-size:13px">
    Te rugăm să îți schimbi parola după prima conectare.<br>
    Dacă nu ai solicitat acest cont, poți ignora acest email.
  </p>

  <!-- ── Divider ── -->
  <hr style="border:none;border-top:1px solid #e4e4e7;margin:32px 0">

  <!-- ── English section ── -->
  <h2 style="margin-bottom:4px">${appName} — Account Approved</h2>
  <p>Hi <strong>${opts.username}</strong>,</p>
  <p>Your account request has been approved. You can now log in using the credentials below.</p>
  <table style="border-collapse:collapse;margin:24px 0;width:100%">
    <tr>
      <td style="padding:8px 12px;background:#f4f4f5;font-weight:600;width:120px;border-radius:4px 0 0 4px">Username</td>
      <td style="padding:8px 12px;background:#f4f4f5;border-radius:0 4px 4px 0">${opts.username}</td>
    </tr>
    <tr><td colspan="2" style="height:4px"></td></tr>
    <tr>
      <td style="padding:8px 12px;background:#f4f4f5;font-weight:600;border-radius:4px 0 0 4px">Password</td>
      <td style="padding:8px 12px;background:#f4f4f5;font-family:monospace;border-radius:0 4px 4px 0">${opts.password}</td>
    </tr>
  </table>
  <p>
    <a href="${loginUrl}/login"
       style="display:inline-block;background:#2563eb;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600">
      Log in to ${appName}
    </a>
  </p>
  <p style="color:#666;font-size:13px">
    Please change your password after your first login.<br>
    If you did not request this account, you can ignore this email.
  </p>

</body>
</html>`,
  };
}

/**
 * Rejection email — sent when an admin rejects a sign-up request.
 * Bilingual: Romanian section first, then English.
 */
export function buildRejectionEmail(opts: {
  username: string;
}): { subject: string; html: string } {
  return {
    subject: `Cerere cont / Account request — ${appName}`,
    html: `
<!DOCTYPE html>
<html lang="ro">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:sans-serif;max-width:520px;margin:40px auto;color:#1a1a1a;line-height:1.6">

  <!-- ── Secțiunea română ── -->
  <h2 style="margin-bottom:4px">${appName} — Actualizare cerere cont</h2>
  <p>Bună ziua, <strong>${opts.username}</strong>,</p>
  <p>Vă mulțumim pentru interesul acordat ${appName}. Din păcate, cererea ta de cont nu a putut fi aprobată în acest moment.</p>
  <p style="color:#666;font-size:13px">
    Dacă considerați că este o eroare, vă rugăm să contactați administratorul de sistem.
  </p>

  <!-- ── Divider ── -->
  <hr style="border:none;border-top:1px solid #e4e4e7;margin:32px 0">

  <!-- ── English section ── -->
  <h2 style="margin-bottom:4px">${appName} — Account Request Update</h2>
  <p>Hi <strong>${opts.username}</strong>,</p>
  <p>Thank you for your interest in ${appName}. Unfortunately, your account request could not be approved at this time.</p>
  <p style="color:#666;font-size:13px">
    If you believe this is an error, please contact the system administrator.
  </p>

</body>
</html>`,
  };
}
