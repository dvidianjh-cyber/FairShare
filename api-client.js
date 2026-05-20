// Last Modified: 2026-05-20T21:11:20Z

let activeToken = localStorage.getItem('fairshare_token') || '';

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
      try {
        const errJson = await response.json();
        errText = errJson.error || response.statusText;
      } catch (e) {
        errText = await response.text() || response.statusText;
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
