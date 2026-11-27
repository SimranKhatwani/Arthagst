export const resolveApiBaseUrl = () => {
  // If running in a browser environment, check the current hostname
  if (typeof window !== 'undefined' && window.location?.hostname) {
    const host = window.location.hostname;
    // On any deployed non-localhost origin (e.g. vercel.app, onrender.com, production domain):
    // NEVER allow fallback or resolution to localhost
    if (host !== 'localhost' && host !== '127.0.0.1' && host !== '0.0.0.0') {
      const envUrl = import.meta.env.VITE_API_BASE_URL;
      if (envUrl && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1')) {
        let url = envUrl.trim().replace(/\/+$/, '');
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
          url = `https://${url}`;
        }
        return url.endsWith('/api') ? url : `${url}/api`;
      }
      return 'https://arthagst-1.onrender.com/api';
    }
  }

  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (!envUrl) {
    return import.meta.env.DEV ? 'http://localhost:5000/api' : 'https://arthagst-1.onrender.com/api';
  }
  let url = envUrl.trim().replace(/\/+$/, '');
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = `https://${url}`;
  }
  return url.endsWith('/api') ? url : `${url}/api`;
};

const API_BASE_URL = resolveApiBaseUrl();
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
 * Deeply normalizes MongoDB _id and id properties recursively.
 * Ensures any object with `_id` also has `id: String(_id)`
 * without modifying or deleting original attributes.
 */
export const normalizeMongoIds = (data) => {
  if (!data || typeof data !== 'object') {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(normalizeMongoIds);
  }

  // Preserve Date, RegExp, Blob, etc.
  if (data instanceof Date || (typeof Blob !== 'undefined' && data instanceof Blob)) {
    return data;
  }

  const normalized = { ...data };
  if (normalized._id !== undefined && normalized.id === undefined) {
    normalized.id = String(normalized._id);
  }

  for (const key of Object.keys(normalized)) {
    if (normalized[key] && typeof normalized[key] === 'object') {
      normalized[key] = normalizeMongoIds(normalized[key]);
    }
  }

  return normalized;
};

/**
 * Centralized API request handler using native fetch.
 */
export const apiClient = async (endpoint, options = {}) => {
  const {
    method = 'GET',
    data = null,
    headers = {},
    params = null,
    ...customConfig
  } = options;

  const baseUrl = resolveApiBaseUrl();
  let url = `${baseUrl.replace(/\/+$/, '')}/${endpoint.replace(/^\/+/, '')}`;

  if (params) {
    const searchParams = new URLSearchParams();
    for (const [key, val] of Object.entries(params)) {
      if (val !== undefined && val !== null && val !== '') {
        searchParams.append(key, String(val));
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

  const timeoutMs = customConfig.timeout || 12000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  const config = {
    method,
    headers: reqHeaders,
    signal: customConfig.signal || controller.signal,
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
    } else if (contentType && (contentType.includes('text/') || contentType.includes('application/xml'))) {
      resData = { message: await response.text() };
    } else {
      // Binary / blob responses
      const blob = await response.blob();
      if (!response.ok) {
        throw new Error(`Download failed with status ${response.status}`);
      }
      return blob;
    }

    if (!response.ok) {
      let errorMsg = resData?.message;
      if (Array.isArray(resData?.errors) && resData.errors.length > 0) {
        const details = resData.errors
          .map((e) => (typeof e === 'string' ? e : e.message || e.field || JSON.stringify(e)))
          .join(', ');
        errorMsg = errorMsg ? `${errorMsg}: ${details}` : details;
      }
      if (!errorMsg) {
        errorMsg = `Request failed with status ${response.status}`;
      }

      const error = new Error(errorMsg);
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

    return normalizeMongoIds(resData);
  } catch (err) {
    if (err.name === 'AbortError') {
      const timeoutError = new Error(`Connection timed out after ${timeoutMs / 1000}s. The server is taking too long to respond. Please check backend service status.`);
      timeoutError.status = 504;
      timeoutError.statusCode = 504;
      throw timeoutError;
    }
    if (!err.status && err.status !== 0) {
      err.message = err.message || 'Network error. Please check your internet or backend connection.';
      err.status = 0;
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
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
