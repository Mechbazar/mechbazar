// Plain string templates, same reasoning as orderConfirmation.ts -- no
// templating engine until there's a third template that actually justifies
// the dependency. Copy mirrors Firebase's own default templates (still
// configured in the project, in case anything ever falls back to them) so
// switching senders doesn't change what users read.

function wrap(bodyHtml: string): string {
  return `
<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#1C2430;">
  <div style="background:#DA3830;padding:20px;text-align:center;">
    <span style="color:#fff;font-size:20px;font-weight:700;">MechBazar</span>
  </div>
  <div style="padding:24px;">
    ${bodyHtml}
  </div>
</div>`.trim();
}

export function buildVerifyEmailMessage(link: string): { subject: string; html: string; text: string } {
  const html = wrap(`
    <p>Hello,</p>
    <p>Follow this link to verify your email address.</p>
    <p><a href="${link}" style="color:#DA3830;">${link}</a></p>
    <p style="font-size:12px;color:#9AA5B1;margin-top:24px;">If you didn't ask to verify this address, you can ignore this email.</p>
  `);
  const text = `Follow this link to verify your email address.\n\n${link}\n\nIf you didn't ask to verify this address, you can ignore this email.`;
  return { subject: 'Verify your email for MechBazar', html, text };
}

export function buildPasswordResetMessage(link: string): { subject: string; html: string; text: string } {
  const html = wrap(`
    <p>Hello,</p>
    <p>Follow this link to reset your MechBazar password.</p>
    <p><a href="${link}" style="color:#DA3830;">${link}</a></p>
    <p style="font-size:12px;color:#9AA5B1;margin-top:24px;">If you didn't ask to reset your password, you can ignore this email.</p>
  `);
  const text = `Follow this link to reset your MechBazar password.\n\n${link}\n\nIf you didn't ask to reset your password, you can ignore this email.`;
  return { subject: 'Reset your password for MechBazar', html, text };
}
