import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/http/ApiError";
import { apiFetch, toApiError } from "@/http/apiFetch";
import { CSRF_HEADER, csrfMiddleware, isUnsafeMethod, readCsrfToken } from "@/http/csrf";

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

function mockFetch(response: Response | Error | DOMException) {
  const fetchMock = vi.fn<typeof fetch>(() =>
    response instanceof Response ? Promise.resolve(response) : Promise.reject(response),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function sentHeaders(fetchMock: ReturnType<typeof mockFetch>): Headers {
  const init = fetchMock.mock.calls[0]?.[1] ?? {};
  return new Headers(init.headers);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("CSRF", () => {
  it("reads the token from the XSRF-TOKEN cookie", () => {
    expect(readCsrfToken("a=1; XSRF-TOKEN=abc%3D%3D; b=2")).toBe("abc==");
    expect(readCsrfToken("a=1")).toBeUndefined();
  });

  it("treats only GET, HEAD, OPTIONS and TRACE as safe", () => {
    expect(["GET", "head", "OPTIONS", "TRACE"].map(isUnsafeMethod)).toEqual([
      false,
      false,
      false,
      false,
    ]);
    expect(["POST", "PUT", "PATCH", "delete"].every(isUnsafeMethod)).toBe(true);
  });

  it("middleware adds the token to unsafe requests only", () => {
    document.cookie = "XSRF-TOKEN=token-1";
    const post = csrfMiddleware.onRequest({
      request: new Request("http://localhost/api/x", { method: "POST" }),
    });
    const get = csrfMiddleware.onRequest({ request: new Request("http://localhost/api/x") });
    expect(post.headers.get(CSRF_HEADER)).toBe("token-1");
    expect(get.headers.get(CSRF_HEADER)).toBeNull();
  });
});

describe("apiFetch", () => {
  it("sends JSON with session cookie and CSRF token on POST", async () => {
    document.cookie = "XSRF-TOKEN=token-2";
    const fetchMock = mockFetch(jsonResponse(201, { id: "d-1" }));
    const result = await apiFetch<{ id: string }>("/api/documents", {
      method: "post",
      body: { title: "CIN" },
    });
    expect(result).toEqual({ id: "d-1" });
    const init = fetchMock.mock.calls[0]?.[1] ?? {};
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("same-origin");
    expect(init.body).toBe('{"title":"CIN"}');
    expect(sentHeaders(fetchMock).get(CSRF_HEADER)).toBe("token-2");
    expect(sentHeaders(fetchMock).get("Content-Type")).toBe("application/json");
  });

  it("does not send the CSRF token on GET", async () => {
    document.cookie = "XSRF-TOKEN=token-3";
    const fetchMock = mockFetch(jsonResponse(200, []));
    await apiFetch("/api/documents");
    expect(sentHeaders(fetchMock).get(CSRF_HEADER)).toBeNull();
    expect(sentHeaders(fetchMock).get("Content-Type")).toBeNull();
  });

  it("returns undefined on 204", async () => {
    mockFetch(new Response(null, { status: 204 }));
    await expect(apiFetch("/api/documents/1", { method: "DELETE" })).resolves.toBeUndefined();
  });

  it("reports an unreadable success body as an ApiError", async () => {
    mockFetch(
      new Response("<html>proxy</html>", {
        status: 200,
        headers: { "Content-Type": "text/html", "X-Correlation-Id": "c1f6-0004" },
      }),
    );
    const error = (await apiFetch("/api/x").catch((e: unknown) => e)) as ApiError;
    expect(error).toBeInstanceOf(ApiError);
    expect(error.correlationId).toBe("c1f6-0004");
    expect(error.message).toBe("Une erreur inattendue est survenue.");
  });

  it("converts Problem Details into ApiError with field errors", async () => {
    mockFetch(
      jsonResponse(400, {
        type: "https://docs.awb/errors/validation",
        detail: "Un ou plusieurs champs sont invalides.",
        correlationId: "c1f6-0002",
        errors: [
          { field: "title", code: "NOT_BLANK" },
          { field: "title", code: "SIZE" },
        ],
      }),
    );
    const error = await apiFetch("/api/x").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    const apiError = error as ApiError;
    expect(apiError.status).toBe(400);
    expect(apiError.message).toBe("Un ou plusieurs champs sont invalides.");
    expect(apiError.correlationId).toBe("c1f6-0002");
    expect(apiError.type).toBe("https://docs.awb/errors/validation");
    expect(apiError.errorsByField()).toEqual({ title: ["NOT_BLANK", "SIZE"] });
  });

  it("falls back to the correlation header and a generic message", async () => {
    mockFetch(
      new Response("<html>bad gateway</html>", {
        status: 502,
        headers: { "Content-Type": "text/html", "X-Correlation-Id": "c1f6-0003" },
      }),
    );
    const error = (await apiFetch("/api/x").catch((e: unknown) => e)) as ApiError;
    expect(error.status).toBe(502);
    expect(error.correlationId).toBe("c1f6-0003");
    expect(error.message).toBe("Une erreur inattendue est survenue.");
    expect(error.fieldErrors).toEqual([]);
  });

  it("survives a malformed JSON error body", async () => {
    const response = new Response("{oops", {
      status: 500,
      headers: { "Content-Type": "application/problem+json" },
    });
    const error = await toApiError(response);
    expect(error.status).toBe(500);
    expect(error.message).toBe("Une erreur inattendue est survenue.");
  });

  it("reports network failures as status 0", async () => {
    mockFetch(new TypeError("Failed to fetch"));
    const error = (await apiFetch("/api/x").catch((e: unknown) => e)) as ApiError;
    expect(error.status).toBe(0);
    expect(error.message).toContain("injoignable");
  });

  it("lets aborts propagate", async () => {
    mockFetch(new DOMException("aborted", "AbortError"));
    const controller = new AbortController();
    await expect(apiFetch("/api/x", { signal: controller.signal })).rejects.toHaveProperty(
      "name",
      "AbortError",
    );
  });

  it("passes custom headers", async () => {
    const fetchMock = mockFetch(jsonResponse(200, {}));
    await apiFetch("/api/x", { headers: { "X-Parcours": "credit-immo" } });
    expect(sentHeaders(fetchMock).get("X-Parcours")).toBe("credit-immo");
  });
});
