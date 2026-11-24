import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { withoutEmbeddedFonts } from "@/app/theme";

describe("feuille de style d'@awb/ui", () => {
  const css = readFileSync(createRequire(import.meta.url).resolve("@awb/ui/styles.css"), "utf8");

  it("ne garde aucune police embarquée, que la CSP refuserait", () => {
    expect(css).toContain("url(data:font");
    expect(withoutEmbeddedFonts(css)).not.toContain("url(data:font");
  });

  it("garde le reste de la charte", () => {
    expect(withoutEmbeddedFonts(css)).toContain(".bg-orange-500");
  });

  it("refuse une police embarquée qu'elle ne saurait pas retirer", () => {
    expect(() =>
      withoutEmbeddedFonts("@font-face { src: url(data:font/woff2;base64,AA) }"),
    ).toThrow(/police embarquée/);
  });
});
