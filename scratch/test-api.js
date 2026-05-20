// Last Modified: 2026-05-20T21:11:50Z
import assert from 'assert';

const BASE_URL = 'http://localhost:3000';

async function request(endpoint, options = {}, token = '') {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers
  });
  
  const contentType = res.headers.get('content-type');
  let body = null;
  if (contentType && contentType.includes('application/json')) {
    body = await res.json();
  } else {
    body = await res.text();
  }
  
  return { status: res.status, body };
}

async function runTests() {
  console.log('--- Starting Rebranded FairShare API Integration Tests ---');
  
  try {
    // 1. Setup group and organizer Alex
    console.log('1. Testing setup group and organizer (Alex)...');
    const setupRes = await request('/api/setup', {
      method: 'POST',
      body: JSON.stringify({
        groupName: 'Holiday Trip Paris',
        organizerName: 'Alex'
      })
    });
    
    assert.strictEqual(setupRes.status, 201, 'Setup should return 201 Created');
    const alexToken = setupRes.body.token;
    const alexId = setupRes.body.member._id;
    const groupId = setupRes.body.group._id;
    assert.ok(alexToken, 'Should return a token');
    assert.ok(alexId, 'Should return member ID');
    assert.ok(groupId, 'Should return group ID');
    console.log(`   Success! Alex ID: ${alexId}, Group ID: ${groupId}`);

    // 2. Auth as Organizer Alex
    console.log('2. Testing auth as Organizer...');
    const authRes = await request('/api/auth', {}, alexToken);
    assert.strictEqual(authRes.status, 200);
    assert.strictEqual(authRes.body.member.isOrganizer, true);
    assert.strictEqual(authRes.body.member.name, 'Alex');
    assert.strictEqual(authRes.body.members.length, 1);
    assert.ok(authRes.body.members[0].secureToken, 'Organizer should see secure tokens for members');
    console.log('   Success!');

    // 3. Add member Bob (currently active)
    console.log('3. Testing adding active member (Bob)...');
    const addBobRes = await request('/api/members', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Bob',
        joinDate: '2026-05-01'
      })
    }, alexToken);
    assert.strictEqual(addBobRes.status, 201);
    const bobToken = addBobRes.body.secureToken;
    const bobId = addBobRes.body._id;
    assert.ok(bobToken, 'Should generate secure token for Bob');
    console.log(`   Success! Bob ID: ${bobId}`);

    // 4. Add member Charlie (who left on 2026-05-15)
    console.log('4. Testing adding past member (Charlie)...');
    const addCharlieRes = await request('/api/members', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Charlie',
        joinDate: '2026-05-01',
        leaveDate: '2026-05-15'
      })
    }, alexToken);
    assert.strictEqual(addCharlieRes.status, 201);
    const charlieToken = addCharlieRes.body.secureToken;
    const charlieId = addCharlieRes.body._id;
    assert.ok(charlieToken);
    console.log(`   Success! Charlie ID: ${charlieId}`);

    // 5. Verify privacy boundaries on Auth list (Auth as Bob)
    console.log('5. Testing privacy filtering on auth (Bob view)...');
    const bobAuthRes = await request('/api/auth', {}, bobToken);
    assert.strictEqual(bobAuthRes.status, 200);
    assert.strictEqual(bobAuthRes.body.member.isOrganizer, false);
    
    // Check that Bob CANNOT see Alex's or Charlie's tokens
    const alexRecord = bobAuthRes.body.members.find(m => m._id === alexId);
    const charlieRecord = bobAuthRes.body.members.find(m => m._id === charlieId);
    const bobRecord = bobAuthRes.body.members.find(m => m._id === bobId);
    
    assert.strictEqual(alexRecord.secureToken, undefined, 'Bob should not see Alex token');
    assert.strictEqual(charlieRecord.secureToken, undefined, 'Bob should not see Charlie token');
    assert.strictEqual(bobRecord.secureToken, bobToken, 'Bob should see his own token');
    console.log('   Success! Secure tokens correctly stripped for non-Organizer.');

    // 6. Log bill overlapping Charlie (Period 2026-05-10 to 2026-05-20)
    // Charlie belonged to the group 2026-05-01 to 2026-05-15, which overlaps 2026-05-10 to 2026-05-20.
    // So 3 splitters: Alex, Bob, Charlie.
    console.log('6. Testing bill creation with Charlie overlapping...');
    const bill1Res = await request('/api/bills', {
      method: 'POST',
      body: JSON.stringify({
        purpose: 'Dinner Bill',
        totalAmount: 3000, // £30.00
        applicablePeriodStart: '2026-05-10',
        applicablePeriodEnd: '2026-05-20',
        dateDue: '2026-05-30'
      })
    }, alexToken);
    
    assert.strictEqual(bill1Res.status, 201);
    assert.strictEqual(bill1Res.body.splits.length, 3, 'Should have 3 splits');
    
    const alexSplit1 = bill1Res.body.splits.find(s => s.memberId === alexId);
    const bobSplit1 = bill1Res.body.splits.find(s => s.memberId === bobId);
    const charlieSplit1 = bill1Res.body.splits.find(s => s.memberId === charlieId);
    
    assert.strictEqual(alexSplit1.amountOwed, 1000, 'Alex share should be 1000');
    assert.strictEqual(bobSplit1.amountOwed, 1000, 'Bob share should be 1000');
    assert.strictEqual(charlieSplit1.amountOwed, 1000, 'Charlie share should be 1000');
    assert.strictEqual(alexSplit1.isPaid, true, 'Payer split should be marked paid immediately');
    assert.strictEqual(bobSplit1.isPaid, false, 'Bob split should be unpaid');
    console.log('   Success! 3 eligible splits generated.');

    // 7. Log bill after Charlie left (Period 2026-05-16 to 2026-05-20)
    // Charlie left 2026-05-15, so only 2 splitters: Alex, Bob.
    console.log('7. Testing bill creation after Charlie left...');
    const bill2Res = await request('/api/bills', {
      method: 'POST',
      body: JSON.stringify({
        purpose: 'Museum Tickets',
        totalAmount: 2000, // £20.00
        applicablePeriodStart: '2026-05-16',
        applicablePeriodEnd: '2026-05-20',
        dateDue: '2026-05-30'
      })
    }, alexToken);
    
    assert.strictEqual(bill2Res.status, 201);
    assert.strictEqual(bill2Res.body.splits.length, 2, 'Should have 2 splits (Charlie excluded)');
    const containsCharlie = bill2Res.body.splits.some(s => s.memberId === charlieId);
    assert.strictEqual(containsCharlie, false, 'Charlie should not be split on this bill');
    console.log('   Success! Date-scoped filtering worked, Charlie excluded.');

    // 8. Test "Extra Penny" Rule (Total £10.01 = 1001 pence, split between Alex & Bob)
    console.log('8. Testing Extra Penny rule...');
    const bill3Res = await request('/api/bills', {
      method: 'POST',
      body: JSON.stringify({
        purpose: 'Extra Penny Test Bill',
        totalAmount: 1001, // £10.01
        applicablePeriodStart: '2026-05-16',
        applicablePeriodEnd: '2026-05-20',
        dateDue: '2026-05-30'
      })
    }, alexToken);
    
    assert.strictEqual(bill3Res.status, 201);
    const alexSplit3 = bill3Res.body.splits.find(s => s.memberId === alexId);
    const bobSplit3 = bill3Res.body.splits.find(s => s.memberId === bobId);
    
    assert.strictEqual(bobSplit3.amountOwed, 500, 'Bob should owe base share: 500 pence (£5.00)');
    assert.strictEqual(alexSplit3.amountOwed, 501, 'Alex (payer) should owe base + remainder: 501 pence (£5.01)');
    assert.strictEqual(alexSplit3.amountOwed + bobSplit3.amountOwed, 1001, 'Total split must equal exactly 1001');
    console.log('   Success! Extra penny absorbed by payer. Exact math maintained.');

    // 9. Verify Privacy Filtering on Bills (Auth as Bob)
    console.log('9. Testing privacy filtering on bills list...');
    const bobBillsRes = await request('/api/bills', {}, bobToken);
    assert.strictEqual(bobBillsRes.status, 200);
    
    // Bob should see the bills, but only Bob's splits should be visible!
    const bill1AsBob = bobBillsRes.body.find(b => b.purpose === 'Dinner Bill');
    assert.ok(bill1AsBob, 'Bob should see Dinner Bill');
    assert.strictEqual(bill1AsBob.splits.length, 1, 'Bob should only see a single split record');
    assert.strictEqual(bill1AsBob.splits[0].memberId, bobId, 'The visible split must be Bob\'s');
    console.log('   Success! Bob only sees his own share of the bill splits.');

    // 10. Toggle split payment (gated authorization)
    console.log('10. Testing gating authorization for marking splits paid...');
    const bobSplitId = bobSplit1._id;
    
    // Try to mark Bob's split paid *as Bob*
    const bobPayBobRes = await request('/api/splits', {
      method: 'PUT',
      body: JSON.stringify({
        splitId: bobSplitId,
        isPaid: true
      })
    }, bobToken);
    
    assert.strictEqual(bobPayBobRes.status, 403, 'Bob should get 403 Forbidden since he is not the payer');
    
    // Mark Bob's split paid *as Alex* (the payer)
    const alexPayBobRes = await request('/api/splits', {
      method: 'PUT',
      body: JSON.stringify({
        splitId: bobSplitId,
        isPaid: true
      })
    }, alexToken);
    
    assert.strictEqual(alexPayBobRes.status, 200, 'Alex should be authorized to mark splits paid');
    assert.strictEqual(alexPayBobRes.body.isPaid, true);
    assert.ok(alexPayBobRes.body.datePaid, 'Should set payment date');
    console.log('    Success! Gating enforced, only payer can mark splits paid.');

    // 11. Revoke Charlie's token
    console.log('11. Testing token revocation...');
    const revokeRes = await request('/api/members', {
      method: 'PUT',
      body: JSON.stringify({
        memberId: charlieId,
        isTokenActive: false
      })
    }, alexToken);
    assert.strictEqual(revokeRes.status, 200);
    assert.strictEqual(revokeRes.body.isTokenActive, false);
    
    // Try to login as Charlie
    const charlieAuthRes = await request('/api/auth', {}, charlieToken);
    assert.strictEqual(charlieAuthRes.status, 403, 'Charlie should get 403 Forbidden because token is revoked');
    console.log('    Success! Charlie token successfully revoked and blocked.');

    // 12. Setup frictionless group (No Dates, No Member Selection)
    console.log('12. Testing setup frictionless group (requireDates: false, requireMemberSelection: false)...');
    const flRes = await request('/api/setup', {
      method: 'POST',
      body: JSON.stringify({
        groupName: 'Friday Night Pub',
        organizerName: 'Dave',
        config: {
          requireDates: false,
          requireMemberSelection: false
        }
      })
    });
    assert.strictEqual(flRes.status, 201);
    const daveToken = flRes.body.token;
    const daveId = flRes.body.member._id;
    assert.strictEqual(flRes.body.group.config.requireDates, false);
    assert.strictEqual(flRes.body.group.config.requireMemberSelection, false);

    // Add another member, Emma
    const addEmmaRes = await request('/api/members', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Emma',
        joinDate: '2026-05-01'
      })
    }, daveToken);
    assert.strictEqual(addEmmaRes.status, 201);
    const emmaId = addEmmaRes.body._id;

    // Log a bill with no dates
    console.log('    Logging date-free bill...');
    const flBillRes = await request('/api/bills', {
      method: 'POST',
      body: JSON.stringify({
        purpose: 'Drinks round',
        totalAmount: 1500, // £15.00
        dateDue: '2026-05-30'
      })
    }, daveToken);
    
    assert.strictEqual(flBillRes.status, 201);
    assert.strictEqual(flBillRes.body.applicablePeriodStart, null);
    assert.strictEqual(flBillRes.body.applicablePeriodEnd, null);
    assert.strictEqual(flBillRes.body.splits.length, 2, 'Should split between Dave and Emma');
    
    const emmaSplit = flBillRes.body.splits.find(s => s.memberId === emmaId);
    assert.strictEqual(emmaSplit.amountOwed, 750, 'Emma share is £7.50');
    console.log('    Success! Frictionless group setup and billing verified.');

    // 13. Setup selective date-free group (No Dates, Require Member Selection)
    console.log('13. Testing setup selective date-free group (requireDates: false, requireMemberSelection: true)...');
    const selRes = await request('/api/setup', {
      method: 'POST',
      body: JSON.stringify({
        groupName: 'Weekend Getaway',
        organizerName: 'Frank',
        config: {
          requireDates: false,
          requireMemberSelection: true
        }
      })
    });
    assert.strictEqual(selRes.status, 201);
    const frankToken = selRes.body.token;
    const frankId = selRes.body.member._id;

    // Add Grace and Helen
    const addGraceRes = await request('/api/members', {
      method: 'POST',
      body: JSON.stringify({ name: 'Grace', joinDate: '2026-05-01' })
    }, frankToken);
    const graceId = addGraceRes.body._id;

    const addHelenRes = await request('/api/members', {
      method: 'POST',
      body: JSON.stringify({ name: 'Helen', joinDate: '2026-05-01' })
    }, frankToken);
    const helenId = addHelenRes.body._id;

    // Log a bill splitting only with Helen (excluding Grace)
    console.log('    Logging date-free selective bill (Frank & Helen only)...');
    const selBillRes = await request('/api/bills', {
      method: 'POST',
      body: JSON.stringify({
        purpose: 'Taxi ride',
        totalAmount: 1800, // £18.00
        dateDue: '2026-05-30',
        memberIds: [frankId, helenId]
      })
    }, frankToken);
    
    assert.strictEqual(selBillRes.status, 201);
    assert.strictEqual(selBillRes.body.splits.length, 2, 'Should split only between Frank and Helen');
    const helenSplit = selBillRes.body.splits.find(s => s.memberId === helenId);
    const graceSplit = selBillRes.body.splits.find(s => s.memberId === graceId);
    assert.ok(helenSplit, 'Helen split should exist');
    assert.strictEqual(graceSplit, undefined, 'Grace should be excluded');
    assert.strictEqual(helenSplit.amountOwed, 900, 'Helen share is £9.00');
    console.log('    Success! Selective member billing verified.');

    console.log('\n--- ALL REBRANDED INTEGRATION TESTS PASSED SUCCESSFULLY! ---');
  } catch (error) {
    console.error('\n!!! TEST FAILURE !!!');
    console.error(error);
    process.exit(1);
  }
}

runTests();
