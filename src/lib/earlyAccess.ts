export const ACCESS_CODE = "5667";
const STORAGE_KEY = "wj_early_access";

export function hasEarlyAccess(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === ACCESS_CODE;
  } catch {
    return false;
  }
}

export function grantEarlyAccess() {
  try {
    localStorage.setItem(STORAGE_KEY, ACCESS_CODE);
  } catch {
    /* ignore */
  }
}