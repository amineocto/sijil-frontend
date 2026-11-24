import type { PartyType } from "@/shared/types";

/** Dossiers récemment ouverts, dans ce navigateur (commodité : rien n'en dépend). */
const RECENTS_KEY = "sijil-dossiers-recents";
const MAX = 6;

export interface RecentDossier {
  type: PartyType;
  id: string;
  openedAt: string;
}

export function recentDossiers(): RecentDossier[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(RECENTS_KEY) ?? "[]");
    return Array.isArray(raw)
      ? raw.filter(
          (r): r is RecentDossier =>
            typeof r === "object" &&
            r !== null &&
            typeof (r as RecentDossier).id === "string" &&
            ["CLIENT", "PERSONNE", "COMPTE"].includes((r as RecentDossier).type),
        )
      : [];
  } catch {
    return [];
  }
}

export function rememberDossier(type: PartyType, id: string, now = new Date()): void {
  try {
    const others = recentDossiers().filter((r) => !(r.type === type && r.id === id));
    const next = [{ type, id, openedAt: now.toISOString() }, ...others].slice(0, MAX);
    localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
  } catch {
    // Stockage indisponible (navigation privée) : pas de dossiers récents.
  }
}
