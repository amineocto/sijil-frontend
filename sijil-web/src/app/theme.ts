import type { Plugin } from "vite";

/** Feuille de style compilée d'`@awb/ui`, qui embarque ses polices en `data:`. */
export const AWB_STYLESHEET = "@awb/ui/dist/style.css";

const EMBEDDED_FONT = /@font-face\{[^}]*url\(data:font\/[^}]*\}/g;

/**
 * Retire les polices embarquées de la feuille d'`@awb/ui` : la CSP du BFF (`font-src 'self'`) les
 * refuserait, et elles pèsent 300 Ko compressés dans le bundle initial. Inter est servie en fichiers
 * par `@fontsource-variable/inter`, avec ses plages Unicode.
 */
export function withoutEmbeddedFonts(css: string): string {
  const stripped = css.replace(EMBEDDED_FONT, "");
  if (stripped.includes("url(data:font")) {
    throw new Error("police embarquée restante dans la feuille d'@awb/ui");
  }
  return stripped;
}

export function awbStylesheetFonts(): Plugin {
  return {
    name: "sijil-awb-polices",
    enforce: "pre",
    transform(code, id) {
      return id.split("?")[0]?.endsWith(AWB_STYLESHEET) ? withoutEmbeddedFonts(code) : null;
    },
  };
}
