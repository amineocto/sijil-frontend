import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { inAwbLayer, withoutEmbeddedFonts } from "@/app/theme";

describe("feuille de style d'@awb/ui", () => {
  const css = readFileSync(createRequire(import.meta.url).resolve("@awb/ui/styles.css"), "utf8");

  it("ne garde aucune police embarquée, que la CSP refuserait", () => {
    expect(css).toContain("url(data:font");
    expect(withoutEmbeddedFonts(css)).not.toContain("url(data:font");
  });

  it("garde le reste de la charte", () => {
    expect(withoutEmbeddedFonts(css)).toContain(".bg-orange-500");
  });

  it("se range dans la couche awb, que les utilitaires de Sijil peuvent surcharger", () => {
    const layered = inAwbLayer(withoutEmbeddedFonts(css));
    expect(layered.startsWith("@layer awb{")).toBe(true);
    expect(layered.endsWith("}")).toBe(true);
    const appCss = readFileSync(`${process.cwd()}/src/app/app.css`, "utf8");
    expect(appCss).toContain("@layer theme, base, awb, components, utilities;");
    expect(appCss.indexOf("@layer theme, base, awb")).toBeLessThan(
      appCss.indexOf('@import "tailwindcss"'),
    );
  });

  it("refuse une police embarquée qu'elle ne saurait pas retirer", () => {
    expect(() =>
      withoutEmbeddedFonts("@font-face { src: url(data:font/woff2;base64,AA) }"),
    ).toThrow(/police embarquée/);
  });
});
