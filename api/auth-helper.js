// Last Modified: 2026-05-20T21:10:10Z
import { db } from './db.js';

/**
 * Authenticates a request using the secure URL token.
 * If authentication fails, it automatically sets the response status and returns null.
 * Otherwise, it returns an object containing the active member and their group.
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 * @returns {Promise<{ member: any, group: any } | null>}
 */
export async function authenticate(req, res) {
  let token = '';
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (req.headers['x-member-token']) {
    token = req.headers['x-member-token'];
  } else if (req.headers['x-fairshare-token']) {
    token = req.headers['x-fairshare-token'];
  }

  if (!token) {
    res.status(401);
    res.json({ error: 'Access token required.' });
    return null;
  }

  const member = await db.getMemberByToken(token);
  if (!member) {
    res.status(401);
    res.json({ error: 'Invalid access token.' });
    return null;
  }

  if (!member.isTokenActive) {
    res.status(403);
    res.json({ error: 'Access token has been revoked.' });
    return null;
  }

  const group = await db.getGroup(member.groupId);
  if (!group) {
    res.status(404);
    res.json({ error: 'Group not found.' });
    return null;
  }

  return { member, group };
}
