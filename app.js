// Last Modified: 2026-05-20T21:11:40Z
import { apiClient } from './api-client.js';
import { exportBalancesToCSV } from './export.js';

// --- State Store ---
const state = {
  activeMember: null,  // Member object (with isOrganizer)
  group: null,         // Group object
  members: [],         // Array of Members
  bills: [],           // Array of Bills (each containing splits)
  netBalances: []      // Net balances with each member
};

// --- DOM References ---
const UI = {
  appHeader: document.getElementById('app-header'),
  headerUserInfo: document.getElementById('header-user-info'),
  tabDashboard: document.getElementById('tab-dashboard'),
  tabBills: document.getElementById('tab-bills'),
  settingsTriggerBtn: document.getElementById('settings-trigger-btn'),
  logoutBtn: document.getElementById('logout-btn'),
  toast: document.getElementById('toast'),
  toastMessage: document.getElementById('toast-message'),

  // Views
  onboardingView: document.getElementById('onboarding-view'),
  onboardingMenu: document.getElementById('onboarding-menu'),
  setupPanel: document.getElementById('setup-panel'),
  dashboardView: document.getElementById('dashboard-view'),
  billsView: document.getElementById('bills-view'),

  // Forms
  setupForm: document.getElementById('setup-form'),
  showSetupBtn: document.getElementById('show-setup-btn'),
  cancelSetupBtn: document.getElementById('cancel-setup-btn'),
  inviteTokenInput: document.getElementById('invite-token-input'),
  useTokenBtn: document.getElementById('use-token-btn'),
  addBillForm: document.getElementById('add-bill-form'),
  addBillTriggerBtn: document.getElementById('add-bill-trigger-btn'),
  dashboardAddBillBtn: document.getElementById('dashboard-add-bill-btn'),
  addMemberForm: document.getElementById('add-member-form'),
  editMemberForm: document.getElementById('edit-member-form'),
  settingsSaveGroupBtn: document.getElementById('settings-save-group-btn'),

  // Modals
  addBillModal: document.getElementById('add-bill-modal'),
  settingsModal: document.getElementById('settings-modal'),
  editMemberModal: document.getElementById('edit-member-modal'),

  // Dynamic Renders
  dashboardNetBalance: document.getElementById('dashboard-net-balance'),
  dashboardNetText: document.getElementById('dashboard-net-text'),
  dashboardMembersBalances: document.getElementById('dashboard-members-balances'),
  dashboardRefreshBtn: document.getElementById('dashboard-refresh-btn'),
  billsRefreshBtn: document.getElementById('bills-refresh-btn'),
  
  billsOweCount: document.getElementById('bills-owe-count'),
  billsIOweList: document.getElementById('bills-i-owe-list'),
  billsOwedCount: document.getElementById('bills-owed-count'),
  billsOwedToMeList: document.getElementById('bills-owed-to-me-list'),
  
  addBillMembersGrid: document.getElementById('add-bill-members-check-grid'),
  settingsGroupNameInput: document.getElementById('settings-group-name'),
  settingsMembersList: document.getElementById('settings-members-list'),
  exportBalancesBtn: document.getElementById('export-balances-btn')
};

// --- Formatters (UK Localization) ---
const currencyFormatter = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP'
});

/**
 * Formats value in pence to GBP string.
 * @param {number} pence 
 * @returns {string}
 */
const formatGBP = (pence) => currencyFormatter.format(pence / 100);

/**
 * Formats ISO date to UK format DD/MM/YYYY.
 * @param {string} dateISO 
 * @returns {string}
 */
const formatUKDate = (dateISO) => {
  if (!dateISO) return '';
  return dayjs(dateISO).format('DD/MM/YYYY');
};

/**
 * Formats ISO date to HTML Date Input format YYYY-MM-DD.
 * @param {string} dateISO 
 * @returns {string}
 */
const formatInputDate = (dateISO) => {
  if (!dateISO) return '';
  return dayjs(dateISO).format('YYYY-MM-DD');
};

// --- Toast Feedback ---
let toastTimeout = null;
function showToast(message) {
  clearTimeout(toastTimeout);
  UI.toastMessage.textContent = message;
  UI.toast.classList.add('active');
  toastTimeout = setTimeout(() => {
    UI.toast.classList.remove('active');
  }, 3500);
}

// --- Application Navigation ---
function switchTab(tabName) {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });

  document.querySelectorAll('.view-section').forEach(view => {
    view.classList.remove('active');
  });

  if (tabName === 'dashboard') {
    UI.dashboardView.classList.add('active');
    renderDashboard();
  } else if (tabName === 'bills') {
    UI.billsView.classList.add('active');
    renderBills();
  }
}

// --- Lifecycle & Data Sync ---
async function appInit() {
  const urlParams = new URLSearchParams(window.location.search);
  let token = urlParams.get('token');

  if (token) {
    // Token provided in URL - save it and authenticate
    apiClient.setToken(token);
  } else {
    // No token in URL - clear any saved token and show onboarding
    apiClient.clearToken();
    window.history.replaceState({}, document.title, window.location.pathname);
    showOnboardingView();
    return;
  }

  // Try to load session with the token
  if (apiClient.hasToken()) {
    try {
      await loadSessionData();
      showDashboardView();
    } catch (err) {
      console.error('Session loading failed:', err);
      apiClient.clearToken();
      window.history.replaceState({}, document.title, window.location.pathname);
      showOnboardingView(err.message || 'Session expired or token revoked.');
    }
  }
}

async function loadSessionData() {
  const authContext = await apiClient.getAuthContext();
  state.activeMember = authContext.member;
  state.group = authContext.group;
  state.members = authContext.members;

  state.bills = await apiClient.getBills();
  state.bills.activeMemberId = state.activeMember._id;

  calculateBalances();
}

function showDashboardView() {
  UI.onboardingView.classList.remove('active');
  UI.appHeader.style.display = 'block';
  
  // Set header user info
  UI.headerUserInfo.textContent = `${state.activeMember.name} - Group: ${state.group.name}`;
  
  if (state.activeMember.isOrganizer) {
    UI.settingsTriggerBtn.style.display = 'flex';
  } else {
    UI.settingsTriggerBtn.style.display = 'none';
  }

  switchTab('dashboard');
}

function showOnboardingView(errorMsg = '') {
  UI.appHeader.style.display = 'none';
  UI.dashboardView.classList.remove('active');
  UI.billsView.classList.remove('active');
  UI.onboardingView.classList.add('active');
  UI.setupPanel.classList.remove('active');
  UI.onboardingMenu.style.display = 'block';

  if (errorMsg) {
    showToast(errorMsg);
  }
}

// --- Math & Position Calculations ---
function calculateBalances() {
  const activeId = state.activeMember._id;
  
  const balances = state.members
    .filter(m => m._id !== activeId)
    .map(m => ({
      memberId: m._id,
      name: m.name,
      netAmount: 0 // + means they owe me, - means I owe them
    }));

  state.bills.forEach(bill => {
    const isPayer = bill.payerId === activeId;

    bill.splits.forEach(split => {
      if (split.isPaid) return;

      if (isPayer) {
        const match = balances.find(b => b.memberId === split.memberId);
        if (match) {
          match.netAmount += split.amountOwed;
        }
      } else if (split.memberId === activeId) {
        const match = balances.find(b => b.memberId === bill.payerId);
        if (match) {
          match.netAmount -= split.amountOwed;
        }
      }
    });
  });

  state.netBalances = balances;
}

// --- Rendering Logic ---

function renderDashboard() {
  let netTotal = 0;
  state.netBalances.forEach(b => { netTotal += b.netAmount; });

  UI.dashboardNetBalance.className = 'balance-value';
  if (netTotal > 0) {
    UI.dashboardNetBalance.classList.add('positive');
    UI.dashboardNetBalance.textContent = `+${formatGBP(netTotal)}`;
    UI.dashboardNetText.textContent = `You are overall owed ${formatGBP(netTotal)}`;
  } else if (netTotal < 0) {
    UI.dashboardNetBalance.classList.add('negative');
    UI.dashboardNetBalance.textContent = formatGBP(netTotal);
    UI.dashboardNetText.textContent = `You overall owe ${formatGBP(Math.abs(netTotal))}`;
  } else {
    UI.dashboardNetBalance.classList.add('settled');
    UI.dashboardNetBalance.textContent = '£0.00';
    UI.dashboardNetText.textContent = "You're all settled up!";
  }

  UI.dashboardMembersBalances.innerHTML = '';
  
  if (state.netBalances.length === 0) {
    UI.dashboardMembersBalances.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-users-slash"></i>
        <p>No other members registered in this group yet.</p>
      </div>
    `;
    return;
  }

  state.netBalances.forEach(item => {
    const div = document.createElement('div');
    div.className = 'list-item';

    let valClass = 'settled';
    let label = 'Settled';
    let valText = formatGBP(Math.abs(item.netAmount));

    if (item.netAmount > 0) {
      valClass = 'owed';
      label = 'owes you';
      valText = `+${valText}`;
    } else if (item.netAmount < 0) {
      valClass = 'owes';
      label = 'you owe';
      valText = `-${valText}`;
    } else {
      valText = 'Settled';
    }

    div.innerHTML = `
      <div class="list-item-info">
        <span class="list-item-title">${item.name}</span>
        <span class="list-item-subtitle">${label}</span>
      </div>
      <div class="list-item-value ${valClass}">${valText}</div>
    `;
    UI.dashboardMembersBalances.appendChild(div);
  });
}

function renderBills() {
  const activeId = state.activeMember._id;

  const iOweBills = [];
  const owedToMeBills = [];

  state.bills.forEach(bill => {
    if (bill.payerId === activeId) {
      owedToMeBills.push(bill);
    } else {
      const mySplit = bill.splits.find(s => s.memberId === activeId);
      if (mySplit) {
        iOweBills.push({ ...bill, mySplit });
      }
    }
  });

  UI.billsOweCount.textContent = iOweBills.filter(b => !b.mySplit.isPaid).length;
  UI.billsOwedCount.textContent = owedToMeBills.filter(b => b.splits.some(s => s.memberId !== activeId && !s.isPaid)).length;

  // 1. Render "Bills I Owe"
  UI.billsIOweList.innerHTML = '';
  if (iOweBills.length === 0) {
    UI.billsIOweList.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-face-smile"></i>
        <p>No bills logged for you. You are all clear!</p>
      </div>
    `;
  } else {
    iOweBills.forEach(bill => {
      const payerMem = state.members.find(m => m._id === bill.payerId);
      const payerName = payerMem ? payerMem.name : 'Unknown';
      const myShare = bill.mySplit.amountOwed;
      const isPaid = bill.mySplit.isPaid;
      
      const div = document.createElement('div');
      div.className = 'list-item';
      div.innerHTML = `
        <div class="list-item-info" style="flex: 1;">
          <span class="list-item-title">${bill.purpose}</span>
          <span class="list-item-subtitle">
            Payer: <strong>${payerName}</strong> | 
            Total: ${formatGBP(bill.totalAmount)}
          </span>
          <span class="list-item-subtitle" style="font-size: 0.8rem;">
            Logged: ${formatUKDate(bill.dateLogged)} | 
            Due: ${formatUKDate(bill.dateDue)}
          </span>
        </div>
        <div class="list-item-action">
          <div style="text-align: right; margin-right: 10px;">
            <div class="list-item-value loses" style="font-weight:600; color: var(--color-danger);">${formatGBP(myShare)}</div>
            <div style="font-size:0.75rem; color: var(--text-muted);">your share</div>
          </div>
          <span class="badge ${isPaid ? 'badge-success' : 'badge-danger'}">
            ${isPaid ? 'Paid' : 'Unpaid'}
          </span>
        </div>
      `;
      UI.billsIOweList.appendChild(div);
    });
  }

  // 2. Render "Bills Owed to Me"
  UI.billsOwedToMeList.innerHTML = '';
  if (owedToMeBills.length === 0) {
    UI.billsOwedToMeList.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-receipt"></i>
        <p>No bills fronted by you yet.</p>
      </div>
    `;
  } else {
    owedToMeBills.forEach(bill => {
      const div = document.createElement('div');
      div.className = 'list-item';
      div.style.flexDirection = 'column';
      div.style.alignItems = 'stretch';
      
      const eligibleSplits = bill.splits.filter(s => s.memberId !== activeId);
      const totalOwed = eligibleSplits.reduce((acc, s) => acc + s.amountOwed, 0);
      
      div.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start; width: 100%;">
          <div class="list-item-info">
            <span class="list-item-title">${bill.purpose}</span>
            <span class="list-item-subtitle">
              Total: <strong>${formatGBP(bill.totalAmount)}</strong> | 
              Shared Out: ${formatGBP(totalOwed)}
            </span>
            <span class="list-item-subtitle" style="font-size: 0.8rem;">
              Logged: ${formatUKDate(bill.dateLogged)} | 
              Due: ${formatUKDate(bill.dateDue)}
            </span>
          </div>
          <div style="text-align: right;">
            <div class="list-item-value owed">${formatGBP(totalOwed)}</div>
            <div style="font-size:0.75rem; color: var(--text-muted);">collectable</div>
          </div>
        </div>

        <div class="splits-detail-list">
          ${eligibleSplits.map(split => {
            const debtor = state.members.find(m => m._id === split.memberId);
            const debtorName = debtor ? debtor.name : 'Unknown Member';
            const splitId = split._id;
            const isPaid = split.isPaid;
            
            return `
              <div class="split-detail-row">
                <span class="split-detail-name">
                  <i class="fa-solid ${isPaid ? 'fa-circle-check text-success' : 'fa-circle-question text-danger'}" style="margin-right: 5px; color: ${isPaid ? 'var(--color-success)' : 'var(--text-muted)'};"></i>
                  ${debtorName}
                </span>
                <div style="display: flex; align-items: center; gap: 10px;">
                  <span class="split-detail-amount">${formatGBP(split.amountOwed)}</span>
                  <button class="btn btn-secondary btn-sm toggle-paid-btn" 
                          data-split-id="${splitId}" 
                          data-paid-status="${isPaid}">
                    Mark ${isPaid ? 'Unpaid' : 'Paid'}
                  </button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;

      div.querySelectorAll('.toggle-paid-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const splitId = e.target.dataset.splitId;
          const currentPaid = e.target.dataset.paidStatus === 'true';
          try {
            await apiClient.toggleSplitPaid(splitId, !currentPaid);
            showToast(`Split updated successfully.`);
            await loadSessionData();
            renderBills();
          } catch (err) {
            console.error('Error toggling split:', err);
            showToast(err.message || 'Could not update split.');
          }
        });
      });

      UI.billsOwedToMeList.appendChild(div);
    });
  }
}

// --- Checklist Generation with Date-Scoped Active Period Logic ---
function renderAddBillMemberChecklist() {
  const config = state.group.config || { requireDates: true, requireMemberSelection: true };
  
  UI.addBillMembersGrid.innerHTML = '';

  let pStart = null;
  let pEnd = null;

  if (config.requireDates) {
    const startVal = UI.addBillForm['bill-period-start'].value;
    const endVal = UI.addBillForm['bill-period-end'].value;

    if (!startVal || !endVal) {
      UI.addBillMembersGrid.innerHTML = `<p class="balance-text" style="font-size:0.85rem;">Please select a date range first.</p>`;
      return;
    }

    pStart = dayjs(startVal);
    pEnd = dayjs(endVal);

    if (pStart.isAfter(pEnd)) {
      UI.addBillMembersGrid.innerHTML = `<p class="balance-text" style="font-size:0.85rem; color: var(--color-danger);">Start date cannot be after end date.</p>`;
      return;
    }
  }

  const today = dayjs();

  state.members.forEach(m => {
    const join = dayjs(m.joinDate);
    const leave = m.leaveDate ? dayjs(m.leaveDate) : null;

    let isEligible = false;
    let statusLabel = 'Eligible';

    if (config.requireDates) {
      const hasJoinedBeforeEnd = join.isBefore(pEnd) || join.isSame(pEnd, 'day');
      const hasNotLeftBeforeStart = !leave || leave.isAfter(pStart) || leave.isSame(pStart, 'day');
      isEligible = hasJoinedBeforeEnd && hasNotLeftBeforeStart;

      if (!isEligible) {
        if (join.isAfter(pEnd)) {
          statusLabel = `Joins ${formatUKDate(m.joinDate)}`;
        } else if (leave && leave.isBefore(pStart)) {
          statusLabel = `Left ${formatUKDate(m.leaveDate)}`;
        } else {
          statusLabel = 'Not active';
        }
      }
    } else {
      const hasJoined = join.isBefore(today) || join.isSame(today, 'day');
      const hasNotLeft = !leave || leave.isAfter(today) || leave.isSame(today, 'day');
      isEligible = hasJoined && hasNotLeft;

      if (!isEligible) {
        if (join.isAfter(today)) {
          statusLabel = `Joins ${formatUKDate(m.joinDate)}`;
        } else if (leave && leave.isBefore(today)) {
          statusLabel = `Left ${formatUKDate(m.leaveDate)}`;
        } else {
          statusLabel = 'Not active';
        }
      }
    }

    if (isEligible && m._id === state.activeMember._id) {
      statusLabel = 'Payer (You)';
    }

    const div = document.createElement('div');
    div.className = `check-item ${isEligible ? '' : 'disabled'}`;
    
    const checkedAttr = isEligible ? 'checked' : '';
    const disabledAttr = isEligible ? '' : 'disabled';

    div.innerHTML = `
      <input type="checkbox" id="member-check-${m._id}" value="${m._id}" ${checkedAttr} ${disabledAttr}>
      <label for="member-check-${m._id}">
        <span>${m.name}</span>
        <span class="active-period-badge">${statusLabel}</span>
      </label>
    `;

    if (!isEligible) {
      div.querySelector('input').addEventListener('click', (e) => {
        e.preventDefault();
      });
    }

    UI.addBillMembersGrid.appendChild(div);
  });
}

// --- Organizer Settings Management ---
function renderSettings() {
  UI.settingsGroupNameInput.value = state.group.name;
  UI.settingsMembersList.innerHTML = '';

  state.members.forEach(m => {
    const isSelf = m._id === state.activeMember._id;
    const isMemActive = m.isTokenActive;
    
    const div = document.createElement('div');
    div.className = 'list-item';
    div.style.flexDirection = 'column';
    div.style.alignItems = 'stretch';
    div.style.gap = '10px';

    let activePeriodText = `Joined: ${formatUKDate(m.joinDate)}`;
    if (m.leaveDate) {
      activePeriodText += ` | Left: ${formatUKDate(m.leaveDate)}`;
    } else {
      activePeriodText += ` | Current Member`;
    }
    if (m.email) {
      activePeriodText += ` | ${m.email}`;
    }

    let inviteHtml = '';
    if (m.secureToken) {
      const inviteUrl = `${window.location.origin}/?token=${m.secureToken}`;
      inviteHtml = `
        <div class="token-container">
          <span class="token-text" id="token-copy-${m._id}">${inviteUrl}</span>
          <button class="btn btn-secondary btn-sm copy-token-btn" data-copy-target="token-copy-${m._id}" title="Copy Link">
            <i class="fa-solid fa-copy"></i>
          </button>
        </div>
      `;
    } else {
      inviteHtml = `
        <div class="token-container" style="background: none; border-style: dashed;">
          <span class="token-text" style="color: var(--text-muted); font-family: inherit;">Token hidden for privacy.</span>
        </div>
      `;
    }

    div.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
        <div class="list-item-info">
          <span class="list-item-title" style="display: flex; align-items: center; gap: 8px;">
            ${m.name}
            ${isSelf ? '<span class="badge badge-info" style="font-size:0.65rem;">Organizer</span>' : ''}
            ${!isMemActive ? '<span class="badge badge-danger" style="font-size:0.65rem;">Revoked</span>' : ''}
          </span>
          <span class="list-item-subtitle">${activePeriodText}</span>
        </div>
        
        <div style="display: flex; gap: 10px;">
          <button class="btn btn-secondary btn-sm edit-member-dates-btn" 
                  data-id="${m._id}" 
                  data-name="${m.name}" 
                  data-email="${m.email || ''}"
                  data-join="${formatInputDate(m.joinDate)}" 
                  data-leave="${formatInputDate(m.leaveDate)}">
            <i class="fa-solid fa-pen"></i> Edit
          </button>
          
          ${m.email && isMemActive ? `
            <button class="btn btn-primary btn-sm send-welcome-email-btn" 
                    data-id="${m._id}" 
                    data-name="${m.name}"
                    data-email="${m.email}">
              <i class="fa-solid fa-envelope"></i> Send Welcome
            </button>
          ` : ''}
          
          ${!isSelf ? `
            <button class="btn ${isMemActive ? 'btn-danger' : 'btn-primary'} btn-sm toggle-member-token-btn" 
                    data-id="${m._id}" 
                    data-active-status="${isMemActive}">
              ${isMemActive ? 'Revoke' : 'Activate'}
            </button>
          ` : ''}
        </div>
      </div>
      ${inviteHtml}
    `;

    const copyBtn = div.querySelector('.copy-token-btn');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        const targetId = copyBtn.dataset.copyTarget;
        const textToCopy = document.getElementById(targetId).textContent;
        navigator.clipboard.writeText(textToCopy)
          .then(() => showToast('Invite link copied to clipboard.'))
          .catch(() => showToast('Could not copy link. Please manually copy it.'));
      });
    }

    const toggleBtn = div.querySelector('.toggle-member-token-btn');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', async () => {
        const mId = toggleBtn.dataset.id;
        const currentActive = toggleBtn.dataset.activeStatus === 'true';
        try {
          await apiClient.updateMember({
            memberId: mId,
            isTokenActive: !currentActive
          });
          showToast(`Access token successfully ${!currentActive ? 'activated' : 'revoked'}.`);
          await loadSessionData();
          renderSettings();
          renderDashboard();
        } catch (err) {
          console.error(err);
          showToast(err.message || 'Could not update member access.');
        }
      });
    }

    div.querySelector('.edit-member-dates-btn').addEventListener('click', () => {
      const btn = div.querySelector('.edit-member-dates-btn');
      document.getElementById('edit-member-id').value = btn.dataset.id;
      document.getElementById('edit-member-name').value = btn.dataset.name;
      document.getElementById('edit-member-email').value = btn.dataset.email || '';
      document.getElementById('edit-member-join').value = btn.dataset.join;
      document.getElementById('edit-member-leave').value = btn.dataset.leave || '';
      
      openModal(UI.editMemberModal);
    });

    const welcomeBtn = div.querySelector('.send-welcome-email-btn');
    if (welcomeBtn) {
      welcomeBtn.addEventListener('click', async () => {
        const memberId = welcomeBtn.dataset.id;
        const memberName = welcomeBtn.dataset.name;
        const memberEmail = welcomeBtn.dataset.email;
        
        if (!confirm(`Send welcome email to ${memberName} (${memberEmail})?`)) {
          return;
        }
        
        try {
          await apiClient.request('/api/send-welcome-email', {
            method: 'POST',
            body: JSON.stringify({ memberId })
          });
          showToast(`Welcome email sent to ${memberName}!`);
        } catch (err) {
          console.error(err);
          showToast(err.message || 'Failed to send email.');
        }
      });
    }

    UI.settingsMembersList.appendChild(div);
  });

  // Set default join date for new members
  // If group doesn't require date ranges, default to Today (like the organizer)
  const config = state.group.config || { requireDates: true, requireMemberSelection: true };
  const newMemberJoinInput = document.getElementById('new-member-join');
  if (!config.requireDates && newMemberJoinInput) {
    newMemberJoinInput.value = dayjs().format('YYYY-MM-DD');
  } else if (newMemberJoinInput) {
    // Clear any previous default
    newMemberJoinInput.value = '';
  }
}

// --- Modal Helper Functions ---
function openModal(modalEl) {
  modalEl.classList.add('active');
}

function closeModal(modalEl) {
  modalEl.classList.remove('active');
}

// --- Event Listeners Bindings ---
function bindEvents() {
  // Group settings UI interactivity
  document.getElementById('setup-require-dates').addEventListener('change', (e) => {
    const helpText = document.getElementById('help-require-dates');
    if (e.target.checked) {
      helpText.textContent = "Require start/end dates for bills to track who should contribute.";
    } else {
      helpText.textContent = "Simple Mode: No dates required (great for holidays or nights out).";
    }
  });
  document.getElementById('setup-require-member-selection').addEventListener('change', (e) => {
    const helpText = document.getElementById('help-require-member-selection');
    if (e.target.checked) {
      helpText.textContent = "Manually select which members contribute to each expense.";
    } else {
      helpText.textContent = "All-In Mode: Automatically split every expense evenly across all active members.";
    }
  });

  UI.tabDashboard.addEventListener('click', () => switchTab('dashboard'));
  UI.tabBills.addEventListener('click', () => switchTab('bills'));
  
  UI.settingsTriggerBtn.addEventListener('click', () => {
    renderSettings();
    openModal(UI.settingsModal);
  });

  UI.logoutBtn.addEventListener('click', () => {
    apiClient.clearToken();
    window.history.replaceState({}, document.title, window.location.pathname);
    showOnboardingView('Signed out successfully.');
  });

  UI.showSetupBtn.addEventListener('click', () => {
    UI.onboardingMenu.style.display = 'none';
    UI.setupPanel.classList.add('active');
  });

  UI.cancelSetupBtn.addEventListener('click', () => {
    UI.setupPanel.classList.remove('active');
    UI.onboardingMenu.style.display = 'block';
  });

  UI.useTokenBtn.addEventListener('click', async () => {
    const token = UI.inviteTokenInput.value.trim();
    if (!token) {
      showToast('Please enter a secure token.');
      return;
    }
    
    apiClient.setToken(token);
    try {
      await loadSessionData();
      
      const url = new URL(window.location.href);
      url.searchParams.set('token', token);
      window.history.replaceState({}, document.title, url.pathname + url.search);

      showDashboardView();
      showToast('Logged in successfully!');
      UI.inviteTokenInput.value = '';
    } catch (err) {
      console.error(err);
      apiClient.clearToken();
      window.history.replaceState({}, document.title, window.location.pathname);
      showToast(err.message || 'Invalid access token.');
    }
  });

  UI.setupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const groupName = document.getElementById('setup-group-name').value.trim();
    const organizerName = document.getElementById('setup-organizer-name').value.trim();
    const requireDates = document.getElementById('setup-require-dates').checked;
    const requireMemberSelection = document.getElementById('setup-require-member-selection').checked;
    
    // // TODO (v0.4^.0): allowUnevenSplits
    const config = { requireDates, requireMemberSelection };

    try {
      const data = await apiClient.setupGroup(groupName, organizerName, config);
      showToast('Group created successfully!');
      
      const url = new URL(window.location.href);
      url.searchParams.set('token', data.token);
      window.history.replaceState({}, document.title, url.pathname + url.search);

      await loadSessionData();
      showDashboardView();

      renderSettings();
      openModal(UI.settingsModal);
    } catch (err) {
      console.error(err);
      showToast(err.message || 'Group setup failed.');
    }
  });

  UI.settingsSaveGroupBtn.addEventListener('click', async () => {
    const newName = UI.settingsGroupNameInput.value.trim();
    if (!newName) {
      showToast('Group name cannot be empty.');
      return;
    }

    try {
      await apiClient.request('/api/members', {
        method: 'PUT',
        body: JSON.stringify({ memberId: state.activeMember._id, groupName: newName })
      });
      
      showToast('Group name updated.');
      await loadSessionData();
      renderDashboard();
    } catch (err) {
      console.error(err);
      showToast(err.message || 'Could not update group name.');
    }
  });

  UI.addMemberForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('new-member-name').value.trim();
    const email = document.getElementById('new-member-email').value.trim() || null;
    const joinDate = document.getElementById('new-member-join').value;
    const leaveDate = document.getElementById('new-member-leave').value || null;

    try {
      await apiClient.addMember({ name, email, joinDate, leaveDate });
      showToast('New member added successfully.');
      UI.addMemberForm.reset();
      
      await loadSessionData();
      renderSettings();
      renderDashboard();
    } catch (err) {
      console.error(err);
      showToast(err.message || 'Failed to add member.');
    }
  });

  UI.editMemberForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const memberId = document.getElementById('edit-member-id').value;
    const name = document.getElementById('edit-member-name').value.trim();
    const email = document.getElementById('edit-member-email').value.trim() || null;
    const joinDate = document.getElementById('edit-member-join').value;
    const leaveDate = document.getElementById('edit-member-leave').value || null;

    try {
      await apiClient.updateMember({ memberId, name, email, joinDate, leaveDate });
      showToast('Member details updated successfully.');
      closeModal(UI.editMemberModal);

      await loadSessionData();
      renderSettings();
      renderDashboard();
      if (memberId === state.activeMember._id) {
        UI.headerUserInfo.textContent = `${state.activeMember.name} - Group: ${state.group.name}`;
      }
    } catch (err) {
      console.error(err);
      showToast(err.message || 'Failed to update member dates.');
    }
  });

  UI.addBillTriggerBtn.addEventListener('click', () => {
    UI.addBillForm.reset();
    
    const config = state.group.config || { requireDates: true, requireMemberSelection: true };
    
    const datesContainer = document.getElementById('bill-dates-container');
    const checkGrid = document.getElementById('add-bill-members-check-grid');
    const disabledLabel = document.getElementById('bill-members-disabled-label');
    const selectionHelpText = document.getElementById('bill-members-selection-help');
    
    if (config.requireDates) {
      datesContainer.style.display = 'grid';
      const startOfMonth = dayjs().startOf('month').format('YYYY-MM-DD');
      const endOfMonth = dayjs().endOf('month').format('YYYY-MM-DD');
      UI.addBillForm['bill-period-start'].value = startOfMonth;
      UI.addBillForm['bill-period-end'].value = endOfMonth;
    } else {
      datesContainer.style.display = 'none';
      UI.addBillForm['bill-period-start'].value = '';
      UI.addBillForm['bill-period-end'].value = '';
    }

    if (config.requireMemberSelection) {
      checkGrid.style.display = 'grid';
      disabledLabel.style.display = 'none';
      if (selectionHelpText) selectionHelpText.style.display = 'block';
    } else {
      checkGrid.style.display = 'none';
      disabledLabel.style.display = 'block';
      if (selectionHelpText) selectionHelpText.style.display = 'none';
    }

    const today = dayjs().format('YYYY-MM-DD');
    UI.addBillForm['bill-due-date'].value = today;

    renderAddBillMemberChecklist();
    openModal(UI.addBillModal);
  });

  // Dashboard Add Bill button (same handler as above)
  UI.dashboardAddBillBtn.addEventListener('click', () => {
    UI.addBillTriggerBtn.click();
  });

  UI.addBillForm['bill-period-start'].addEventListener('change', renderAddBillMemberChecklist);
  UI.addBillForm['bill-period-end'].addEventListener('change', renderAddBillMemberChecklist);

  UI.addBillForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const purpose = document.getElementById('bill-purpose').value.trim();
    const totalAmountFloat = parseFloat(document.getElementById('bill-total-amount').value);
    const applicablePeriodStart = document.getElementById('bill-period-start').value;
    const applicablePeriodEnd = document.getElementById('bill-period-end').value;
    const dateDue = document.getElementById('bill-due-date').value;

    const totalAmount = Math.round(totalAmountFloat * 100);

    if (totalAmount <= 0) {
      showToast('Please enter a valid amount greater than zero.');
      return;
    }

    const config = state.group.config || { requireDates: true, requireMemberSelection: true };
    let memberIds = null;
    
    if (config.requireMemberSelection) {
      memberIds = [];
      UI.addBillMembersGrid.querySelectorAll('input[type="checkbox"]:checked').forEach(cb => {
        memberIds.push(cb.value);
      });
      if (memberIds.length === 0) {
        showToast('Please select at least one member to split the cost with.');
        return;
      }
    }

    try {
      await apiClient.createBill({
        purpose,
        totalAmount,
        applicablePeriodStart: config.requireDates ? applicablePeriodStart : null,
        applicablePeriodEnd: config.requireDates ? applicablePeriodEnd : null,
        dateDue,
        memberIds
      });

      showToast('Bill successfully logged.');
      closeModal(UI.addBillModal);

      await loadSessionData();
      renderBills();
      renderDashboard();
    } catch (err) {
      console.error(err);
      showToast(err.message || 'Could not log bill.');
    }
  });

  document.querySelectorAll('[data-close]').forEach(closer => {
    closer.addEventListener('click', (e) => {
      const modalId = closer.dataset.close;
      closeModal(document.getElementById(modalId));
    });
  });

  document.querySelectorAll('.modal-overlay').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal(modal);
      }
    });
  });

  // Refresh buttons
  UI.dashboardRefreshBtn.addEventListener('click', async () => {
    try {
      await loadSessionData();
      renderDashboard();
      showToast('Dashboard refreshed.');
    } catch (err) {
      console.error('Refresh failed:', err);
      showToast('Failed to refresh data.');
    }
  });

  UI.billsRefreshBtn.addEventListener('click', async () => {
    try {
      await loadSessionData();
      renderBills();
      renderDashboard();
      showToast('Bills refreshed.');
    } catch (err) {
      console.error('Refresh failed:', err);
      showToast('Failed to refresh data.');
    }
  });

  UI.exportBalancesBtn.addEventListener('click', () => {
    try {
      exportBalancesToCSV(state.activeMember.name, state.group.name, state.netBalances, state.bills, state.members);
      showToast('Statement CSV downloaded.');
    } catch (err) {
      console.error('Export failed:', err);
      showToast('Failed to export statement.');
    }
  });
}

// --- App Run ---
document.addEventListener('DOMContentLoaded', () => {
  bindEvents();
  appInit();
});
