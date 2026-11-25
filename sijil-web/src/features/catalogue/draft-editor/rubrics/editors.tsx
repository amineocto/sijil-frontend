import { useQuery } from "@tanstack/react-query";
import type { UseFormReturn } from "react-hook-form";
import type { EditorValues } from "@/features/catalogue/draft-editor/form";
import { api, call } from "@/shared/api";
import { PARTY_ROLE_LABELS } from "@/shared/labels";
import { SelectField, TextField } from "@/shared/ui";
import { CheckboxGroup, ChipsField, PeriodField, Switch } from "./controls";
import { compact, objectOf, omit, stringsOf, text, usePart, type Json } from "./part";

type Form = UseFormReturn<EditorValues>;

const ROLES = Object.entries(PARTY_ROLE_LABELS).map(([value, label]) => ({ value, label }));

/** Identité : rôles des parties attendues sur le document. */
export function PartiesEditor({ form }: { form: Form }) {
  const part = usePart<Json>(form, "parties");
  const roles = stringsOf(objectOf(part.value)["roles"]);
  return (
    <CheckboxGroup
      legend="Rôles des parties attendues"
      description="Le titulaire est toujours accepté."
      options={ROLES}
      values={roles}
      onChange={(next) => {
        part.set(next.length ? { ...objectOf(part.value), roles: next } : undefined);
      }}
    />
  );
}

const EXPIRES = [
  { value: "NONE", label: "Pas d'expiration" },
  { value: "FROM_METADATA", label: "Lue dans une métadonnée de date" },
  { value: "COMPUTED", label: "Calculée : date du document plus une durée" },
];

/** Validité : comment la date d'expiration de la pièce est connue. */
export function ValidityEditor({ form }: { form: Form }) {
  const part = usePart<Json>(form, "validity");
  const metadata = usePart<Json>(form, "metadataSchema");
  const v = objectOf(part.value);
  const dateFields = Object.entries(objectOf(objectOf(metadata.value)["properties"]))
    .filter(([, p]) => objectOf(p)["format"] === "date")
    .map(([name, p]) => ({ value: name, label: text(objectOf(p)["title"]) || name }));
  const update = (patch: Json) => {
    part.set(compact({ ...v, ...patch }));
  };
  return (
    <div className="flex flex-col gap-4">
      <SelectField
        label="Expiration de la pièce"
        placeholder="Non renseignée"
        options={EXPIRES}
        value={text(v["expiresAt"])}
        onChange={(e) => {
          const expiresAt = e.currentTarget.value || undefined;
          part.set(
            expiresAt ? compact({ expiresAt, field: undefined, duration: undefined }) : undefined,
          );
        }}
      />
      {v["expiresAt"] === "FROM_METADATA" && (
        <SelectField
          label="Métadonnée qui porte la date d'expiration"
          description={
            dateFields.length === 0
              ? "Ajoutez d'abord une métadonnée au format date dans la rubrique Métadonnées."
              : undefined
          }
          placeholder="Choisir une métadonnée"
          options={dateFields}
          value={text(v["field"])}
          onChange={(e) => {
            update({ field: e.currentTarget.value || undefined });
          }}
        />
      )}
      {v["expiresAt"] === "COMPUTED" && (
        <PeriodField
          label="Durée de validité"
          description="À compter de la date du document."
          required
          value={v["duration"] as string | undefined}
          onChange={(duration) => {
            update({ duration });
          }}
        />
      )}
    </div>
  );
}

const START_EVENTS = [
  { value: "CREATION", label: "Création du document" },
  { value: "FIN_RELATION", label: "Fin de la relation client" },
  { value: "ECHEANCE_CONTRAT", label: "Échéance du contrat" },
  { value: "EXPIRATION", label: "Expiration du document" },
  { value: "EVENEMENT_METIER", label: "Événement métier" },
];

const ON_EXPIRY = [
  { value: "NONE", label: "Conserver, aucune action" },
  { value: "PURGE", label: "Purger (si la purge est activée pour le parcours)" },
];

/** Rétention : politique validée par la conformité, point de départ et durée. */
export function RetentionEditor({ form }: { form: Form }) {
  const part = usePart<Json>(form, "retention");
  const r = objectOf(part.value);
  const update = (patch: Json) => {
    const next = compact({ ...r, ...patch });
    part.set(Object.keys(next).length ? next : undefined);
  };
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <TextField
        label="Politique de rétention"
        description="Code de la politique validée par la conformité, par exemple KYC_10A ; ses termes sont recopiés à la soumission."
        required
        value={text(r["policy"])}
        onChange={(e) => {
          update({ policy: e.currentTarget.value.toUpperCase() });
        }}
      />
      <SelectField
        label="Point de départ"
        required
        placeholder="Choisir"
        options={START_EVENTS}
        value={text(r["startEvent"])}
        onChange={(e) => {
          const startEvent = e.currentTarget.value || undefined;
          update({
            startEvent,
            eventCode: startEvent === "EVENEMENT_METIER" ? r["eventCode"] : undefined,
          });
        }}
      />
      {r["startEvent"] === "EVENEMENT_METIER" && (
        <TextField
          label="Code de l'événement métier"
          value={text(r["eventCode"])}
          onChange={(e) => {
            update({ eventCode: e.currentTarget.value.toUpperCase() });
          }}
        />
      )}
      <PeriodField
        label="Durée de conservation"
        required
        value={r["duration"] as string | undefined}
        onChange={(duration) => {
          update({ duration });
        }}
      />
      <PeriodField
        label="Passage en archive froide après"
        description="Facultatif (lot 6)."
        value={r["coldAfter"] as string | undefined}
        onChange={(coldAfter) => {
          update({ coldAfter });
        }}
      />
      <SelectField
        label="À l'échéance"
        required
        placeholder="Choisir"
        options={ON_EXPIRY}
        value={text(r["onExpiry"])}
        onChange={(e) => {
          update({ onExpiry: e.currentTarget.value || undefined });
        }}
      />
      <TextField
        label="Base légale"
        required
        maxLength={500}
        value={text(r["legalBasis"])}
        onChange={(e) => {
          update({ legalBasis: e.currentTarget.value });
        }}
      />
      <TextField
        label="Référence du texte"
        description="Facultative, par exemple l'article de loi."
        maxLength={200}
        value={text(r["legalReference"])}
        onChange={(e) => {
          update({ legalReference: e.currentTarget.value });
        }}
      />
    </div>
  );
}

const KNOWN_FORMATS = [
  { value: "application/pdf", label: "PDF" },
  { value: "image/jpeg", label: "Image JPEG" },
  { value: "image/png", label: "Image PNG" },
  { value: "image/tiff", label: "Image TIFF" },
];

/** Stockage : emplacement, versions, formats admis et taille maximale. */
export function StorageEditor({ form }: { form: Form }) {
  const storage = usePart<Json>(form, "storage");
  const versioning = usePart<Json>(form, "versioning");
  const formats = usePart<string[]>(form, "formats");
  const maxSize = usePart<number>(form, "maxSizeMb");
  const s = objectOf(storage.value);
  const v = objectOf(versioning.value);
  const all = stringsOf(formats.value);
  const known = all.filter((f) => KNOWN_FORMATS.some((k) => k.value === f));
  const others = all.filter((f) => !KNOWN_FORMATS.some((k) => k.value === f));
  const setFormats = (next: string[]) => {
    formats.set(next.length ? next : undefined);
  };
  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 md:grid-cols-2">
        <TextField
          label="Emplacement de stockage"
          description="Nom logique en minuscules, par exemple identite ; la clé de chaque objet est calculée par le serveur."
          required
          value={text(s["bucket"])}
          onChange={(e) => {
            const bucket = e.currentTarget.value.toLowerCase();
            storage.set(
              bucket || s["lossyRecompression"] !== undefined
                ? compact({ ...s, bucket })
                : undefined,
            );
          }}
        />
        <TextField
          label="Taille maximale d'un fichier (Mo)"
          type="number"
          min={1}
          required
          value={maxSize.value === undefined ? "" : text(maxSize.value)}
          onChange={(e) => {
            const n = e.currentTarget.value;
            maxSize.set(n === "" ? undefined : Number(n));
          }}
        />
      </div>
      <Switch
        label="Recompression avec perte autorisée"
        description="Réduit le poids des images ; à éviter pour une pièce à valeur probante."
        checked={s["lossyRecompression"] === true}
        onChange={(lossyRecompression) => {
          storage.set(compact({ ...s, lossyRecompression }));
        }}
      />
      <CheckboxGroup
        legend="Formats admis"
        options={KNOWN_FORMATS}
        values={known}
        onChange={(next) => {
          setFormats([...next, ...others]);
        }}
      />
      <ChipsField
        label="Autres formats"
        description="Type MIME, par exemple application/vnd.ms-excel."
        placeholder="application/…"
        values={others}
        normalize={(f) => f.toLowerCase()}
        onChange={(next) => {
          setFormats([...known, ...next]);
        }}
      />
      <Switch
        label="Nouvelles versions du fichier autorisées"
        checked={v["allowed"] === true}
        onChange={(allowed) => {
          versioning.set(compact({ ...v, allowed, max: allowed ? v["max"] : undefined }));
        }}
      />
      {v["allowed"] === true && (
        <TextField
          label="Nombre maximal de versions"
          description="Facultatif, de 1 à 1000."
          type="number"
          min={1}
          max={1000}
          value={v["max"] === undefined ? "" : text(v["max"])}
          onChange={(e) => {
            const n = e.currentTarget.value;
            versioning.set(compact({ ...v, max: n === "" ? undefined : Number(n) }));
          }}
        />
      )}
    </div>
  );
}

const EXTRACTIONS = [
  { value: "NONE", label: "Aucune" },
  { value: "MRZ", label: "Bande MRZ (pièce d'identité)" },
  { value: "QR", label: "Code QR (non décodé pour l'instant)" },
  { value: "SERVICE", label: "Service d'extraction" },
];

/** Traitements : origines du document et traitements après admission. */
export function ProcessingEditor({ form }: { form: Form }) {
  const origins = usePart<Json>(form, "origins");
  const processing = usePart<Json>(form, "processing");
  const o = objectOf(origins.value);
  const p = objectOf(processing.value);
  const detection = objectOf(p["detection"]);
  const parcours = useQuery({
    queryKey: ["parcours"],
    queryFn: () => call(api.GET("/api/parcours")),
  });
  const updateOrigins = (patch: Json) => {
    const next = compact({ ...o, ...patch });
    origins.set(Object.keys(next).length ? next : undefined);
  };
  const updateProcessing = (patch: Json) => {
    processing.set(compact({ ...p, ...patch }));
  };
  const updateDetection = (patch: Json) => {
    updateProcessing({ detection: compact({ ...detection, ...patch }) });
  };
  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-4" aria-labelledby="origines">
        <h3 id="origines" className="text-base font-semibold text-gray-900">
          Origines
        </h3>
        <CheckboxGroup
          legend="Parcours qui déposent ce type"
          options={(parcours.data ?? []).map((x) => ({ value: x.code, label: x.label }))}
          values={stringsOf(o["parcours"])}
          onChange={(next) => {
            updateOrigins({ parcours: next.length ? next : undefined });
          }}
        />
        <ChipsField
          label="Canaux de collecte"
          description="En majuscules, par exemple AGENCE, EN_LIGNE, CRC."
          placeholder="AGENCE"
          values={stringsOf(o["channels"])}
          normalize={(c) => c.toUpperCase().replace(/[^A-Z0-9_]/g, "_")}
          onChange={(next) => {
            updateOrigins({ channels: next.length ? next : undefined });
          }}
        />
        <Switch
          label="Collectable pour un prospect"
          description="Avant l'identification du client : oui pour une CIN ou un justificatif de domicile, non pour un relevé de compte."
          checked={o["prospect"] === true}
          onChange={(prospect) => {
            updateOrigins({ prospect });
          }}
        />
      </section>
      <section className="flex flex-col gap-4" aria-labelledby="apres-admission">
        <h3 id="apres-admission" className="text-base font-semibold text-gray-900">
          Après l&apos;admission
        </h3>
        <p className="text-sm text-gray-600">L&apos;antivirus est toujours appliqué.</p>
        <Switch
          label="Reconnaissance du texte (OCR)"
          description="Rend le document trouvable en plein texte."
          checked={p["ocr"] === true}
          onChange={(ocr) => {
            updateProcessing({ ocr });
          }}
        />
        <SelectField
          label="Extraction de champs"
          options={EXTRACTIONS}
          value={text(p["extraction"]) || "NONE"}
          onChange={(e) => {
            updateProcessing({ extraction: e.currentTarget.value });
          }}
        />
        <Switch
          label="Rendu PDF/A d'archivage"
          checked={p["pdfa"] === true}
          onChange={(pdfa) => {
            updateProcessing({ pdfa });
          }}
        />
        <Switch
          label="Détection du type"
          description="Signale un document déposé sous un autre type (« type à vérifier »)."
          checked={detection["enabled"] === true}
          onChange={(enabled) => {
            updateDetection({ enabled });
          }}
        />
        {detection["enabled"] === true && (
          <div className="grid gap-4 border-s-2 border-orange-100 ps-4 md:grid-cols-2">
            <ChipsField
              label="Mots-clés qui signalent ce type"
              placeholder="carte nationale"
              values={stringsOf(detection["keywords"])}
              onChange={(keywords) => {
                updateDetection({ keywords: keywords.length ? keywords : undefined });
              }}
            />
            <TextField
              label="Code MRZ"
              description="ID pour une CIN, P pour un passeport."
              maxLength={2}
              value={text(detection["mrz"])}
              onChange={(e) => {
                updateDetection({ mrz: e.currentTarget.value.toUpperCase() });
              }}
            />
            <TextField
              label="Score minimal"
              description="Entre 0 et 1."
              type="number"
              min={0}
              max={1}
              step={0.05}
              value={detection["minScore"] === undefined ? "" : text(detection["minScore"])}
              onChange={(e) => {
                const n = e.currentTarget.value;
                updateDetection({ minScore: n === "" ? undefined : Number(n) });
              }}
            />
          </div>
        )}
      </section>
    </div>
  );
}

/** Visibilité et réutilisation, à côté de la sensibilité. */
export function VisibilityEditor({ form }: { form: Form }) {
  const visibility = usePart<Json>(form, "visibility");
  const reuse = usePart<Json>(form, "reuse");
  const v = objectOf(visibility.value);
  // `client` est l'ancien nom de `portfolio` (ADR 0025) : lu, puis réécrit sous le nouveau nom.
  const portfolio = (v["portfolio"] ?? v["client"]) === true;
  const update = (patch: Json) => {
    const rest = omit(v, ["client"]);
    visibility.set(
      compact({ portfolio, subsidiaries: v["subsidiaries"] === true, ...rest, ...patch }),
    );
  };
  return (
    <div className="flex flex-col gap-4">
      <Switch
        label="Éligible au portefeuille client 360"
        description="Le type y apparaît si l'administration du parcours le partage."
        checked={portfolio}
        onChange={(next) => {
          update({ portfolio: next });
        }}
      />
      <Switch
        label="Visible des filiales"
        checked={v["subsidiaries"] === true}
        onChange={(subsidiaries) => {
          update({ subsidiaries });
        }}
      />
      <Switch
        label="Réutilisable par d'autres parcours"
        description="Un autre parcours peut déclarer ce type dans ses propres dossiers."
        checked={objectOf(reuse.value)["allowed"] === true}
        onChange={(allowed) => {
          reuse.set({ allowed });
        }}
      />
    </div>
  );
}

/** Correspondance FileNet, facultative (consultation et reprise future). */
export function FilenetEditor({ form }: { form: Form }) {
  const part = usePart<Json>(form, "filenet");
  const f = objectOf(part.value);
  const update = (patch: Json) => {
    const next = compact({ ...f, ...patch });
    part.set(Object.keys(next).length ? next : undefined);
  };
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-gray-600">
        Facultative : à renseigner seulement si ce type existe déjà dans FileNet.
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        <TextField
          label="Classe documentaire FileNet"
          value={text(f["documentClass"])}
          onChange={(e) => {
            update({ documentClass: e.currentTarget.value });
          }}
        />
        <TextField
          label="Valeur du type dans FileNet"
          value={text(f["typeValue"])}
          onChange={(e) => {
            update({ typeValue: e.currentTarget.value });
          }}
        />
      </div>
    </div>
  );
}
