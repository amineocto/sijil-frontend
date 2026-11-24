/** Visites déjà vues, par utilisateur, dans ce navigateur (commodité : rien n'en dépend). */
const SEEN_KEY = "sijil-visite-vue";

/**
 * Démarrage automatique à la première connexion d'un utilisateur ; coupé par
 * `VITE_TOUR_AUTOSTART=false` (tests, scénarios de bout en bout).
 */
export const tourSettings = { autoStart: import.meta.env["VITE_TOUR_AUTOSTART"] !== "false" };

function seenUsers(): string[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]");
    return Array.isArray(raw) ? raw.filter((u): u is string => typeof u === "string") : [];
  } catch {
    return [];
  }
}

export function hasSeenTour(user: string): boolean {
  return seenUsers().includes(user);
}

export function markTourSeen(user: string): void {
  try {
    const users = seenUsers();
    if (!users.includes(user)) localStorage.setItem(SEEN_KEY, JSON.stringify([...users, user]));
  } catch {
    // Stockage indisponible (navigation privée) : la visite sera proposée à nouveau.
  }
}
