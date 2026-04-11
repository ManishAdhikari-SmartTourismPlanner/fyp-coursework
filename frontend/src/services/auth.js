const API_BASE_URL = 'http://127.0.0.1:8000';

const ACCESS_KEY = 'stp_access';
const REFRESH_KEY = 'stp_refresh';
const USER_KEY = 'stp_user';

export const tokenStore = {
  getAccess: () => localStorage.getItem(ACCESS_KEY),
  getRefresh: () => localStorage.getItem(REFRESH_KEY),
  getUser: () => {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  },
  setSession: ({ access, refresh, user }) => {
    localStorage.setItem(ACCESS_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  clear: () => {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
  },
};

async function request(endpoint, options = {}) {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json')
    ? await response.json()
    : null;

  if (!response.ok) {
    let errorMessage = 'Request failed';

    if (data?.detail) {
      errorMessage = data.detail;
    } else if (data && typeof data === 'object') {
      const messages = Object.entries(data).map(([field, value]) => {
        if (Array.isArray(value)) {
          return `${field}: ${value.join(', ')}`;
        }
        if (typeof value === 'string') {
          return `${field}: ${value}`;
        }
        return `${field}: ${JSON.stringify(value)}`;
      });
      if (messages.length > 0) {
        errorMessage = messages.join(' | ');
      }
    } else if (data) {
      errorMessage = JSON.stringify(data);
    }

    throw new Error(errorMessage);
  }

  return data;
}

export async function registerTourist(payload) {
  return request('/api/auth/register/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function loginWithUsername(username, password) {
  const data = await request('/api/auth/login/', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });

  if (data.access && data.refresh && data.user) {
    tokenStore.setSession({
      access: data.access,
      refresh: data.refresh,
      user: data.user,
    });
  }

  return data;
}

export async function verifyTouristOtp(challengeId, code) {
  const data = await request('/api/auth/verify-otp/', {
    method: 'POST',
    body: JSON.stringify({ challenge_id: challengeId, code }),
  });

  tokenStore.setSession({
    access: data.access,
    refresh: data.refresh,
    user: data.user,
  });

  return data;
}

export async function fetchMe() {
  const access = tokenStore.getAccess();
  if (!access) {
    throw new Error('You are not logged in.');
  }

  return request('/api/auth/me/', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${access}`,
    },
  });
}

export async function logoutSession() {
  const access = tokenStore.getAccess();
  const refresh = tokenStore.getRefresh();

  if (!access || !refresh) {
    tokenStore.clear();
    return;
  }

  try {
    await request('/api/auth/logout/', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${access}`,
      },
      body: JSON.stringify({ refresh }),
    });
  } finally {
    tokenStore.clear();
  }
}

export async function createAgent(payload, accessToken) {
  return request('/api/auth/agents/create/', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });
}

export async function fetchUsers(accessToken) {
  return request('/api/auth/users/', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}
