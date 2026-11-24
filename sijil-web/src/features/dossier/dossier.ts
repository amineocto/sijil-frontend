import type { DocumentView } from "@/shared/types";

/** Familles du catalogue, dans l'ordre du dossier ; une famille inconnue suit, par son code. */
export const FAMILY_LABELS: Record<string, string> = {
  IDENTITE: "Identité",
  REVENUS: "Revenus",
  COMPTE: "Compte",
  CONTRAT: "Contrats",
  CREDIT: "Crédit",
  GARANTIE: "Garanties",
  ENTREPRISE: "Entreprise",
  MANDAT: "Mandats",
  CONTENTIEUX: "Contentieux",
};

const OTHER = "AUTRES";

export interface TypeInfo {
  label?: string | null | undefined;
  family?: string | null | undefined;
}

export interface FamilyGroup {
  family: string;
  label: string;
  documents: DocumentView[];
}

/** Échéance proche : moins de 30 jours. */
export const SOON_DAYS = 30;

export type Validity =
  | { state: "VALIDE"; until: string }
  | { state: "BIENTOT"; until: string; days: number }
  | { state: "EXPIREE"; until: string }
  | { state: "SANS_ECHEANCE" };

/** Validité d'une pièce d'après sa métadonnée `dateExpiration` (date ISO), au jour donné. */
export function validity(document: DocumentView, today: Date): Validity {
  const raw = document.metadata["dateExpiration"];
  if (typeof raw !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(raw))
    return { state: "SANS_ECHEANCE" };
  const until = new Date(`${raw}T00:00:00Z`);
  const start = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const days = Math.round((until.getTime() - start) / 86_400_000);
  if (days < 0) return { state: "EXPIREE", until: raw };
  if (days < SOON_DAYS) return { state: "BIENTOT", until: raw, days };
  return { state: "VALIDE", until: raw };
}

export function familyLabel(family: string): string {
  if (family === OTHER) return "Autres documents";
  return FAMILY_LABELS[family] ?? family;
}

/** Pièces groupées par famille du type (ordre du catalogue), les plus récentes d'abord. */
export function groupByFamily(
  documents: DocumentView[],
  types: Record<string, TypeInfo>,
): FamilyGroup[] {
  const groups = new Map<string, DocumentView[]>();
  for (const document of documents) {
    const family = types[document.documentType]?.family ?? OTHER;
    groups.set(family, [...(groups.get(family) ?? []), document]);
  }
  const order = [...Object.keys(FAMILY_LABELS)];
  const rank = (family: string) => {
    const index = order.indexOf(family);
    if (family === OTHER) return Number.MAX_SAFE_INTEGER;
    return index === -1 ? order.length : index;
  };
  return [...groups.entries()]
    .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))
    .map(([family, docs]) => ({
      family,
      label: familyLabel(family),
      documents: [...docs].sort((x, y) => y.createdAt.localeCompare(x.createdAt)),
    }));
}

/** Libellé d'un type pour l'écran, son code à défaut. */
export function typeLabel(code: string, types: Record<string, TypeInfo>): string {
  return types[code]?.label ?? code;
}
