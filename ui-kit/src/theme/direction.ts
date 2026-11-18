const RTL_LANGUAGES = new Set(["ar", "he", "fa", "ur"]);

/** Sens d'écriture d'une langue BCP 47 : `ar`, `ar-MA` → rtl ; `fr` → ltr. */
export function directionOf(language: string): "ltr" | "rtl" {
  const primary = language.split("-")[0]?.toLowerCase() ?? "";
  return RTL_LANGUAGES.has(primary) ? "rtl" : "ltr";
}

/** Applique la langue et le sens d'écriture au document. */
export function applyLanguage(language: string, root: HTMLElement = document.documentElement) {
  root.lang = language;
  root.dir = directionOf(language);
}
