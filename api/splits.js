// Last Modified: 2026-05-20T21:10:50Z
import { db } from './db.js';
import { authenticate } from './auth-helper.js';

/**
 * Serverless function for updating split payment status (PUT).
 * @param {import('http').IncomingMessage} req 
 * @param {import('http').ServerResponse} res 
 */
export default async function handler(req, res) {
  if (req.method !== 'PUT') {
    res.status(405);
    return res.json({ error: 'Method not allowed. Use PUT.' });
  }

  try {
    const authContext = await authenticate(req, res);
    if (!authContext) return; // Response is handled by authenticate helper

    const { member: activeMember } = authContext;
    const { splitId, isPaid } = req.body || {};

    if (!splitId) {
      res.status(400);
      return res.json({ error: 'splitId is required.' });
    }

    if (typeof isPaid !== 'boolean') {
      res.status(400);
      return res.json({ error: 'isPaid must be a boolean.' });
    }

    // 1. Fetch the split record
    const split = await db.getSplit(splitId);
    if (!split) {
      res.status(404);
      return res.json({ error: 'Split record not found.' });
    }

    // 2. Fetch the associated bill to verify the payer
    const bill = await db.getBill(split.billId);
    if (!bill) {
      res.status(404);
      return res.json({ error: 'Associated bill not found.' });
    }

    // 3. Authorization check: Only the original payer can toggle payment status
    if (bill.payerId !== activeMember._id) {
      res.status(403);
      return res.json({ error: 'Forbidden. Only the member who paid the bill can toggle payment status.' });
    }

    // 4. Update the split
    const datePaid = isPaid ? new Date().toISOString() : null;
    const updatedSplit = await db.updateSplit(splitId, { isPaid, datePaid });

    res.status(200);
    return res.json(updatedSplit);
  } catch (error) {
    console.error('Splits handler error:', error);
    res.status(500);
    return res.json({ error: 'Internal Server Error during split update.' });
  }
}
