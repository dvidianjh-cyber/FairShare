// Last Modified: 2026-05-20T21:10:40Z
import { db } from './db.js';
import { authenticate } from './auth-helper.js';
import dayjs from 'dayjs';

/**
 * Serverless function for GET (listing bills with privacy filters) and POST (creating bills with active period checks).
 * @param {import('http').IncomingMessage} req 
 * @param {import('http').ServerResponse} res 
 */
export default async function handler(req, res) {
  try {
    const authContext = await authenticate(req, res);
    if (!authContext) return; // Response is handled by authenticate helper

    const { member: activeMember, group } = authContext;

    if (req.method === 'GET') {
      // 1. Fetch all bills in the group
      const allBills = await db.getBills(group._id);
      
      const filteredBills = [];
      for (const bill of allBills) {
        // Fetch splits for this bill
        const splits = await db.getSplitsForBill(bill._id);
        
        const isPayer = bill.payerId === activeMember._id;
        const userSplit = splits.find(s => s.memberId === activeMember._id);
        
        if (isPayer) {
          // Active user is the payer: they see the bill and ALL splits
          filteredBills.push({
            ...bill,
            splits
          });
        } else if (userSplit) {
          // Active user is NOT the payer but is a debtor:
          // They only see the bill and THEIR OWN split.
          filteredBills.push({
            ...bill,
            splits: [userSplit]
          });
        }
        // If neither, the bill is completely hidden from the user (third-party debt)
      }

      // Sort bills by dateLogged descending (most recent first)
      filteredBills.sort((a, b) => new Date(b.dateLogged) - new Date(a.dateLogged));

      res.status(200);
      return res.json(filteredBills);
    } 
    
    else if (req.method === 'POST') {
      const { purpose, totalAmount, applicablePeriodStart, applicablePeriodEnd, dateDue } = req.body || {};

      if (!purpose || !purpose.trim()) {
        res.status(400);
        return res.json({ error: 'Bill purpose is required.' });
      }

      const amountVal = parseInt(totalAmount, 10);
      if (isNaN(amountVal) || amountVal <= 0) {
        res.status(400);
        return res.json({ error: 'Bill total amount must be a positive integer in pence.' });
      }

      const config = group.config || { requireDates: true, requireMemberSelection: true };

      if (config.requireDates) {
        if (!applicablePeriodStart || !applicablePeriodEnd) {
          res.status(400);
          return res.json({ error: 'Applicable period start and end dates are required.' });
        }
      }
      if (!dateDue) {
        res.status(400);
        return res.json({ error: 'Due date is required.' });
      }

      // Fetch all members of the group
      const members = await db.getMembers(group._id);

      // Determine candidate members to split with
      let candidateMembers = members;
      if (config.requireMemberSelection) {
        const { memberIds, flatmateIds } = req.body || {};
        const selectedIds = memberIds || flatmateIds;
        if (selectedIds !== undefined) {
          if (!Array.isArray(selectedIds) || selectedIds.length === 0) {
            res.status(400);
            return res.json({ error: 'Selected members (memberIds) array is required.' });
          }
          candidateMembers = members.filter(m => selectedIds.includes(m._id));
          if (candidateMembers.length === 0) {
            res.status(400);
            return res.json({ error: 'None of the selected members belong to this group.' });
          }
        }
      }

      const todayISO = new Date().toISOString();
      let eligibleMembers = [];

      if (config.requireDates) {
        // Determine which members belonged to the group during the applicable period
        const start = dayjs(applicablePeriodStart);
        const end = dayjs(applicablePeriodEnd);

        if (!start.isValid() || !end.isValid() || start.isAfter(end)) {
          res.status(400);
          return res.json({ error: 'Invalid applicable period date range.' });
        }

        eligibleMembers = candidateMembers.filter(m => {
          const join = dayjs(m.joinDate);
          const leave = m.leaveDate ? dayjs(m.leaveDate) : null;
          
          // Active period must overlap with the bill's applicable period:
          // joinDate <= applicablePeriodEnd AND (leaveDate >= applicablePeriodStart OR leaveDate is null)
          const hasJoinedBeforeEnd = join.isBefore(end) || join.isSame(end, 'day');
          const hasNotLeftBeforeStart = !leave || leave.isAfter(start) || leave.isSame(start, 'day');
          
          return hasJoinedBeforeEnd && hasNotLeftBeforeStart;
        });
      } else {
        // Date-free mode: split amongst members active today
        const billDate = dayjs(todayISO);
        eligibleMembers = candidateMembers.filter(m => {
          const join = dayjs(m.joinDate);
          const leave = m.leaveDate ? dayjs(m.leaveDate) : null;
          const hasJoined = join.isBefore(billDate) || join.isSame(billDate, 'day');
          const hasNotLeft = !leave || leave.isAfter(billDate) || leave.isSame(billDate, 'day');
          return hasJoined && hasNotLeft;
        });
      }

      if (eligibleMembers.length === 0) {
        res.status(400);
        return res.json({ error: 'No members were active during the specified applicable period.' });
      }

      const N = eligibleMembers.length;
      const baseShare = Math.floor(amountVal / N);
      const remainder = amountVal - (baseShare * N);

      // 1. Log the Bill
      const newBill = await db.createBill(
        group._id,
        activeMember._id, // Payer
        purpose.trim(),
        amountVal,
        config.requireDates ? dayjs(applicablePeriodStart).toISOString() : null,
        config.requireDates ? dayjs(applicablePeriodEnd).toISOString() : null,
        todayISO,
        dayjs(dateDue).toISOString()
      );

      // 2. Prepare Splits using the "Extra Penny" Rule
      // Payer absorbs the extra pennies.
      const splitsToCreate = eligibleMembers.map(m => {
        let amountOwed = baseShare;
        
        const isPayer = m._id === activeMember._id;
        if (isPayer) {
          amountOwed += remainder;
        }

        return {
          billId: newBill._id,
          memberId: m._id,
          amountOwed,
          isPaid: isPayer, // The payer's own split is marked paid immediately
          datePaid: isPayer ? todayISO : null
        };
      });

      // If the payer was NOT eligible (e.g. paid for others but didn't belong during that time),
      // we distribute the remainder to the first eligible member to ensure exact math.
      const payerEligible = eligibleMembers.some(m => m._id === activeMember._id);
      if (!payerEligible && remainder > 0) {
        splitsToCreate[0].amountOwed += remainder;
      }

      const createdSplits = await db.createSplits(splitsToCreate);

      res.status(201);
      return res.json({
        ...newBill,
        splits: createdSplits
      });
    } 
    
    else {
      res.status(405);
      return res.json({ error: 'Method not allowed.' });
    }
  } catch (error) {
    console.error('Bills handler error:', error);
    res.status(500);
    return res.json({ error: 'Internal Server Error in bill management.' });
  }
}
