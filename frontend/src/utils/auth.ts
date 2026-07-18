let accessToken: string | null = null;
let userInfo: string | null = null;

const TOKEN_STORAGE_KEY = 'auth:accessToken';
const USER_STORAGE_KEY = 'auth:user';

const isBrowser = (): boolean => typeof window !== 'undefined';

const isProductionEnv = (): boolean => {
  const raw = process.env.NEXT_PUBLIC_IS_PRODUCTION ?? process.env.isProduction;
  if (typeof raw === 'string') {
    return raw === 'true';
  }
  return process.env.NODE_ENV === 'production';
};

export function setAccessToken(token: string | null) {
  accessToken = token;

  if (!isBrowser()) return;

  try {
    if (token) {
      window.localStorage.setItem('auth:hasSession', 'true');
    } else {
      window.localStorage.removeItem('auth:hasSession');
    }
  } catch {
    // ignore
  }

  if (isProductionEnv()) return;

  try {
    if (token) {
      window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch {
    // ignore storage errors in dev
  }
}

export function setStoredUser(user: unknown | null) {
  userInfo = user ? JSON.stringify(user) : null;

  if (isProductionEnv() || !isBrowser()) return;

  try {
    if (user) {
      window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    } else {
      window.localStorage.removeItem(USER_STORAGE_KEY);
    }
  } catch {
    // ignore storage errors in dev
  }
}

export function getStoredUser<T = unknown>(): T | null {
  if (userInfo) {
    try {
      return JSON.parse(userInfo) as T;
    } catch {
      return null;
    }
  }

  if (isProductionEnv() || !isBrowser()) return null;

  try {
    const stored = window.localStorage.getItem(USER_STORAGE_KEY);
    if (stored) {
      userInfo = stored;
      return JSON.parse(stored) as T;
    }
  } catch {
    // ignore storage errors in dev
  }

  return null;
}

export function getAccessToken(): string | null {
  if (accessToken) return accessToken;
  if (isProductionEnv() || !isBrowser()) return accessToken;

  try {
    const stored = window.localStorage.getItem(TOKEN_STORAGE_KEY);
    if (stored) {
      accessToken = stored;
      return stored;
    }
  } catch {
    // ignore storage errors in dev
  }

  return accessToken;
}

export function clearAllClientStorage() {
  accessToken = null;
  userInfo = null;

  if (!isBrowser()) return;

  // Clear localStorage (preserving appearance preferences)
  try {
    const keysToKeep = ['appearance:theme', 'appearance:density', 'appearance:animations'];
    const keysToRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && !keysToKeep.includes(key)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => {
      window.localStorage.removeItem(key);
    });
  } catch {
    // ignore
  }

  // Clear sessionStorage
  try {
    window.sessionStorage.clear();
  } catch {
    // ignore
  }

  // Clear cookies (client-side)
  try {
    const cookies = document.cookie.split(';');
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i];
      const eqPos = cookie.indexOf('=');
      const name = eqPos > -1 ? cookie.substring(0, eqPos).trim() : cookie.trim();
      document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
      document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=${window.location.hostname}`;
    }
  } catch {
    // ignore
  }

  // Clear window.caches (Cache API)
  try {
    if (window.caches) {
      window.caches.keys().then((keys) => {
        keys.forEach((key) => {
          window.caches.delete(key);
        });
      });
    }
  } catch {
    // ignore
  }
}

export { isProductionEnv };

export default {
  setAccessToken,
  getAccessToken,
  setStoredUser,
  getStoredUser,
  clearAllClientStorage,
  isProductionEnv,
};
