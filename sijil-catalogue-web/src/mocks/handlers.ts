import { http, HttpResponse } from "msw";
import type { Definition, Schemas } from "@/shared/api";
import {
  PARCOURS,
  REQUIRED_FOR_SUBMISSION,
  SESSION,
  initialTypes,
  type MockType,
  type MockVersion,
} from "@/mocks/data";

const PAGE_SIZE = 20;
const CORRELATION = { "X-Correlation-Id": "demo-correlation-id" };

/** Bouchon du BFF du catalogue (contrat provisoire), avec un état modifiable par instance. */
export class CatalogueStub {
  types: MockType[] = initialTypes();
  session: Schemas["Session"] = SESSION;

  reset() {
    this.types = initialTypes();
    this.session = SESSION;
  }

  handlers() {
    return [
      http.get("/api/session", () => HttpResponse.json(this.session)),
      http.get("/api/parcours", () => HttpResponse.json(PARCOURS)),
      http.get("/api/types", ({ request }) => this.list(new URL(request.url).searchParams)),
      http.post("/api/types", async ({ request }) =>
        this.create((await request.json()) as Schemas["NewType"]),
      ),
      http.get("/api/types/:code", ({ params }) => this.sheet(String(params["code"]))),
      http.get("/api/types/:code/editor", ({ params }) => this.editor(String(params["code"]))),
      http.put("/api/types/:code/editor", async ({ params, request }) =>
        this.save(
          String(params["code"]),
          request.headers.get("If-Match"),
          (await request.json()) as Schemas["DraftUpdate"],
        ),
      ),
      http.post("/api/types/:code/new-version", ({ params }) =>
        this.newVersion(String(params["code"])),
      ),
      http.post("/api/types/:code/submission", ({ params, request }) =>
        this.submit(String(params["code"]), request.headers.get("If-Match")),
      ),
    ];
  }

  private list(query: URLSearchParams) {
    const q = query.get("q")?.toLowerCase();
    const matching = this.types
      .filter((t) => !query.get("parcours") || t.ownerParcours === query.get("parcours"))
      .filter((t) => !query.get("status") || latest(t).status === query.get("status"))
      .filter((t) => !q || t.code.toLowerCase().includes(q) || label(t)?.toLowerCase().includes(q))
      .sort((a, b) => a.code.localeCompare(b.code));
    const start = Number(query.get("cursor") ?? "0");
    const items = matching.slice(start, start + PAGE_SIZE).map(summary);
    const hasMore = start + PAGE_SIZE < matching.length;
    return HttpResponse.json<Schemas["TypePage"]>({
      items,
      hasMore,
      nextCursor: hasMore ? String(start + PAGE_SIZE) : null,
    });
  }

  private sheet(code: string) {
    const type = this.find(code);
    if (!type) return notFound();
    return HttpResponse.json<Schemas["TypeSheet"]>({
      code: type.code,
      family: type.family,
      ownerParcours: type.ownerParcours,
      referentParcours: type.referentParcours,
      canEdit: this.session.parcours.includes(type.ownerParcours),
      versions: type.versions.map((v) => ({
        version: v.version,
        status: v.status,
        effectiveFrom: v.effectiveFrom,
        submittedBy: v.submittedBy,
        reviewedBy: v.reviewedBy,
        reviewReason: v.reviewReason,
        definition: v.definition,
      })),
    });
  }

  private editor(code: string) {
    const type = this.find(code);
    const draft = type && latest(type);
    if (!type || !draft) return notFound();
    return HttpResponse.json(editorOf(type, draft));
  }

  private save(code: string, ifMatch: string | null, update: Schemas["DraftUpdate"]) {
    const type = this.find(code);
    const draft = type && latest(type);
    if (!type || !draft) return notFound();
    if (!this.session.parcours.includes(type.ownerParcours)) return problem(403, "Accès refusé");
    if (draft.status !== "BROUILLON") return problem(409, "Version non modifiable");
    if (ifMatch !== etagOf(type, draft)) return problem(412, "Version modifiée entre-temps");
    const labels = update.definition["labels"] as { fr?: unknown } | undefined;
    if (typeof labels?.fr !== "string" || labels.fr.trim() === "") {
      return problem(422, "Définition invalide", [{ field: "/labels/fr", code: "REQUIRED" }]);
    }
    draft.definition = update.definition;
    draft.revision += 1;
    return HttpResponse.json(editorOf(type, draft), {
      headers: { ETag: etagOf(type, draft) },
    });
  }

  private create(body: Schemas["NewType"]) {
    if (this.find(body.code)) return problem(409, "Ce code existe déjà");
    const parcours = body.referentParcours ?? this.session.parcours[0] ?? "";
    if (!this.session.parcours.includes(parcours)) return problem(403, "Accès refusé");
    const type: MockType = {
      code: body.code,
      family: null,
      ownerParcours: parcours,
      referentParcours: parcours,
      versions: [blankDraft(1, body.definition)],
    };
    this.types.push(type);
    return HttpResponse.json(editorOf(type, type.versions[0] as MockVersion), {
      status: 201,
    });
  }

  private newVersion(code: string) {
    const type = this.find(code);
    const current = type && latest(type);
    if (!type || !current) return notFound();
    if (current.status === "BROUILLON" || current.status === "SOUMIS") {
      return problem(409, "Un brouillon est déjà en cours");
    }
    const draft = blankDraft(current.version + 1, current.definition);
    type.versions.unshift(draft);
    return HttpResponse.json(editorOf(type, draft), { status: 201 });
  }

  private submit(code: string, ifMatch: string | null) {
    const type = this.find(code);
    const draft = type && latest(type);
    if (!type || !draft) return notFound();
    if (ifMatch !== etagOf(type, draft)) return problem(412, "Version modifiée entre-temps");
    const errors = REQUIRED_FOR_SUBMISSION.filter((key) => !(key in draft.definition)).map(
      (key) => ({ field: `/${key}`, code: "REQUIRED" }),
    );
    if (errors.length > 0) return problem(422, "Contrôles en échec", errors);
    draft.status = "SOUMIS";
    draft.submittedBy = this.session.user;
    draft.revision += 1;
    return HttpResponse.json(editorOf(type, draft));
  }

  private find(code: string): MockType | undefined {
    return this.types.find((t) => t.code === code);
  }
}

function latest(type: MockType): MockVersion {
  return type.versions[0] as MockVersion;
}

function label(type: MockType): string | undefined {
  const labels = latest(type).definition["labels"] as { fr?: string } | undefined;
  return labels?.fr;
}

function summary(type: MockType): Schemas["TypeSummary"] {
  const { version, status, effectiveFrom, submittedBy, reviewedBy } = latest(type);
  return {
    code: type.code,
    label: label(type) ?? null,
    family: type.family,
    ownerParcours: type.ownerParcours,
    referentParcours: type.referentParcours,
    latest: { version, status, effectiveFrom, submittedBy, reviewedBy },
  };
}

function etagOf(type: MockType, version: MockVersion): string {
  return `"${type.code}-${String(version.version)}-${String(version.revision)}"`;
}

function editorOf(type: MockType, version: MockVersion): Schemas["Editor"] {
  return {
    code: type.code,
    version: version.version,
    status: version.status,
    etag: etagOf(type, version),
    reviewReason: version.reviewReason,
    definition: version.definition,
  };
}

function blankDraft(version: number, definition: Definition): MockVersion {
  return {
    version,
    status: "BROUILLON",
    effectiveFrom: null,
    submittedBy: null,
    reviewedBy: null,
    reviewReason: null,
    definition: structuredClone(definition),
    revision: 0,
  };
}

function notFound() {
  return problem(404, "Type inconnu");
}

function problem(status: number, title: string, errors?: { field: string; code: string }[]) {
  return HttpResponse.json(
    {
      type: "about:blank",
      title,
      status,
      correlationId: CORRELATION["X-Correlation-Id"],
      errors,
    },
    {
      status,
      headers: { "Content-Type": "application/problem+json", ...CORRELATION },
    },
  );
}
