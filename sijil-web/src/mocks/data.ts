import type { Session } from "@/shared/session";
import type { DocumentView, TypeVersion } from "@/shared/types";

export const CONTRIBUTOR: Session = {
  user: "T00002",
  profil: "CONSEILLER",
  parcours: "eer",
  roles: ["sijil-contributeur"],
};

export const READER: Session = {
  user: "L0001",
  profil: null,
  parcours: null,
  roles: ["sijil-lecteur"],
};

export const CIN: TypeVersion = {
  code: "CIN",
  version: 2,
  definition: {
    labels: { fr: "Carte d'identité nationale" },
    formats: ["application/pdf", "image/png", "image/jpeg"],
    maxSizeMb: 5,
    origins: { channels: ["AGENCE"] },
    parties: { roles: ["TITULAIRE"] },
    metadataSchema: {
      required: ["numero"],
      properties: {
        numero: { type: "string", title: "Numéro", maxLength: 20 },
        dateExpiration: { type: "string", format: "date", title: "Date d'expiration" },
        nationalite: { type: "string", title: "Nationalité", enum: ["MA", "FR", "ES"] },
        pages: { type: "integer", title: "Nombre de pages" },
        recto: { type: "boolean", title: "Recto seulement" },
      },
    },
  },
};

export function initialDocuments(): DocumentView[] {
  return [
    document("2f1c2a54-7c1e-4a3b-9d55-0b2f5e9b1a11", "eer", "SENSIBLE", { numero: "AB12345" }),
    document("7b0e9f3a-1c2d-4e5f-8a9b-0c1d2e3f4a5b", "credit-immo", "STANDARD", {
      numero: "CD67890",
    }),
  ];
}

export function document(
  id: string,
  parcours: string,
  sensitivity: DocumentView["sensitivity"],
  metadata: Record<string, unknown>,
): DocumentView {
  return {
    id,
    documentType: "CIN",
    typeVersion: 2,
    parcours,
    status: "ACTIF",
    sensitivity,
    currentVersion: 1,
    createdAt: "2026-11-12T09:30:00Z",
    parties: [{ type: "CLIENT", id: "CLI-42", role: "TITULAIRE" }],
    metadata,
    content: { mediaType: "application/pdf", size: 48_213, sha256: "0".repeat(64) },
  };
}
