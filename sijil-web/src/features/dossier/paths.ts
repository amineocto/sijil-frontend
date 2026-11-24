import type { PartyType } from "@/shared/types";

const SEGMENTS: Record<PartyType, string> = {
  CLIENT: "client",
  PERSONNE: "personne",
  COMPTE: "compte",
};

/** Adresse du dossier d'une partie : `/dossiers/client/CLI-42`. */
export function dossierPath(type: PartyType, id: string): string {
  return `/dossiers/${SEGMENTS[type]}/${encodeURIComponent(id)}`;
}

/** Type de partie lu dans l'adresse ; inconnu : `undefined`. */
export function partyTypeOf(segment: string | undefined): PartyType | undefined {
  const entry = Object.entries(SEGMENTS).find(([, value]) => value === segment);
  return entry?.[0] as PartyType | undefined;
}
