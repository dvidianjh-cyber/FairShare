// Last Modified: 2026-05-20T21:10:00Z
import fs from 'fs';
import path from 'path';

const RESTDB_URL = process.env.RESTDB_URL;
const RESTDB_KEY = process.env.RESTDB_KEY;
const isRestDB = !!(RESTDB_URL && RESTDB_KEY);

const LOCAL_DB_PATH = path.join(process.cwd(), 'database.json');

// --- Helper Functions for Local File Database ---
function readLocalDb() {
  try {
    if (!fs.existsSync(LOCAL_DB_PATH)) {
      const initialDb = { groups: [], members: [], bills: [], splits: [] };
      fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(initialDb, null, 2), 'utf8');
      return initialDb;
    }
    const data = fs.readFileSync(LOCAL_DB_PATH, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading local db:', err);
    return { groups: [], members: [], bills: [], splits: [] };
  }
}

function writeLocalDb(db) {
  try {
    fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(db, null, 2), 'utf8');
  } catch (err) {
    console.error('Error writing local db:', err);
  }
}

function generateId() {
  return Math.random().toString(36).substring(2, 11);
}

// --- RestDB API Wrapper Helpers ---
async function restdbFetch(endpoint, options = {}) {
  const url = `${RESTDB_URL}${endpoint}`;
  const headers = {
    'x-apikey': RESTDB_KEY,
    'content-type': 'application/json',
    'cache-control': 'no-cache',
    ...options.headers
  };
  
  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`RestDB API error: ${res.status} ${res.statusText} - ${errText}`);
  }
  return res.json();
}

// --- Database Operations API ---
export const db = {
  // --- Groups ---
  async getGroup(groupId) {
    if (isRestDB) {
      const results = await restdbFetch(`/groups?q=${JSON.stringify({ _id: groupId })}`);
      return results[0] || null;
    } else {
      const data = readLocalDb();
      return data.groups.find(g => g._id === groupId) || null;
    }
  },

  async createGroup(name, organizerId = null, config = { requireDates: true, requireMemberSelection: true }) {
    const newGroup = { name, organizerId, config };
    if (isRestDB) {
      return await restdbFetch('/groups', {
        method: 'POST',
        body: JSON.stringify(newGroup)
      });
    } else {
      const data = readLocalDb();
      newGroup._id = generateId();
      data.groups.push(newGroup);
      writeLocalDb(data);
      return newGroup;
    }
  },

  async updateGroup(groupId, updateData) {
    if (isRestDB) {
      return await restdbFetch(`/groups/${groupId}`, {
        method: 'PUT',
        body: JSON.stringify(updateData)
      });
    } else {
      const data = readLocalDb();
      const idx = data.groups.findIndex(g => g._id === groupId);
      if (idx !== -1) {
        data.groups[idx] = { ...data.groups[idx], ...updateData };
        writeLocalDb(data);
        return data.groups[idx];
      }
      return null;
    }
  },

  // --- Members ---
  async getMemberByToken(secureToken) {
    if (isRestDB) {
      const results = await restdbFetch(`/members?q=${JSON.stringify({ secureToken })}`);
      return results[0] || null;
    } else {
      const data = readLocalDb();
      return data.members.find(m => m.secureToken === secureToken) || null;
    }
  },

  async getMembers(groupId) {
    if (isRestDB) {
      return await restdbFetch(`/members?q=${JSON.stringify({ groupId })}`);
    } else {
      const data = readLocalDb();
      return data.members.filter(m => m.groupId === groupId);
    }
  },

  async getMember(memberId) {
    if (isRestDB) {
      const results = await restdbFetch(`/members?q=${JSON.stringify({ _id: memberId })}`);
      return results[0] || null;
    } else {
      const data = readLocalDb();
      return data.members.find(m => m._id === memberId) || null;
    }
  },

  async createMember(groupId, name, secureToken, joinDate, leaveDate = null, isTokenActive = true, email = null) {
    const newMember = { groupId, name, secureToken, joinDate, leaveDate, isTokenActive, email };
    if (isRestDB) {
      return await restdbFetch('/members', {
        method: 'POST',
        body: JSON.stringify(newMember)
      });
    } else {
      const data = readLocalDb();
      newMember._id = generateId();
      data.members.push(newMember);
      writeLocalDb(data);
      return newMember;
    }
  },

  async updateMember(memberId, updateData) {
    if (isRestDB) {
      return await restdbFetch(`/members/${memberId}`, {
        method: 'PUT',
        body: JSON.stringify(updateData)
      });
    } else {
      const data = readLocalDb();
      const idx = data.members.findIndex(m => m._id === memberId);
      if (idx !== -1) {
        data.members[idx] = { ...data.members[idx], ...updateData };
        writeLocalDb(data);
        return data.members[idx];
      }
      return null;
    }
  },

  // --- Bills ---
  async getBills(groupId) {
    if (isRestDB) {
      return await restdbFetch(`/bills?q=${JSON.stringify({ groupId })}`);
    } else {
      const data = readLocalDb();
      return data.bills.filter(b => b.groupId === groupId);
    }
  },

  async getBill(billId) {
    if (isRestDB) {
      const results = await restdbFetch(`/bills?q=${JSON.stringify({ _id: billId })}`);
      return results[0] || null;
    } else {
      const data = readLocalDb();
      return data.bills.find(b => b._id === billId) || null;
    }
  },

  async createBill(groupId, payerId, purpose, totalAmount, applicablePeriodStart, applicablePeriodEnd, dateLogged, dateDue) {
    const newBill = {
      groupId,
      payerId,
      purpose,
      totalAmount: parseInt(totalAmount, 10),
      applicablePeriodStart,
      applicablePeriodEnd,
      dateLogged,
      dateDue
    };
    if (isRestDB) {
      return await restdbFetch('/bills', {
        method: 'POST',
        body: JSON.stringify(newBill)
      });
    } else {
      const data = readLocalDb();
      newBill._id = generateId();
      data.bills.push(newBill);
      writeLocalDb(data);
      return newBill;
    }
  },

  // --- Splits ---
  async getSplitsForBill(billId) {
    if (isRestDB) {
      return await restdbFetch(`/splits?q=${JSON.stringify({ billId })}`);
    } else {
      const data = readLocalDb();
      return data.splits.filter(s => s.billId === billId);
    }
  },

  async getSplitsForMember(memberId) {
    if (isRestDB) {
      return await restdbFetch(`/splits?q=${JSON.stringify({ memberId })}`);
    } else {
      const data = readLocalDb();
      return data.splits.filter(s => s.memberId === memberId);
    }
  },

  async getSplit(splitId) {
    if (isRestDB) {
      const results = await restdbFetch(`/splits?q=${JSON.stringify({ _id: splitId })}`);
      return results[0] || null;
    } else {
      const data = readLocalDb();
      return data.splits.find(s => s._id === splitId) || null;
    }
  },

  async createSplits(splitsArray) {
    const created = [];
    if (isRestDB) {
      for (const s of splitsArray) {
        const res = await restdbFetch('/splits', {
          method: 'POST',
          body: JSON.stringify(s)
        });
        created.push(res);
      }
      return created;
    } else {
      const data = readLocalDb();
      for (const s of splitsArray) {
        const newSplit = {
          ...s,
          _id: generateId(),
          amountOwed: parseInt(s.amountOwed, 10),
          isPaid: !!s.isPaid,
          datePaid: s.datePaid || null
        };
        data.splits.push(newSplit);
        created.push(newSplit);
      }
      writeLocalDb(data);
      return created;
    }
  },

  async updateSplit(splitId, updateData) {
    if (isRestDB) {
      return await restdbFetch(`/splits/${splitId}`, {
        method: 'PUT',
        body: JSON.stringify(updateData)
      });
    } else {
      const data = readLocalDb();
      const idx = data.splits.findIndex(s => s._id === splitId);
      if (idx !== -1) {
        data.splits[idx] = { ...data.splits[idx], ...updateData };
        writeLocalDb(data);
        return data.splits[idx];
      }
      return null;
    }
  }
};
