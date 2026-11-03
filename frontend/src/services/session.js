const TOKEN_KEY = 'credchain_token';
const USER_KEY = 'credchain_user';

export function readSessionToken() {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function readSessionUser() {
  const raw = sessionStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function writeSessionToken(token) {
  if (token) sessionStorage.setItem(TOKEN_KEY, token);
  else sessionStorage.removeItem(TOKEN_KEY);
}

export function writeSessionUser(user) {
  if (user) sessionStorage.setItem(USER_KEY, JSON.stringify(user));
  else sessionStorage.removeItem(USER_KEY);
}

export function clearSession() {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
}

/** Drop the old shared login so a previous tab cannot keep signing every tab in. */
export function clearLegacySharedSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}
