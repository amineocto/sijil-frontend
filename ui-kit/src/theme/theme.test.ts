// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("./theme.css", import.meta.url), "utf8");

function token(name: string): string {
  const match = new RegExp(`--sijil-color-${name}:\\s*(#[0-9a-fA-F]{6})`).exec(css);
  if (!match?.[1]) throw new Error(`jeton absent : ${name}`);
  return match[1];
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const channel = parseInt(hex.slice(i, i + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Rapport de contraste WCAG 2.1 entre deux couleurs. */
function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(token(a)), luminance(token(b))].sort((x, y) => y - x) as [
    number,
    number,
  ];
  return (light + 0.05) / (dark + 0.05);
}

describe("thème", () => {
  it.each([
    ["text", "background"],
    ["text", "surface"],
    ["text", "danger-surface"],
    ["text-muted", "background"],
    ["text-muted", "surface"],
    ["primary-text", "primary"],
    ["danger", "danger-surface"],
  ])("le texte %s sur %s atteint 4,5:1 (SC 1.4.3)", (text, background) => {
    expect(contrast(text, background)).toBeGreaterThanOrEqual(4.5);
  });

  it.each([["background"], ["surface"], ["danger-surface"]])(
    "l'anneau de focus sur %s atteint 3:1 (SC 1.4.11)",
    (background) => {
      expect(contrast("focus", background)).toBeGreaterThanOrEqual(3);
    },
  );
});
