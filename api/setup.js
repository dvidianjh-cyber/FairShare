// Last Modified: 2026-05-20T21:10:20Z
import { db } from './db.js';
import crypto from 'crypto';

/**
 * Serverless function for setting up a new Group and its Organizer.
 * @param {import('http').IncomingMessage} req 
 * @param {import('http').ServerResponse} res 
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405);
    return res.json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    const { groupName, organizerName, config } = req.body || {};

    if (!groupName || !groupName.trim() || !organizerName || !organizerName.trim()) {
      res.status(400);
      return res.json({ error: 'Group name and organizer name are required.' });
    }

    const configObj = {
      requireDates: config && typeof config.requireDates === 'boolean' ? config.requireDates : true,
      requireMemberSelection: config && typeof config.requireMemberSelection === 'boolean' ? config.requireMemberSelection : true
    };

    // 1. Create the Group
    const group = await db.createGroup(groupName.trim(), null, configObj);

    // 2. Generate a secure URL token
    const secureToken = crypto.randomBytes(12).toString('hex');

    // 3. Create the Organizer member (join date set to today)
    const todayISO = new Date().toISOString();
    const member = await db.createMember(
      group._id,
      organizerName.trim(),
      secureToken,
      todayISO,
      null, // No leave date
      true, // Token active
      (config && config.organizerEmail) ? config.organizerEmail : null // Email address
    );

    // 4. Associate organizerId to the group
    const updatedGroup = await db.updateGroup(group._id, { 
      name: group.name,
      organizerId: member._id,
      config: group.config
    });

    res.status(201);
    return res.json({
      message: 'Group successfully setup.',
      token: secureToken,
      group: updatedGroup,
      member: {
        _id: member._id,
        name: member.name,
        joinDate: member.joinDate,
        leaveDate: member.leaveDate,
        isTokenActive: member.isTokenActive
      }
    });
  } catch (error) {
    console.error('Setup error:', error);
    res.status(500);
    return res.json({ error: 'Internal Server Error during setup.' });
  }
}
