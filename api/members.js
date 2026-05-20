// Last Modified: 2026-05-20T21:11:00Z
import { db } from './db.js';
import { authenticate } from './auth-helper.js';
import crypto from 'crypto';

/**
 * Serverless function for managing members (POST to add, PUT to update/revoke).
 * Access is restricted to the Organizer only.
 * @param {import('http').IncomingMessage} req 
 * @param {import('http').ServerResponse} res 
 */
export default async function handler(req, res) {
  try {
    const authContext = await authenticate(req, res);
    if (!authContext) return; // Response is handled by authenticate helper

    const { member: activeMember, group } = authContext;

    // Authorization: Only the Organizer can modify members
    const isOrganizer = group.organizerId === activeMember._id;
    if (!isOrganizer) {
      res.status(403);
      return res.json({ error: 'Forbidden. Only the Organizer can manage members.' });
    }

    if (req.method === 'POST') {
      const { name, joinDate, leaveDate } = req.body || {};

      if (!name || !name.trim()) {
        res.status(400);
        return res.json({ error: 'Member name is required.' });
      }

      if (!joinDate) {
        res.status(400);
        return res.json({ error: 'Join date is required.' });
      }

      const secureToken = crypto.randomBytes(12).toString('hex');
      const newMember = await db.createMember(
        group._id,
        name.trim(),
        secureToken,
        new Date(joinDate).toISOString(),
        leaveDate ? new Date(leaveDate).toISOString() : null,
        true // active by default
      );

      res.status(201);
      return res.json(newMember);
    } 
    
    else if (req.method === 'PUT') {
      const { memberId, name, joinDate, leaveDate, isTokenActive, groupName } = req.body || {};

      if (!memberId) {
        res.status(400);
        return res.json({ error: 'memberId is required.' });
      }

      // Fetch the member to be updated
      const mem = await db.getMember(memberId);
      if (!mem || mem.groupId !== group._id) {
        res.status(404);
        return res.json({ error: 'Member not found in this group.' });
      }

      // Safety check: Organizer cannot revoke their own access token
      if (memberId === activeMember._id && isTokenActive === false) {
        res.status(400);
        return res.json({ error: 'Safety Violation: You cannot revoke your own Organizer access token.' });
      }

      // Handle updating the group name if requested
      if (groupName !== undefined && groupName.trim()) {
        await db.updateGroup(group._id, { name: groupName.trim() });
      }

      const updateData = {};
      if (name !== undefined && name.trim()) updateData.name = name.trim();
      if (joinDate !== undefined) updateData.joinDate = new Date(joinDate).toISOString();
      if (leaveDate !== undefined) {
        updateData.leaveDate = leaveDate ? new Date(leaveDate).toISOString() : null;
      }
      if (isTokenActive !== undefined) updateData.isTokenActive = !!isTokenActive;

      const updatedMem = await db.updateMember(memberId, updateData);

      res.status(200);
      return res.json(updatedMem);
    } 
    
    else {
      res.status(405);
      return res.json({ error: 'Method not allowed.' });
    }
  } catch (error) {
    console.error('Members handler error:', error);
    res.status(500);
    return res.json({ error: 'Internal Server Error in member management.' });
  }
}
