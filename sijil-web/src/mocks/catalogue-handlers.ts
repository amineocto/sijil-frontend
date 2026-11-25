import { http, HttpResponse } from "msw";
import type { Definition, Schemas } from "@/shared/api";
import {
  initialRequirementSets,
  initialSharing,
  initialTerms,
  PARCOURS,
  REQUIRED_FOR_SUBMISSION,
  SESSION,
  initialTypes,
  type MockType,
  type MockVersion,
} from "@/mocks/catalogue-data";

const PAGE_SIZE = 20;
const CORRELATION = { "X-Correlation-Id": "demo-correlation-id" };

/** Bouchon des écrans du catalogue de `sijil-bff` (`contracts/sijil-bff.yaml`, ADR 0032). */
export class CatalogueStub {
  types: MockType[] = initialTypes();
  session: Schemas["Session"] = SESSION;

  requirementSets: Schemas["RequirementSet"][] = initialRequirementSets();
  sharing: Schemas["TypeSharing"][] = initialSharing();
  terms: Schemas["MetadataTerm"][] = initialTerms();

  reset() {
    this.types = initialTypes();
    this.session = SESSION;
    this.requirementSets = initialRequirementSets();
    this.sharing = initialSharing();
    this.terms = initialTerms();
  }

  handlers() {
    return [
      http.get("/api/parcours", () => HttpResponse.json(PARCOURS)),
      ...this.requirementHandlers(),
      ...this.sharingHandlers(),
      ...this.dictionaryHandlers(),
      http.get("/api/types", ({ request }) => this.list(new URL(request.url).searchParams)),
      http.post("/api/types", async ({ request }) =>
        this.createType((await request.json()) as Schemas["NewType"]),
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
      http.post("/api/types/:code/reuses", async ({ params, request }) =>
        this.reuse(String(params["code"]), (await request.json()) as Schemas["NewReuse"]),
      ),
      http.get("/api/reviews", () => this.reviews()),
      http.get("/api/types/:code/versions/:version", ({ params }) =>
        this.version(String(params["code"]), Number(params["version"])),
      ),
      http.post("/api/types/:code/versions/:version/review", async ({ params, request }) =>
        this.review(
          String(params["code"]),
          Number(params["version"]),
          request.headers.get("If-Match"),
          (await request.json()) as Schemas["Review"],
        ),
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
    const type = this.findType(code);
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
      reuses: type.reuses,
    });
  }

  private reuse(code: string, body: Schemas["NewReuse"]) {
    const type = this.findType(code);
    if (!type) return notFound();
    const parcours = this.session.parcours[0];
    if (!parcours || !this.session.roles.includes("catalogue-contributeur")) {
      return problem(403, "Accès refusé");
    }
    if (type.ownerParcours === parcours) return problem(422, "Type de votre parcours");
    if (type.reuses.some((r) => r.parcours === parcours)) {
      return problem(409, "Ce parcours réutilise déjà ce type");
    }
    const reuse: Schemas["Reuse"] = {
      parcours,
      purpose: body.purpose,
      declaredBy: this.session.user,
      declaredAt: new Date().toISOString(),
    };
    type.reuses.push(reuse);
    return HttpResponse.json(reuse, { status: 201 });
  }

  private reviews() {
    const items = this.types.filter((t) => latest(t).status === "EN_REVUE").map(summary);
    return HttpResponse.json<Schemas["TypePage"]>({ items, hasMore: false, nextCursor: null });
  }

  private version(code: string, number: number) {
    const type = this.findType(code);
    const version = type?.versions.find((v) => v.version === number);
    if (!type || !version) return notFound();
    return HttpResponse.json(editorOf(type, version));
  }

  private review(code: string, number: number, ifMatch: string | null, body: Schemas["Review"]) {
    const type = this.findType(code);
    const version = type?.versions.find((v) => v.version === number);
    if (!type || !version) return notFound();
    if (!this.session.roles.includes("catalogue-reviseur")) return problem(403, "Accès refusé");
    if (version.submittedBy === this.session.user) {
      return problem(403, "Vous ne pouvez pas revoir une version que vous avez soumise");
    }
    if (version.status !== "EN_REVUE") return problem(409, "Version qui n'est plus en revue");
    if (ifMatch !== etagOf(type, version)) return problem(412, "Version modifiée entre-temps");
    if (body.decision === "APPROVE") {
      version.status = "PUBLIE";
      version.effectiveFrom = body.effectiveFrom ?? null;
    } else {
      version.status = "BROUILLON";
      version.reviewReason = body.reason ?? null;
    }
    version.reviewedBy = this.session.user;
    version.revision += 1;
    return HttpResponse.json(editorOf(type, version));
  }

  private editor(code: string) {
    const type = this.findType(code);
    const draft = type && latest(type);
    if (!type || !draft) return notFound();
    return HttpResponse.json(editorOf(type, draft));
  }

  private save(code: string, ifMatch: string | null, update: Schemas["DraftUpdate"]) {
    const type = this.findType(code);
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

  /** Partage 360 (ADR 0025) : administrateur du domaine, pour son seul parcours. */
  /** Dictionnaire (ADR 0038) : lecture pour tous, écriture par le Data Office. */
  private dictionaryHandlers() {
    const dataOffice = () => this.session.roles.includes("catalogue-data-office");
    const forbidden = () =>
      HttpResponse.json(
        { status: 403, title: "Accès refusé", detail: "Rôle catalogue-data-office requis." },
        { status: 403, headers: CORRELATION },
      );
    const withEtag = (t: Schemas["MetadataTerm"]) => ({ ...t, etag: `"${String(t.revision)}"` });
    return [
      http.get("/api/metadata-terms", () =>
        HttpResponse.json([...this.terms].sort((a, b) => a.code.localeCompare(b.code))),
      ),
      http.get("/api/metadata-terms/:code", ({ params }) => {
        const found = this.terms.find((t) => t.code === params["code"]);
        return found
          ? HttpResponse.json(withEtag(found))
          : HttpResponse.json({ status: 404, title: "Terme inconnu" }, { status: 404 });
      }),
      http.post("/api/metadata-terms", async ({ request }) => {
        if (!dataOffice()) return forbidden();
        const body = (await request.json()) as Schemas["NewMetadataTerm"];
        if (this.terms.some((t) => t.code === body.code)) {
          return HttpResponse.json(
            { status: 409, title: "Conflit", detail: `Le terme ${body.code} existe déjà.` },
            { status: 409, headers: CORRELATION },
          );
        }
        const created: Schemas["MetadataTerm"] = {
          labelAr: null,
          labelEn: null,
          definition: null,
          maxLength: null,
          pattern: null,
          minimum: null,
          maximum: null,
          filenetProperty: null,
          values: [],
          ...body,
          status: "ACTIF",
          revision: 0,
          updatedBy: this.session.user,
          updatedAt: new Date().toISOString(),
        };
        this.terms.push(created);
        return HttpResponse.json(withEtag(created), { status: 201 });
      }),
      http.put("/api/metadata-terms/:code", async ({ params, request }) => {
        if (!dataOffice()) return forbidden();
        const index = this.terms.findIndex((t) => t.code === params["code"]);
        const current = this.terms[index];
        if (!current) return HttpResponse.json({ status: 404, title: "Inconnu" }, { status: 404 });
        if (request.headers.get("If-Match") !== `"${String(current.revision)}"`) {
          return HttpResponse.json(
            { status: 412, title: "Modifié entre-temps", detail: "Rechargez le terme." },
            { status: 412, headers: CORRELATION },
          );
        }
        const body = (await request.json()) as Schemas["MetadataTermUpdate"];
        const changed: Schemas["MetadataTerm"] = {
          ...current,
          labelAr: null,
          labelEn: null,
          definition: null,
          maxLength: null,
          pattern: null,
          minimum: null,
          maximum: null,
          filenetProperty: null,
          values: [],
          ...body,
          revision: current.revision + 1,
          updatedBy: this.session.user,
          updatedAt: new Date().toISOString(),
        };
        this.terms[index] = changed;
        return HttpResponse.json(withEtag(changed));
      }),
    ];
  }

  private sharingHandlers() {
    const allowed = (parcours: string) =>
      this.session.roles.includes("catalogue-admin-domaine") &&
      this.session.parcours.includes(parcours);
    return [
      http.get("/api/parcours/:parcours/sharing", ({ params }) =>
        allowed(String(params["parcours"]))
          ? HttpResponse.json({ items: this.sharing })
          : problem(403, "Accès refusé"),
      ),
      http.put("/api/parcours/:parcours/sharing/:code", async ({ params, request }) => {
        if (!allowed(String(params["parcours"]))) return problem(403, "Accès refusé");
        const index = this.sharing.findIndex((s) => s.typeCode === params["code"]);
        if (index < 0) return problem(404, "Type non éligible");
        const decision = (await request.json()) as Schemas["TypeSharingRequest"];
        const updated: Schemas["TypeSharing"] = {
          typeCode: String(params["code"]),
          shared: decision.shared,
          decidedBy: this.session.user,
          decidedAt: new Date().toISOString(),
          reason: decision.reason ?? null,
        };
        this.sharing[index] = updated;
        return HttpResponse.json(updated);
      }),
    ];
  }

  /** Jeux d'exigences (lot 7) : brouillon, révision par ETag, publication à quatre yeux. */
  private requirementHandlers() {
    const path = "/api/requirement-sets/:code/versions/:version";
    return [
      http.get("/api/requirement-sets", () =>
        HttpResponse.json(this.requirementSets.map((s) => ({ ...s, etag: null }))),
      ),
      http.get(path, ({ params }) => {
        const set = this.findSet(String(params["code"]), Number(params["version"]));
        return set ? HttpResponse.json(set) : problem(404, "Jeu d'exigences inconnu");
      }),
      http.post("/api/requirement-sets", async ({ request }) => {
        const body = (await request.json()) as {
          code: string;
          definition: Schemas["RequirementSetDefinition"];
        };
        if (this.requirementSets.some((s) => s.code === body.code))
          return problem(409, "Ce jeu a déjà un brouillon");
        const set: Schemas["RequirementSet"] = {
          code: body.code,
          version: 1,
          parcours: this.session.parcours[0] ?? "eer",
          status: "BROUILLON",
          definition: body.definition,
          draftedBy: this.session.user,
          draftedAt: new Date().toISOString(),
          publishedBy: null,
          publishedAt: null,
          etag: '"1-0"',
        };
        this.requirementSets.push(set);
        return HttpResponse.json(set, { status: 201 });
      }),
      http.put(path, async ({ params, request }) => {
        const set = this.findSet(String(params["code"]), Number(params["version"]));
        if (!set) return problem(404, "Jeu d'exigences inconnu");
        if (request.headers.get("If-Match") !== set.etag)
          return problem(412, "Le jeu a changé depuis sa lecture");
        const body = (await request.json()) as { definition: Schemas["RequirementSetDefinition"] };
        set.definition = body.definition;
        set.etag = `"${String(set.version)}-${String(Number(set.etag?.split("-")[1]?.replace('"', "") ?? 0) + 1)}"`;
        return HttpResponse.json(set);
      }),
      http.post(`${path}/publication`, ({ params }) => {
        const set = this.findSet(String(params["code"]), Number(params["version"]));
        if (!set) return problem(404, "Jeu d'exigences inconnu");
        if (!this.session.roles.includes("catalogue-reviseur")) return problem(403, "Accès refusé");
        if (set.draftedBy === this.session.user)
          return problem(403, "Le réviseur d'un jeu d'exigences n'en est pas rédacteur.");
        set.status = "PUBLIE";
        set.publishedBy = this.session.user;
        set.publishedAt = new Date().toISOString();
        return HttpResponse.json(set);
      }),
    ];
  }

  private findSet(code: string, version: number) {
    return this.requirementSets.find((s) => s.code === code && s.version === version);
  }

  private createType(body: Schemas["NewType"]) {
    if (this.findType(body.code)) return problem(409, "Ce code existe déjà");
    const parcours = body.referentParcours ?? this.session.parcours[0] ?? "";
    if (!this.session.parcours.includes(parcours)) return problem(403, "Accès refusé");
    const type: MockType = {
      code: body.code,
      family: null,
      ownerParcours: parcours,
      referentParcours: parcours,
      versions: [blankDraft(1, body.definition)],
      reuses: [],
    };
    this.types.push(type);
    return HttpResponse.json(editorOf(type, type.versions[0] as MockVersion), {
      status: 201,
    });
  }

  private newVersion(code: string) {
    const type = this.findType(code);
    const current = type && latest(type);
    if (!type || !current) return notFound();
    if (["BROUILLON", "SOUMIS", "EN_REVUE"].includes(current.status)) {
      return problem(409, "Un brouillon est déjà en cours");
    }
    const draft = blankDraft(current.version + 1, current.definition);
    type.versions.unshift(draft);
    return HttpResponse.json(editorOf(type, draft), { status: 201 });
  }

  private submit(code: string, ifMatch: string | null) {
    const type = this.findType(code);
    const draft = type && latest(type);
    if (!type || !draft) return notFound();
    if (ifMatch !== etagOf(type, draft)) return problem(412, "Version modifiée entre-temps");
    const errors = REQUIRED_FOR_SUBMISSION.filter((key) => !(key in draft.definition)).map(
      (key) => ({ field: `/${key}`, code: "REQUIRED" }),
    );
    if (errors.length > 0) return problem(422, "Contrôles en échec", errors);
    // Comme le catalogue : contrôles réussis, la version passe directement EN_REVUE.
    draft.status = "EN_REVUE";
    draft.submittedBy = this.session.user;
    draft.revision += 1;
    return HttpResponse.json(editorOf(type, draft));
  }

  private findType(code: string): MockType | undefined {
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
