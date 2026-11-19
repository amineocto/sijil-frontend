import { createTheme } from "@mantine/core";

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
});
