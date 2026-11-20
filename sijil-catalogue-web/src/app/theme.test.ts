import { mergeMantineTheme, DEFAULT_THEME } from "@mantine/core";
import { readableLightVariant, theme } from "@/app/theme";

describe("thème", () => {
  const full = mergeMantineTheme(DEFAULT_THEME, theme);

  it("écrit la variante claire dans la couleur du texte, pour le contraste", () => {
    const light = readableLightVariant({ color: "green", variant: "light", theme: full });
    expect(light.color).toBe("var(--mantine-color-text)");
  });

  it("garde les autres variantes de Mantine", () => {
    const filled = readableLightVariant({ color: "green", variant: "filled", theme: full });
    expect(filled.color).not.toBe("var(--mantine-color-text)");
  });
});
