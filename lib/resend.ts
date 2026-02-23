import nodemailer from 'nodemailer'

// ─── Gmail SMTP Transport ─────────────────────────────────────────────────────
// Uses Gmail App Password for authentication. Works with any recipient.
let _transporter: nodemailer.Transporter | null = null
function getTransporter() {
  if (!_transporter) {
    _transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.SMTP_USER!,
        pass: process.env.SMTP_PASS!,
      },
    })
  }
  return _transporter
}

const FROM = `UtilSign <${process.env.SMTP_USER!}>`
const getAppUrl = () => process.env.NEXT_PUBLIC_APP_URL!

// ─── Helper: send an email via Gmail SMTP ─────────────────────────────────────
async function sendMail({ to, subject, html }: { to: string; subject: string; html: string }) {
  return getTransporter().sendMail({ from: FROM, to, subject, html })
}

// ─── 1. Signing Request Email ─────────────────────────────────────────────────
export async function sendSigningRequest({
  to,
  senderName,
  documentName,
  signLink,
  customSubject,
  customMessage,
}: {
  to: string
  senderName: string
  documentName: string
  signLink: string
  customSubject?: string
  customMessage?: string
}) {
  const subject = customSubject || `${senderName} has requested your signature on "${documentName}"`
  const messageBlock = customMessage
    ? `<div style="background:#fafafa;border-left:4px solid #6366f1;border-radius:0 8px 8px 0;padding:16px 20px;margin:20px 0;"><p style="color:#4b5563;font-size:14px;line-height:1.6;margin:0;font-style:italic;">${customMessage.replace(/\n/g, '<br>')}</p></div>`
    : ''

  return sendMail({
    to,
    subject,
    html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Signature Request</title></head>
<body style="margin:0;padding:0;background:#f8faff;font-family:Inter,system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8faff;padding:40px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(99,102,241,0.08);">
        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#4f46e5,#6366f1);padding:32px 40px;text-align:center;">
          <h1 style="color:#ffffff;font-size:24px;font-weight:700;margin:0;letter-spacing:-0.5px;">✍️ UtilSign</h1>
          <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:14px;">Secure E-Signature Platform</p>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:40px;">
          <h2 style="color:#1e1b4b;font-size:20px;font-weight:600;margin:0 0 12px;">Signature Requested</h2>
          <p style="color:#4b5563;font-size:15px;line-height:1.6;margin:0 0 8px;">
            <strong style="color:#1e1b4b;">${senderName}</strong> has requested your electronic signature on the following document:
          </p>
          <div style="background:#f0f4ff;border-left:4px solid #6366f1;border-radius:0 8px 8px 0;padding:16px 20px;margin:20px 0;">
            <p style="color:#312e81;font-size:15px;font-weight:600;margin:0;">📄 ${documentName}</p>
          </div>
          ${messageBlock}
          <p style="color:#4b5563;font-size:14px;line-height:1.6;margin:0 0 24px;">
            Click the button below to review and sign this document. You will be asked to verify your identity with a one-time code sent to your email.
          </p>
          <div style="text-align:center;margin:32px 0;">
            <a href="${signLink}" style="display:inline-block;background:linear-gradient(135deg,#4f46e5,#6366f1);color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;padding:14px 40px;border-radius:8px;letter-spacing:0.3px;">
              Review &amp; Sign Document →
            </a>
          </div>
          <p style="color:#9ca3af;font-size:12px;line-height:1.6;margin:24px 0 0;text-align:center;">
            This link is personal to you. Do not share it. It expires in 7 days.<br>
            If you did not expect this request, please ignore this email.
          </p>
        </td></tr>
        <!-- Footer -->
        <tr><td style="background:#f8faff;padding:20px 40px;text-align:center;border-top:1px solid #e5e7eb;">
          <p style="color:#9ca3af;font-size:12px;margin:0;">Powered by <a href="${getAppUrl()}" style="color:#6366f1;text-decoration:none;">UtilSign</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  })
}

// ─── 2. OTP Verification Email ────────────────────────────────────────────────
export async function sendOTPEmail({
  to,
  otp,
  documentName,
}: {
  to: string
  otp: string
  documentName: string
}) {
  return sendMail({
    to,
    subject: `Your UtilSign verification code: ${otp}`,
    html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Verification Code</title></head>
<body style="margin:0;padding:0;background:#f8faff;font-family:Inter,system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8faff;padding:40px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(99,102,241,0.08);">
        <tr><td style="background:linear-gradient(135deg,#4f46e5,#6366f1);padding:32px 40px;text-align:center;">
          <h1 style="color:#ffffff;font-size:24px;font-weight:700;margin:0;">🔐 Identity Verification</h1>
        </td></tr>
        <tr><td style="padding:40px;text-align:center;">
          <p style="color:#4b5563;font-size:15px;line-height:1.6;margin:0 0 8px;">Your one-time verification code for signing:</p>
          <p style="color:#312e81;font-size:14px;font-weight:500;margin:0 0 24px;">📄 ${documentName}</p>
          <div style="background:#f0f4ff;border-radius:12px;padding:24px;margin:0 0 24px;display:inline-block;width:100%;box-sizing:border-box;">
            <p style="color:#4f46e5;font-size:48px;font-weight:700;letter-spacing:12px;margin:0;font-family:'Courier New',monospace;">${otp}</p>
          </div>
          <div style="background:#fef3c7;border:1px solid #f59e0b;border-radius:8px;padding:12px 16px;margin:0 0 24px;text-align:left;">
            <p style="color:#92400e;font-size:13px;margin:0;font-weight:600;">⚠️ This code expires in 10 minutes.</p>
          </div>
          <p style="color:#9ca3af;font-size:13px;line-height:1.6;margin:0;">
            Never share this code with anyone. UtilSign staff will never ask for it.<br>
            If you did not request this, someone may have your sign link — contact support immediately.
          </p>
        </td></tr>
        <tr><td style="background:#f8faff;padding:20px 40px;text-align:center;border-top:1px solid #e5e7eb;">
          <p style="color:#9ca3af;font-size:12px;margin:0;">Powered by <a href="${getAppUrl()}" style="color:#6366f1;text-decoration:none;">UtilSign</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  })
}

// ─── 3. Next Signer Notification ──────────────────────────────────────────────
export async function sendNextSignerEmail({
  to,
  previousSignerName,
  documentName,
  signLink,
}: {
  to: string
  previousSignerName: string
  documentName: string
  signLink: string
}) {
  return sendMail({
    to,
    subject: `It's your turn to sign "${documentName}"`,
    html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Your Turn to Sign</title></head>
<body style="margin:0;padding:0;background:#f8faff;font-family:Inter,system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8faff;padding:40px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(99,102,241,0.08);">
        <tr><td style="background:linear-gradient(135deg,#4f46e5,#6366f1);padding:32px 40px;text-align:center;">
          <h1 style="color:#ffffff;font-size:24px;font-weight:700;margin:0;">✍️ Your Turn to Sign</h1>
        </td></tr>
        <tr><td style="padding:40px;">
          <p style="color:#4b5563;font-size:15px;line-height:1.6;margin:0 0 16px;">
            <strong style="color:#1e1b4b;">${previousSignerName}</strong> has completed their signature. It's now your turn to sign:
          </p>
          <div style="background:#f0f4ff;border-left:4px solid #6366f1;border-radius:0 8px 8px 0;padding:16px 20px;margin:0 0 24px;">
            <p style="color:#312e81;font-size:15px;font-weight:600;margin:0;">📄 ${documentName}</p>
          </div>
          <div style="text-align:center;margin:32px 0;">
            <a href="${signLink}" style="display:inline-block;background:linear-gradient(135deg,#4f46e5,#6366f1);color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;padding:14px 40px;border-radius:8px;">
              Review &amp; Sign Now →
            </a>
          </div>
          <p style="color:#9ca3af;font-size:12px;line-height:1.6;text-align:center;margin:0;">
            This link is personal to you. Do not share it. It expires in 7 days.
          </p>
        </td></tr>
        <tr><td style="background:#f8faff;padding:20px 40px;text-align:center;border-top:1px solid #e5e7eb;">
          <p style="color:#9ca3af;font-size:12px;margin:0;">Powered by <a href="${getAppUrl()}" style="color:#6366f1;text-decoration:none;">UtilSign</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  })
}

// ─── 4. Sender Completion Notification ────────────────────────────────────────
export async function sendCompletionEmail({
  to,
  documentName,
  signers,
  downloadUrl,
}: {
  to: string
  documentName: string
  signers: Array<{ email: string; signedAt: string }>
  downloadUrl: string
}) {
  const signerRows = signers.map(s =>
    `<tr>
       <td style="padding:10px 16px;color:#374151;font-size:14px;border-bottom:1px solid #f3f4f6;">✅ ${s.email}</td>
       <td style="padding:10px 16px;color:#6b7280;font-size:13px;border-bottom:1px solid #f3f4f6;text-align:right;">${new Date(s.signedAt).toLocaleString()}</td>
     </tr>`
  ).join('')

  return sendMail({
    to,
    subject: `"${documentName}" has been fully signed`,
    html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Document Complete</title></head>
<body style="margin:0;padding:0;background:#f8faff;font-family:Inter,system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8faff;padding:40px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(99,102,241,0.08);">
        <tr><td style="background:linear-gradient(135deg,#059669,#10b981);padding:32px 40px;text-align:center;">
          <h1 style="color:#ffffff;font-size:24px;font-weight:700;margin:0;">🎉 Document Complete!</h1>
        </td></tr>
        <tr><td style="padding:40px;">
          <p style="color:#4b5563;font-size:15px;line-height:1.6;margin:0 0 8px;">All parties have signed:</p>
          <p style="color:#1e1b4b;font-size:16px;font-weight:600;margin:0 0 24px;">📄 ${documentName}</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin:0 0 32px;">
            <tr style="background:#f8faff;">
              <th style="padding:10px 16px;text-align:left;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Signer</th>
              <th style="padding:10px 16px;text-align:right;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Signed At</th>
            </tr>
            ${signerRows}
          </table>
          <div style="text-align:center;">
            <a href="${downloadUrl}" style="display:inline-block;background:linear-gradient(135deg,#059669,#10b981);color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;padding:14px 40px;border-radius:8px;">
              Download Signed PDF ↓
            </a>
          </div>
        </td></tr>
        <tr><td style="background:#f8faff;padding:20px 40px;text-align:center;border-top:1px solid #e5e7eb;">
          <p style="color:#9ca3af;font-size:12px;margin:0;">Powered by <a href="${getAppUrl()}" style="color:#6366f1;text-decoration:none;">UtilSign</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  })
}

// ─── 5. Signer Declined Notification ─────────────────────────────────────────
export async function sendDeclinedEmail({
  to,
  signerEmail,
  documentName,
  declinedAt,
}: {
  to: string
  signerEmail: string
  documentName: string
  declinedAt: string
}) {
  return sendMail({
    to,
    subject: `"${documentName}" — signer declined`,
    html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Signer Declined</title></head>
<body style="margin:0;padding:0;background:#f8faff;font-family:Inter,system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8faff;padding:40px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(99,102,241,0.08);">
        <tr><td style="background:linear-gradient(135deg,#dc2626,#ef4444);padding:32px 40px;text-align:center;">
          <h1 style="color:#ffffff;font-size:24px;font-weight:700;margin:0;">❌ Signature Declined</h1>
        </td></tr>
        <tr><td style="padding:40px;">
          <p style="color:#4b5563;font-size:15px;line-height:1.6;margin:0 0 20px;">
            A signer has declined to sign your document. The signing process has been cancelled.
          </p>
          <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:20px;margin:0 0 24px;">
            <p style="color:#7f1d1d;font-size:14px;margin:0 0 8px;"><strong>Document:</strong> ${documentName}</p>
            <p style="color:#7f1d1d;font-size:14px;margin:0 0 8px;"><strong>Declined by:</strong> ${signerEmail}</p>
            <p style="color:#7f1d1d;font-size:14px;margin:0;"><strong>Declined at:</strong> ${new Date(declinedAt).toLocaleString()}</p>
          </div>
          <p style="color:#4b5563;font-size:14px;line-height:1.6;margin:0;">
            You may upload a new document and restart the signing process if needed.
          </p>
        </td></tr>
        <tr><td style="background:#f8faff;padding:20px 40px;text-align:center;border-top:1px solid #e5e7eb;">
          <p style="color:#9ca3af;font-size:12px;margin:0;">Powered by <a href="${getAppUrl()}" style="color:#6366f1;text-decoration:none;">UtilSign</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  })
}

//  6. Broadcast Notification (non-first signers on initial send) 
export async function sendBroadcastNotification({
  to,
  documentName,
  senderName,
  currentSignerEmail,
  signerPosition,
  totalSigners,
}: {
  to: string
  documentName: string
  senderName: string
  currentSignerEmail: string
  signerPosition: number
  totalSigners: number
}) {
  const waitCount = signerPosition - 1
  return sendMail({
    to,
    subject: `You are signer #${signerPosition} on "${documentName}"`,
    html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Document Sent for Signing</title></head>
<body style="margin:0;padding:0;background:#f8faff;font-family:Inter,system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8faff;padding:40px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(99,102,241,0.08);">
        <tr><td style="background:linear-gradient(135deg,#4f46e5,#6366f1);padding:32px 40px;text-align:center;">
          <h1 style="color:#fff;font-size:22px;font-weight:700;margin:0;">Document Sent for Signing</h1>
          <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:13px;">You are in the signing queue</p>
        </td></tr>
        <tr><td style="padding:36px;">
          <p style="color:#4b5563;font-size:15px;line-height:1.6;margin:0 0 16px;"><strong style="color:#1e1b4b;">${senderName}</strong> has sent <strong>${documentName}</strong> for signing.</p>
          <div style="background:#fef3c7;border:1px solid #f59e0b;border-radius:8px;padding:16px 20px;margin:0 0 20px;">
            <p style="color:#92400e;font-size:14px;font-weight:600;margin:0 0 6px;">Your position: Signer #${signerPosition} of ${totalSigners}</p>
            <p style="color:#92400e;font-size:13px;margin:0;">${waitCount === 1 ? "1 person signs" : waitCount + " people sign"} before you. <strong>${currentSignerEmail}</strong> is currently signing. You will receive a link when it is your turn.</p>
          </div>
          <p style="color:#6b7280;font-size:13px;text-align:center;margin:0;">No action is needed right now.</p>
        </td></tr>
        <tr><td style="background:#f8faff;padding:16px 40px;text-align:center;border-top:1px solid #e5e7eb;"><p style="color:#9ca3af;font-size:12px;margin:0;">Powered by <a href="${getAppUrl()}" style="color:#6366f1;">UtilSign</a></p></td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`,
  })
}

//  7. Progress Update (all observers after each signing) 
export async function sendProgressUpdate({
  to,
  documentName,
  justSignedEmail,
  nextSignerEmail,
  remainingCount,
}: {
  to: string
  documentName: string
  justSignedEmail: string
  nextSignerEmail: string
  remainingCount: number
}) {
  return sendMail({
    to,
    subject: `Signing update: ${justSignedEmail} has signed "${documentName}"`,
    html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Signing Progress Update</title></head>
<body style="margin:0;padding:0;background:#f8faff;font-family:Inter,system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8faff;padding:40px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(99,102,241,0.08);">
        <tr><td style="background:linear-gradient(135deg,#4f46e5,#6366f1);padding:32px 40px;text-align:center;">
          <h1 style="color:#fff;font-size:22px;font-weight:700;margin:0;">Signing Progress Update</h1>
        </td></tr>
        <tr><td style="padding:36px;">
          <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:16px 20px;margin:0 0 20px;">
            <p style="color:#166534;font-size:14px;font-weight:600;margin:0 0 4px;">Just Signed</p>
            <p style="color:#166534;font-size:14px;margin:0;">${justSignedEmail} has completed their signature on <strong>${documentName}</strong>.</p>
          </div>
          <div style="background:#f0f4ff;border-left:4px solid #6366f1;border-radius:0 8px 8px 0;padding:16px 20px;margin:0 0 20px;">
            <p style="color:#312e81;font-size:14px;font-weight:600;margin:0 0 4px;">Up Next</p>
            <p style="color:#4338ca;font-size:14px;margin:0;">${nextSignerEmail} is now signing.</p>
          </div>
          <p style="color:#6b7280;font-size:13px;text-align:center;margin:0;">${remainingCount === 1 ? "1 signature" : remainingCount + " signatures"} remaining. You will be notified when it is your turn.</p>
        </td></tr>
        <tr><td style="background:#f8faff;padding:16px 40px;text-align:center;border-top:1px solid #e5e7eb;"><p style="color:#9ca3af;font-size:12px;margin:0;">Powered by <a href="${getAppUrl()}" style="color:#6366f1;">UtilSign</a></p></td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`,
  })
}

//  8. Your Turn Notification (next signer with queue context) 
export async function sendYourTurnNotification({
  to,
  documentName,
  justSignedEmail,
  signLink,
  queuePosition,
  totalSigners,
}: {
  to: string
  documentName: string
  justSignedEmail: string
  signLink: string
  queuePosition: number
  totalSigners: number
}) {
  return sendMail({
    to,
    subject: `It is your turn to sign "${documentName}"`,
    html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Your Turn to Sign</title></head>
<body style="margin:0;padding:0;background:#f8faff;font-family:Inter,system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8faff;padding:40px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(99,102,241,0.08);">
        <tr><td style="background:linear-gradient(135deg,#4f46e5,#6366f1);padding:32px 40px;text-align:center;">
          <h1 style="color:#fff;font-size:22px;font-weight:700;margin:0;">Your Turn to Sign!</h1>
          <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:13px;">Signer #${queuePosition} of ${totalSigners}</p>
        </td></tr>
        <tr><td style="padding:36px;">
          <p style="color:#4b5563;font-size:15px;line-height:1.6;margin:0 0 16px;"><strong style="color:#1e1b4b;">${justSignedEmail}</strong> has completed their signature. You are now up to sign:</p>
          <div style="background:#f0f4ff;border-left:4px solid #6366f1;border-radius:0 8px 8px 0;padding:16px 20px;margin:0 0 24px;">
            <p style="color:#312e81;font-size:15px;font-weight:600;margin:0;">${documentName}</p>
          </div>
          <div style="text-align:center;margin:28px 0;">
            <a href="${signLink}" style="display:inline-block;background:linear-gradient(135deg,#4f46e5,#6366f1);color:#fff;font-size:16px;font-weight:600;text-decoration:none;padding:14px 40px;border-radius:8px;">Review &amp; Sign Now</a>
          </div>
          <p style="color:#9ca3af;font-size:12px;text-align:center;margin:0;">This link is personal to you. Do not share it. Expires in 7 days.</p>
        </td></tr>
        <tr><td style="background:#f8faff;padding:16px 40px;text-align:center;border-top:1px solid #e5e7eb;"><p style="color:#9ca3af;font-size:12px;margin:0;">Powered by <a href="${getAppUrl()}" style="color:#6366f1;">UtilSign</a></p></td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`,
  })
}
