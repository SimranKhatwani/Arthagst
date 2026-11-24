const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
const TOKEN_KEY = 'arthagst_token';

/**
 * Get stored JWT token
 */
export const getToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

/**
 * Store JWT token
 */
export const setToken = (token) => {
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    // Ignore storage issues
  }
};

/**
 * Remove stored JWT token
 */
export const removeToken = () => {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Ignore
  }
};

/**
 * Centralized API request handler
 */
export const apiClient = async (endpoint, options = {}) => {
  const {
    method = 'GET',
    data = null,
    headers = {},
    params = null,
    ...customConfig
  } = options;

  let url = `${API_BASE_URL.replace(/\/+$/, '')}/${endpoint.replace(/^\/+/, '')}`;

  if (params) {
    const searchParams = new URLSearchParams();
    for (const [key, val] of Object.entries(params)) {
      if (val !== undefined && val !== null && val !== '') {
        searchParams.append(key, val);
      }
    }
    const queryString = searchParams.toString();
    if (queryString) {
      url += (url.includes('?') ? '&' : '?') + queryString;
    }
  }

  const token = getToken();

  const reqHeaders = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...headers,
  };

  const config = {
    method,
    headers: reqHeaders,
    ...customConfig,
  };

  if (data && method !== 'GET') {
    config.body = JSON.stringify(data);
  }

  try {
    const response = await fetch(url, config);

    let resData;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      resData = await response.json();
    } else {
      resData = { message: await response.text() };
    }

    if (!response.ok) {
      const error = new Error(
        resData?.message || `Request failed with status ${response.status}`
      );
      error.status = response.status;
      error.statusCode = response.status;
      error.data = resData;
      error.errors = resData?.errors || null;

      // Automatically handle 401 Unauthorized
      if (response.status === 401 && token) {
        removeToken();
        window.dispatchEvent(new CustomEvent('arthagst:unauthorized', { detail: { error } }));
      }

      throw error;
    }

    return resData;
  } catch (err) {
    if (!err.status) {
      err.message = err.message || 'Network error. Please check backend connection.';
      err.status = 0;
    }
    throw err;
  }
};

export const api = {
  get: (endpoint, options = {}) => apiClient(endpoint, { ...options, method: 'GET' }),
  post: (endpoint, data, options = {}) => apiClient(endpoint, { ...options, method: 'POST', data }),
  put: (endpoint, data, options = {}) => apiClient(endpoint, { ...options, method: 'PUT', data }),
  patch: (endpoint, data, options = {}) => apiClient(endpoint, { ...options, method: 'PATCH', data }),
  delete: (endpoint, options = {}) => apiClient(endpoint, { ...options, method: 'DELETE' }),
};

export default api;
