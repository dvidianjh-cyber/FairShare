// Last Modified: 2026-05-20T21:11:30Z

/**
 * Utility to generate and download a CSV file of the member balances and bill breakdowns.
 * @param {string} userName 
 * @param {string} groupName 
 * @param {Array<{ name: string, netAmount: number }>} netBalances 
 * @param {Array<any>} bills 
 */
export function exportBalancesToCSV(userName, groupName, netBalances, bills) {
  const lines = [];

  // File Header
  lines.push(`FairShare - Financial Statement`);
  lines.push(`Group,${escapeCSV(groupName)}`);
  lines.push(`Exported By,${escapeCSV(userName)}`);
  lines.push(`Date of Export,${new Date().toLocaleDateString('en-GB')}`);
  lines.push(''); // Empty spacer

  // Section 1: Net Balances Summary
  lines.push(`SUMMARY OF BALANCES`);
  lines.push(`Member Name,Net Balance (GBP),Status`);
  
  let overallBalance = 0;
  
  netBalances.forEach(item => {
    overallBalance += item.netAmount;
    const balanceStr = (item.netAmount / 100).toFixed(2);
    let status = 'Settled';
    if (item.netAmount > 0) {
      status = 'Owed to you';
    } else if (item.netAmount < 0) {
      status = 'You owe them';
    }
    lines.push(`${escapeCSV(item.name)},£${balanceStr},${status}`);
  });

  const overallStr = (overallBalance / 100).toFixed(2);
  let overallStatus = 'Settled';
  if (overallBalance > 0) {
    overallStatus = 'Overall Owed to you';
  } else if (overallBalance < 0) {
    overallStatus = 'Overall You owe';
  }
  lines.push(`TOTAL NET POSITION,£${overallStr},${overallStatus}`);
  lines.push(''); // Empty spacer

  // Section 2: Detailed Bill List
  lines.push(`DETAILED RECORD OF INVOLVED BILLS`);
  lines.push(`Purpose/Title,Payer,Your Share (GBP),Total Bill (GBP),Date Logged,Due Date,Status`);

  bills.forEach(bill => {
    const userSplit = bill.splits.find(s => s.memberId === bill.activeMemberId);
    const splitAmount = userSplit ? (userSplit.amountOwed / 100).toFixed(2) : '0.00';
    const totalAmount = (bill.totalAmount / 100).toFixed(2);
    const dateLogged = new Date(bill.dateLogged).toLocaleDateString('en-GB');
    const dateDue = new Date(bill.dateDue).toLocaleDateString('en-GB');
    
    let payerName = bill.payerName || 'Unknown';
    let splitPaidStatus = '';
    
    if (bill.payerId === bill.activeMemberId) {
      payerName = 'You';
      const unpaidCount = bill.splits.filter(s => s.memberId !== bill.activeMemberId && !s.isPaid).length;
      splitPaidStatus = unpaidCount === 0 ? 'Fully Paid' : `${unpaidCount} unpaid shares`;
    } else {
      splitPaidStatus = userSplit && userSplit.isPaid ? 'Paid' : 'Unpaid';
    }

    lines.push([
      escapeCSV(bill.purpose),
      escapeCSV(payerName),
      `£${splitAmount}`,
      `£${totalAmount}`,
      dateLogged,
      dateDue,
      splitPaidStatus
    ].join(','));
  });

  // Construct CSV payload
  const csvContent = lines.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  // Trigger Browser Download
  const link = document.createElement('a');
  link.setAttribute('href', url);
  
  const safeGroupName = groupName.toLowerCase().replace(/[^a-z0-9]+/g, '_');
  link.setAttribute('download', `fairshare_${safeGroupName}_statement.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function escapeCSV(text) {
  if (text === null || text === undefined) return '';
  const stringVal = String(text);
  if (stringVal.includes(',') || stringVal.includes('"') || stringVal.includes('\n')) {
    return `"${stringVal.replace(/"/g, '""')}"`;
  }
  return stringVal;
}
