import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { Resend } from 'resend';

const prisma = new PrismaClient();

const apiKey = process.env.RESEND_API_KEY;
const resend = apiKey && apiKey.startsWith('re_') ? new Resend(apiKey) : null;
const FROM_EMAIL = process.env.EMAIL_FROM || 'Task Tracker <noreply@example.com>';
const APP_URL = process.env.APP_URL || 'http://localhost:5173';

async function sendInviteEmail(email: string, token: string, name: string) {
  if (!resend) {
    console.log(`  [SKIPPED] Resend not configured`);
    return false;
  }

  const inviteUrl = `${APP_URL}/auth/invite/${token}`;

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: "You've been invited to Task Tracker",
      html: `
        <h2>Welcome to Task Tracker, ${name}!</h2>
        <p>You've been invited to join the Task Tracker application as a contractor.</p>
        <p>Click the link below to complete your signup:</p>
        <p><a href="${inviteUrl}" style="display: inline-block; background: #8b0000; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Accept Invitation</a></p>
        <p>This link will connect your Google account to your Task Tracker profile.</p>
        <p>If you didn't expect this invitation, you can ignore this email.</p>
      `
    });
    return true;
  } catch (error) {
    console.error(`  [ERROR] Failed to send:`, error);
    return false;
  }
}

async function main() {
  // Find all contractors without a googleId (haven't completed signup)
  const pendingUsers = await prisma.user.findMany({
    where: {
      role: 'contractor',
      googleId: null,
      active: true
    }
  });

  console.log(`\nFound ${pendingUsers.length} contractors with pending invites:\n`);

  if (pendingUsers.length === 0) {
    console.log('No pending invites to send.');
    return;
  }

  for (const user of pendingUsers) {
    console.log(`Sending invite to: ${user.name} (${user.email})`);

    // Generate fresh invite token
    const inviteToken = uuidv4();

    // Update user with new token
    await prisma.user.update({
      where: { id: user.id },
      data: { inviteToken }
    });

    // Send the email
    const sent = await sendInviteEmail(user.email, inviteToken, user.name);
    if (sent) {
      console.log(`  [SENT] Invite email sent successfully`);
    }
  }

  console.log('\nDone!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
