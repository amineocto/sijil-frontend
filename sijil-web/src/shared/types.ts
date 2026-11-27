/** Formes rendues par le BFF, reprises de `contracts/sijil-api.yaml` et `sijil-catalogue.yaml`. */

export type PartyType = "CLIENT" | "PERSONNE" | "COMPTE";
export type PartyRole =
  "TITULAIRE" | "CO_TITULAIRE" | "GARANT" | "MANDATAIRE" | "REPRESENTANT_LEGAL" | "AUTRE";

export interface Party {
  type: PartyType;
  id: string;
  role: PartyRole;
}

export interface DocumentView {
  id: string;
  documentType: string;
  typeVersion: number;
  parcours: string;
  status: string;
  sensitivity: "STANDARD" | "SENSIBLE" | "RESTREINT";
  currentVersion: number;
  createdAt: string;
  parties: Party[];
  metadata: Record<string, unknown>;
  content: { mediaType: string; size: number; sha256: string };
  /** Écart entre le type déclaré et le type détecté par les traitements (lot 5). */
  verification?: { status: "A_VERIFIER"; detectedType: string };
  /** Restitué dans le portefeuille client 360 (ADR 0025) ; fiche seulement. */
  sharedInPortfolio?: boolean;
}

/** Document trouvé en plein texte (forme `Document` de la façade, source Sijil). */
export interface FullTextItem {
  id: string;
  type: { code: string; label: string };
  createdAt: string;
  sensitivity: string;
  source: { system: string; sijilId?: string };
}

export interface FullTextPage {
  items: FullTextItem[];
  page: { size: number; nextCursor?: string | null; hasMore: boolean };
}

export interface DocumentPage {
  items: DocumentView[];
  page: { size: number; nextCursor?: string | null; hasMore: boolean };
}

export interface Version {
  number: number;
  receivedAt: string;
  status: "EN_QUARANTAINE" | "ACTIF" | "REJETE_TECHNIQUE";
  current: boolean;
  mediaType: string;
  size: number;
}

export interface MetadataRevision {
  number: number;
  metadata: Record<string, unknown>;
  reason?: string | null;
  author: string;
  revisedAt: string;
}

export interface Usage {
  parcours: string;
  purpose: string;
  day: string;
  clientId: string;
}

export interface Items<T> {
  items: T[];
}

export interface Reception {
  id: string;
  status: string;
  lastVersion: number;
  pendingVersion: boolean;
  revision: number;
}

export interface TypeSummary {
  code: string;
  label?: string | null;
}

/** Propriété du schéma de métadonnées d'un type (JSON Schema, sous-ensemble affiché). */
export interface MetadataProperty {
  type?: string;
  format?: string;
  title?: string;
  enum?: string[];
  maxLength?: number;
  minLength?: number;
  pattern?: string;
  minimum?: number;
  maximum?: number;
}

export interface MetadataSchema {
  required?: string[];
  properties?: Record<string, MetadataProperty>;
}

export interface TypeVersion {
  code: string;
  version: number;
  definition: {
    labels?: { fr?: string };
    formats?: string[];
    maxSizeMb?: number;
    origins?: { channels?: string[] };
    parties?: { roles?: PartyRole[] };
    metadataSchema?: MetadataSchema;
  };
}

export interface UploadSession {
  id: string;
  upload: { method: "PUT"; url: string; headers: Record<string, string> };
}
