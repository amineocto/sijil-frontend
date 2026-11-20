import { http, HttpResponse } from "msw";
import { api, call, LOGIN_PATH, navigation } from "@/shared/api";
import { logout } from "@/shared/logout";
import { server } from "@/test/setup";

describe("Session du BFF", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("relance la connexion OIDC sur un 401", async () => {
    const assign = vi.spyOn(navigation, "assign").mockImplementation(() => undefined);
    server.use(http.get("/api/session", () => new HttpResponse(null, { status: 401 })));

    await expect(call(api.GET("/api/session"))).rejects.toThrow();

    expect(assign).toHaveBeenCalledWith(LOGIN_PATH);
    expect(LOGIN_PATH).toBe("/oauth2/authorization/sijil");
  });

  it("se déconnecte du BFF avec le jeton CSRF puis ouvre la déconnexion de l'IdP", async () => {
    document.cookie = "XSRF-TOKEN=jeton-csrf";
    let header: string | null = null;
    server.use(
      http.post("/logout", ({ request }) => {
        header = request.headers.get("X-XSRF-TOKEN");
        return HttpResponse.json({ redirectUrl: "https://idp/logout?post_logout=1" });
      }),
    );
    const assign = vi.spyOn(navigation, "assign").mockImplementation(() => undefined);

    await logout();

    expect(header).toBe("jeton-csrf");
    expect(assign).toHaveBeenCalledWith("https://idp/logout?post_logout=1");
  });

  it("revient à l'accueil si le BFF refuse la déconnexion", async () => {
    server.use(http.post("/logout", () => new HttpResponse(null, { status: 403 })));
    const assign = vi.spyOn(navigation, "assign").mockImplementation(() => undefined);
    await logout();
    expect(assign).toHaveBeenCalledWith("/");
  });

  it("navigue par l'adresse du navigateur", () => {
    const assign = vi.fn();
    vi.stubGlobal("location", { assign });
    navigation.assign("/x");
    vi.unstubAllGlobals();
    expect(assign).toHaveBeenCalledWith("/x");
  });
});
