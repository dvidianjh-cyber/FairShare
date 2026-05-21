// Last Modified: 2026-05-21

let activeToken = localStorage.getItem('fairshare_token') || '';

// Loading overlay helpers
function showLoading() {
  const overlay = document.getElementById('loading-overlay');
  if (overlay) {
    overlay.classList.add('active');
  }
}

function hideLoading() {
  const overlay = document.getElementById('loading-overlay');
  if (overlay) {
    overlay.classList.remove('active');
  }
}

export const apiClient = {
  setToken(token) {
    activeToken = token;
    if (token) {
      localStorage.setItem('fairshare_token', token);
    } else {
      localStorage.removeItem('fairshare_token');
    }
  },

  getToken() {
    return activeToken;
  },

  hasToken() {
    return !!activeToken;
  },

  clearToken() {
    activeToken = '';
    localStorage.removeItem('fairshare_token');
  },

  async request(endpoint, options = {}) {
    showLoading();
    
    try {
      const headers = {
        'Content-Type': 'application/json',
        ...options.headers
      };

      if (activeToken) {
        headers['Authorization'] = `Bearer ${activeToken}`;
      }

      const response = await fetch(endpoint, {
        ...options,
        headers
      });

      if (!response.ok) {
        let errText = '';
        const contentType = response.headers.get('content-type');
        try {
          if (contentType && contentType.includes('application/json')) {
            const errJson = await response.json();
            errText = errJson.error || response.statusText;
          } else {
            errText = await response.text() || response.statusText;
          }
        } catch (e) {
          errText = response.statusText;
        }
        const error = new Error(errText);
        error.status = response.status;
        throw error;
      }

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return response.json();
      }
      return response.text();
    } finally {
      hideLoading();
    }
  },

  // Setup Group
  async setupGroup(groupName, organizerName, config) {
    const data = await this.request('/api/setup', {
      method: 'POST',
      body: JSON.stringify({ groupName, organizerName, config })
    });
    this.setToken(data.token);
    return data;
  },

  // Get Auth Context
  async getAuthContext() {
    return this.request('/api/auth');
  },

  // Bills Operations
  async getBills() {
    return this.request('/api/bills');
  },

  async createBill(billData) {
    return this.request('/api/bills', {
      method: 'POST',
      body: JSON.stringify(billData)
    });
  },

  // Splits Operations
  async toggleSplitPaid(splitId, isPaid) {
    return this.request('/api/splits', {
      method: 'PUT',
      body: JSON.stringify({ splitId, isPaid })
    });
  },

  // Members Operations (Organizer Gated)
  async addMember(memberData) {
    return this.request('/api/members', {
      method: 'POST',
      body: JSON.stringify(memberData)
    });
  },

  async updateMember(memberData) {
    return this.request('/api/members', {
      method: 'PUT',
      body: JSON.stringify(memberData)
    });
  }
};
