// Last Modified: 2026-05-21
import { db } from './db.js';
import { authenticate } from './auth-helper.js';

/**
 * Serverless function for sending welcome emails to members.
 * Access is restricted to the Organizer only.
 * @param {import('http').IncomingMessage} req 
 * @param {import('http').ServerResponse} res 
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405);
    return res.json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    const authContext = await authenticate(req, res);
    if (!authContext) return; // Response is handled by authenticate helper

    const { member: activeMember, group } = authContext;

    // Authorization: Only the Organizer can send welcome emails
    const isOrganizer = group.organizerId === activeMember._id;
    if (!isOrganizer) {
      res.status(403);
      return res.json({ error: 'Forbidden. Only the Organizer can send welcome emails.' });
    }

    const { memberId } = req.body || {};

    if (!memberId) {
      res.status(400);
      return res.json({ error: 'memberId is required.' });
    }

    // Fetch the member
    const member = await db.getMember(memberId);
    if (!member || member.groupId !== group._id) {
      res.status(404);
      return res.json({ error: 'Member not found in this group.' });
    }

    if (!member.email) {
      res.status(400);
      return res.json({ error: 'Member does not have an email address.' });
    }

    if (!member.isTokenActive) {
      res.status(400);
      return res.json({ error: 'Member access token is not active.' });
    }

    // Build the invite URL
    const inviteUrl = `${req.headers.origin || 'http://localhost:3000'}/?token=${member.secureToken}`;

    // Email content
    const emailSubject = `Welcome to ${group.name} on FairShare!`;
    const emailBody = `
Hi ${member.name},

You've been added to the group "${group.name}" on FairShare!

FairShare makes it easy to track and split shared expenses with your group.

Click the link below to access your group:
${inviteUrl}

This is your personal secure access link - please keep it safe and don't share it with others.

Best regards,
The FairShare Team
    `.trim();

    // TODO: Integrate with email service (Resend, SendGrid, etc.)
    // For now, we'll just log the email content
    console.log('=== WELCOME EMAIL ===');
    console.log(`To: ${member.email}`);
    console.log(`Subject: ${emailSubject}`);
    console.log(`Body:\n${emailBody}`);
    console.log('=====================');

    // Check for RESEND_API_KEY environment variable
    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    
    if (RESEND_API_KEY) {
      // Send via Resend API
      try {
        const resendResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: process.env.EMAIL_FROM || 'FairShare <noreply@fairshare.app>',
            to: [member.email],
            subject: emailSubject,
            text: emailBody
          })
        });

        if (!resendResponse.ok) {
          const errorData = await resendResponse.json();
          throw new Error(`Resend API error: ${JSON.stringify(errorData)}`);
        }

        res.status(200);
        return res.json({ 
          message: 'Welcome email sent successfully.',
          method: 'resend'
        });
      } catch (emailError) {
        console.error('Failed to send email via Resend:', emailError);
        res.status(500);
        return res.json({ error: 'Failed to send email via email service.' });
      }
    } else {
      // No email service configured - return success anyway for development
      res.status(200);
      return res.json({ 
        message: 'Welcome email logged to console (no email service configured).',
        method: 'console',
        email: member.email
      });
    }
  } catch (error) {
    console.error('Send welcome email error:', error);
    res.status(500);
    return res.json({ error: 'Internal Server Error while sending email.' });
  }
}
