import {
  createTheme,
  defaultVariantColorsResolver,
  type VariantColorsResolver,
} from "@mantine/core";

/**
 * Variante « light » (badges de statut, alertes) : texte dans la couleur du texte, la teinte restant
 * portée par le fond. Les teintes de Mantine sur leur fond clair (vert 3,8:1, orange 3,6:1)
 * n'atteignent pas 4,5:1 (SC 1.4.3, mesuré par axe dans le scénario Playwright).
 */
export const readableLightVariant: VariantColorsResolver = (input) => {
  const colors = defaultVariantColorsResolver(input);
  return input.variant === "light" ? { ...colors, color: "var(--mantine-color-text)" } : colors;
};

/** Thème Mantine aligné sur les jetons de `@sijil/ui-kit` (couleur primaire, police, rayon). */
export const theme = createTheme({
  primaryColor: "sijil",
  colors: {
    sijil: [
      "#e7f0fa",
      "#c5daf2",
      "#9fc1e9",
      "#76a6df",
      "#4f8bd4",
      "#2a71c3",
      "#0b5cad",
      "#094d91",
      "#073e75",
      "#052f59",
    ],
  },
  primaryShade: 6,
  fontFamily: 'system-ui, "Segoe UI", "Noto Sans", "Noto Sans Arabic", sans-serif',
  defaultRadius: "sm",
  variantColorResolver: readableLightVariant,
});
