/**
 * localStorage-backed preferences: one try/catch scheme shared by Rankings,
 * Draft Intelligence and Team Builder (previously three hand-rolled copies).
 * Validation of loaded values stays with the callers, who know the domain.
 */

export function loadJsonPref<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as T;
    // Objects merge over their defaults (partial prefs stay valid); arrays and
    // scalars replace wholesale.
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) &&
      fallback && typeof fallback === 'object' && !Array.isArray(fallback)
      ? { ...fallback, ...parsed }
      : parsed;
  } catch {
    return fallback;
  }
}

export function saveJsonPref<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be unavailable in strict/private browser contexts.
  }
}

export function loadStringPref(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function saveStringPref(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // see above
  }
}

export function removePref(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // see above
  }
}
