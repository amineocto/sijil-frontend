import type { PartyType } from "@/shared/types";

const KEY_PREFIX = "sijil-dossiers-recents:";
const LEGACY_SHARED_KEY = "sijil-dossiers-recents";
const MAX = 6;
const PARTY_TYPES = ["CLIENT", "PERSONNE", "COMPTE"];

export interface RecentDossier {
  type: PartyType;
  id: string;
  openedAt: string;
}

export function recentDossiers(user: string | undefined): RecentDossier[] {
  if (!user) return [];
  try {
    removeLegacySharedList();
    const raw: unknown = JSON.parse(sessionStorage.getItem(KEY_PREFIX + user) ?? "[]");
    return Array.isArray(raw) ? raw.filter(isRecentDossier) : [];
  } catch {
    return [];
  }
}

export function rememberDossier(
  user: string | undefined,
  type: PartyType,
  id: string,
  now = new Date(),
): void {
  if (!user) return;
  try {
    const others = recentDossiers(user).filter((r) => !(r.type === type && r.id === id));
    const next = [{ type, id, openedAt: now.toISOString() }, ...others].slice(0, MAX);
    sessionStorage.setItem(KEY_PREFIX + user, JSON.stringify(next));
  } catch {
    return;
  }
}

export function forgetRecentDossiers(): void {
  try {
    removeLegacySharedList();
    Object.keys(sessionStorage)
      .filter((key) => key.startsWith(KEY_PREFIX))
      .forEach((key) => {
        sessionStorage.removeItem(key);
      });
  } catch {
    return;
  }
}

function removeLegacySharedList(): void {
  localStorage.removeItem(LEGACY_SHARED_KEY);
}

function isRecentDossier(value: unknown): value is RecentDossier {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<RecentDossier>;
  return typeof candidate.id === "string" && PARTY_TYPES.includes(candidate.type ?? "");
}
