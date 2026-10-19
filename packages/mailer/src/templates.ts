// ─── Email templates ────────────────────────────────────────────────────────
//
// Plain template literals — no template engine. Phase C uses three templates:
//   - otp:                end-user OTP delivery
//   - invite:             admin invite to a new EndUser
//   - access-pending:     admin notification when an unknown user is blocked
//                          by a `closed` autoProvisioningPolicy

interface RenderResult {
  subject: string;
  html: string;
  text: string;
}

const SHELL = (title: string, body: string): string =>
  `
<!doctype html>
<html><head><meta charset="utf-8"><title>${esc(title)}</title></head>
<body style="font-family: -apple-system, system-ui, sans-serif; max-width: 560px; margin: 32px auto; color: #1a1a1a;">
${body}
<hr style="border: none; border-top: 1px solid #e5e5e5; margin: 32px 0 16px;" />
<p style="font-size: 12px; color: #666;">Sent by Health Services. If you didn't expect this email, you can ignore it.</p>
</body></html>`.trim();

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export const templates = {
  otp(args: { code: string; expiresInMinutes: number }): RenderResult {
    const { code, expiresInMinutes } = args;
    return {
      subject: `Your Health Services sign-in code: ${code}`,
      html: SHELL(
        'Your sign-in code',
        `<h2>Your sign-in code</h2>
         <p>Use this code to sign in. It expires in ${expiresInMinutes} minutes.</p>
         <p style="font-size: 28px; font-weight: 700; letter-spacing: 0.2em; margin: 24px 0;">${esc(code)}</p>
         <p>If you didn't request a sign-in code, you can safely ignore this email.</p>`,
      ),
      text: `Your Health Services sign-in code: ${code}\n\nIt expires in ${expiresInMinutes} minutes.\n\nIf you didn't request this code, you can ignore this email.`,
    };
  },

  invite(args: { invitedByName: string; orgName: string; appNames: string[]; signInUrl: string }): RenderResult {
    const { invitedByName, orgName, appNames, signInUrl } = args;
    const apps = appNames.length
      ? `<ul>${appNames.map((a) => `<li>${esc(a)}</li>`).join('')}</ul>`
      : '<p>(no apps)</p>';
    return {
      subject: `${invitedByName} invited you to ${orgName} on Health Services`,
      html: SHELL(
        'You have been invited',
        `<h2>You're invited to ${esc(orgName)}</h2>
         <p>${esc(invitedByName)} has granted you access to:</p>
         ${apps}
         <p style="margin: 28px 0;"><a href="${esc(signInUrl)}" style="background: #2563eb; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 600;">Sign in to Health Services</a></p>
         <p style="color: #666; font-size: 13px;">Or copy this link:<br><code>${esc(signInUrl)}</code></p>`,
      ),
      text: `${invitedByName} invited you to ${orgName} on Health Services.\n\nYou have access to:\n${appNames.map((a) => `  - ${a}`).join('\n')}\n\nSign in: ${signInUrl}`,
    };
  },

  accessPending(args: {
    requesterEmail: string;
    requesterName?: string;
    appName: string;
    ehrName?: string;
    reviewUrl: string;
  }): RenderResult {
    const { requesterEmail, requesterName, appName, ehrName, reviewUrl } = args;
    const who = requesterName ? `${requesterName} (${requesterEmail})` : requesterEmail;
    return {
      subject: `Access request: ${who} → ${appName}`,
      html: SHELL(
        'Access request',
        `<h2>Access request pending review</h2>
         <p><strong>${esc(who)}</strong> tried to launch <strong>${esc(appName)}</strong>${ehrName ? ` from ${esc(ehrName)}` : ''} but is not on the allowed-users list.</p>
         <p>Review and grant access — or leave it pending — from the End Users page:</p>
         <p style="margin: 28px 0;"><a href="${esc(reviewUrl)}" style="background: #2563eb; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 600;">Review request</a></p>`,
      ),
      text: `Access request pending review.\n\n${who} tried to launch ${appName}${ehrName ? ` from ${ehrName}` : ''} but is not on the allowed-users list.\n\nReview: ${reviewUrl}`,
    };
  },
};
