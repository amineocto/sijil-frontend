import type { Definition, Schemas, TypeStatus } from "@/shared/api";

/** Données de démonstration (L3-09) : aucun type réel de la banque. */
export interface MockVersion {
  version: number;
  status: TypeStatus;
  effectiveFrom: string | null;
  submittedBy: string | null;
  reviewedBy: string | null;
  reviewReason: string | null;
  definition: Definition;
  revision: number;
}

export interface MockType {
  code: string;
  family: string | null;
  ownerParcours: string;
  referentParcours: string;
  versions: MockVersion[];
  reuses: Schemas["Reuse"][];
}

export const SESSION: Schemas["Session"] = {
  user: "contributeur.demo",
  roles: ["catalogue-lecteur", "catalogue-contributeur"],
  parcours: ["eer"],
};

/** Réviseur du catalogue, sans parcours de contribution. */
export const REVIEWER: Schemas["Session"] = {
  user: "reviseur.demo",
  roles: ["catalogue-lecteur", "catalogue-reviseur"],
  parcours: [],
};

/** Administrateur du domaine `eer` : partage des types dans le portefeuille client (ADR 0025). */
export const DOMAIN_ADMIN: Schemas["Session"] = {
  user: "admin-domaine.demo",
  roles: ["catalogue-lecteur", "catalogue-admin-domaine"],
  parcours: ["eer"],
};

/** Data Office : tient le dictionnaire de métadonnées (ADR 0038). */
export const DATA_OFFICE: Schemas["Session"] = {
  user: "data-office.demo",
  roles: ["catalogue-lecteur", "catalogue-data-office"],
  parcours: [],
};

type Term = Schemas["MetadataTerm"];

function term(code: string, labelFr: string, terms: Partial<Term> = {}): Term {
  return {
    code,
    labelFr,
    labelAr: null,
    labelEn: null,
    definition: null,
    format: "TEXT",
    maxLength: null,
    pattern: null,
    values: [],
    minimum: null,
    maximum: null,
    personalData: "AUCUNE",
    filenetProperty: null,
    status: "ACTIF",
    revision: 0,
    updatedBy: "reprise-adr-0038",
    updatedAt: "2026-11-25T10:00:00Z",
    ...terms,
  };
}

/** Dictionnaire de démonstration : une partie de la reprise des types (ADR 0038). */
export function initialTerms(): Term[] {
  return [
    term("dateExpiration", "Date d'expiration", {
      format: "DATE",
      definition: "Date au-delà de laquelle la pièce n'est plus valable.",
    }),
    term("dateFin", "Date de fin", { format: "DATE", status: "DEPRECIE" }),
    term("montant", "Montant", { format: "NUMBER", minimum: 0 }),
    term("numero", "Numéro de la pièce", { maxLength: 200, personalData: "PERSONNELLE" }),
    term("numeroCin", "Numéro de CIN", {
      pattern: "^[A-Z]{1,2}[0-9]{1,6}$",
      personalData: "PERSONNELLE",
    }),
    term("paysEmission", "Pays d'émission", { format: "ENUM", values: ["MAR", "FRA", "ESP"] }),
  ];
}

/** Types éligibles au portefeuille client et leur partage par le parcours `eer`. */
export function initialSharing(): Schemas["TypeSharing"][] {
  return [
    {
      typeCode: "CIN",
      shared: true,
      decidedBy: "admin-domaine.demo",
      decidedAt: "2026-11-20T09:00:00Z",
      reason: "Pièce d'identité du portefeuille",
    },
    { typeCode: "RIB", shared: false, decidedBy: null, decidedAt: null, reason: null },
  ];
}

export const PARCOURS: Schemas["Parcours"][] = [
  {
    code: "eer",
    label: "Entrée en relation",
    team: "Équipe EER",
    active: true,
  },
  {
    code: "credit-immo",
    label: "Crédit immobilier",
    team: "Équipe crédit",
    active: true,
  },
];

export const COMPLETE_DEFINITION: Definition = {
  labels: { fr: "Carte d'identité nationale", ar: "البطاقة الوطنية للتعريف" },
  family: "IDENTITE",
  level: "PERSONNE",
  parties: { roles: ["TITULAIRE"] },
  metadataSchema: {
    type: "object",
    required: ["numero"],
    properties: {
      numero: { type: "string", title: "Numéro" },
      dateExpiration: {
        type: "string",
        format: "date",
        title: "Date d'expiration",
      },
    },
  },
  validity: { expiresAt: "FROM_METADATA", field: "dateExpiration" },
  retention: { startEvent: "FIN_RELATION", duration: "P10Y", onExpiry: "NONE" },
  storage: { bucket: "eer", lossyRecompression: false },
  versioning: { allowed: true, max: 20 },
  formats: ["application/pdf", "image/jpeg"],
  maxSizeMb: 10,
  origins: { channels: ["AGENCE"], parcours: ["eer"] },
  processing: { ocr: true },
  sensitivity: "SENSIBLE",
  visibility: { portfolio: true, subsidiaries: false },
  reuse: { allowed: true },
  filenet: { documentClass: "EER_PER_DOC", typeValue: "CIN" },
};

/** Rubriques obligatoires pour soumettre (contrôle simplifié du bouchon). */
export const REQUIRED_FOR_SUBMISSION = [
  "labels",
  "family",
  "level",
  "metadataSchema",
  "retention",
  "storage",
  "formats",
  "sensitivity",
] as const;

export function initialTypes(): MockType[] {
  const published: MockVersion = {
    version: 1,
    status: "PUBLIE",
    effectiveFrom: "2026-01-01",
    submittedBy: "contributeur.demo",
    reviewedBy: "reviseur.demo",
    reviewReason: null,
    definition: COMPLETE_DEFINITION,
    revision: 3,
  };
  return [
    {
      code: "CIN",
      family: "IDENTITE",
      ownerParcours: "eer",
      referentParcours: "eer",
      versions: [
        {
          ...published,
          version: 2,
          status: "BROUILLON",
          effectiveFrom: null,
          reviewedBy: null,
          reviewReason: "Préciser la base légale de la rétention.",
          definition: { ...COMPLETE_DEFINITION, maxSizeMb: 15 },
          revision: 1,
        },
        published,
      ],
      reuses: [
        {
          parcours: "credit-immo",
          purpose: "Pièce d'identité de l'emprunteur",
          declaredBy: "contributeur.credit",
          declaredAt: "2026-02-01T09:00:00Z",
        },
      ],
    },
    {
      code: "ATTESTATION_SALAIRE",
      family: "REVENUS",
      ownerParcours: "credit-immo",
      referentParcours: "credit-immo",
      versions: [
        {
          ...published,
          version: 2,
          status: "EN_REVUE",
          effectiveFrom: null,
          submittedBy: "contributeur.credit",
          reviewedBy: null,
          definition: {
            ...COMPLETE_DEFINITION,
            labels: { fr: "Attestation de salaire" },
            family: "REVENUS",
            maxSizeMb: 5,
          },
          revision: 2,
        },
        {
          ...published,
          definition: {
            ...COMPLETE_DEFINITION,
            labels: { fr: "Attestation de salaire" },
            family: "REVENUS",
          },
        },
      ],
      reuses: [],
    },
    {
      code: "OFFRE_PRET",
      family: "CREDIT",
      ownerParcours: "credit-immo",
      referentParcours: "credit-immo",
      versions: [
        {
          ...published,
          definition: {
            ...COMPLETE_DEFINITION,
            labels: { fr: "Offre de prêt" },
            family: "CREDIT",
          },
        },
      ],
      reuses: [],
    },
    {
      code: "RIB",
      family: null,
      ownerParcours: "eer",
      referentParcours: "eer",
      versions: [
        {
          version: 1,
          status: "BROUILLON",
          effectiveFrom: null,
          submittedBy: null,
          reviewedBy: null,
          reviewReason: null,
          definition: { labels: { fr: "Relevé d'identité bancaire" } },
          revision: 0,
        },
      ],
      reuses: [],
    },
  ];
}

/** Jeu d'exigences du crédit immobilier (lot 7), publié, rédigé par un autre utilisateur. */
export function initialRequirementSets(): Schemas["RequirementSet"][] {
  return [
    {
      code: "CREDIT_IMMO_PARTICULIER",
      version: 1,
      parcours: "credit-immo",
      status: "PUBLIE",
      definition: {
        label: "Crédit immobilier particulier",
        requirements: [
          {
            id: "identite",
            label: "Pièce d'identité",
            anyOf: ["CIN", "PASSEPORT"],
            for: { roles: ["TITULAIRE", "CO_TITULAIRE"] },
            freshness: "VALID_ON_DATE",
            minAssurance: "CONTROLE_AUTO",
          },
        ],
      },
      draftedBy: "C0042",
      draftedAt: "2026-11-20T10:00:00Z",
      publishedBy: "R0007",
      publishedAt: "2026-11-21T10:00:00Z",
      etag: '"1-0"',
    },
    {
      code: "EER_OUVERTURE",
      version: 1,
      parcours: "eer",
      status: "BROUILLON",
      definition: {
        label: "Ouverture de compte",
        requirements: [{ id: "identite", anyOf: ["CIN"], freshness: "VALID_ON_DATE" }],
      },
      draftedBy: "contributeur.demo",
      draftedAt: "2026-11-22T09:00:00Z",
      publishedBy: null,
      publishedAt: null,
      etag: '"1-0"',
    },
  ];
}
