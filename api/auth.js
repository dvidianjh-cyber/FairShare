// Last Modified: 2026-05-20T21:10:30Z
import { db } from './db.js';
import { authenticate } from './auth-helper.js';

/**
 * Serverless function for verifying user token and returning Group session context.
 * @param {import('http').IncomingMessage} req 
 * @param {import('http').ServerResponse} res 
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405);
    return res.json({ error: 'Method not allowed. Use GET.' });
  }

  try {
    const authContext = await authenticate(req, res);
    if (!authContext) return; // Response is handled by authenticate helper

    const { member, group } = authContext;
    const isOrganizer = group.organizerId === member._id;

    // Fetch all members in the group
    const allMembers = await db.getMembers(group._id);

    // Apply strict privacy filtering on members list:
    // Only the Organizer is permitted to see secure tokens.
    const filteredMembers = allMembers.map(m => {
      const isSelf = m._id === member._id;
      if (isOrganizer || isSelf) {
        return m; // Organizers can see all tokens, users can see their own
      }
      // Strip sensitive tokens for third parties
      const { secureToken, ...sanitized } = m;
      return sanitized;
    });

    return res.json({
      member: {
        _id: member._id,
        name: member.name,
        joinDate: member.joinDate,
        leaveDate: member.leaveDate,
        isTokenActive: member.isTokenActive,
        isOrganizer
      },
      group,
      members: filteredMembers
    });
  } catch (error) {
    console.error('Auth handler error:', error);
    res.status(500);
    return res.json({ error: 'Internal Server Error during authentication.' });
  }
}
