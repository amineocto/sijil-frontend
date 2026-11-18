import { describe, expect, it } from "vitest";
import { applyLanguage, directionOf } from "@/theme/direction";

describe("direction", () => {
  it("is right-to-left for Arabic", () => {
    expect(directionOf("ar")).toBe("rtl");
    expect(directionOf("ar-MA")).toBe("rtl");
    expect(directionOf("fr")).toBe("ltr");
    expect(directionOf("en-US")).toBe("ltr");
    expect(directionOf("")).toBe("ltr");
  });

  it("applies language and direction to the document", () => {
    applyLanguage("ar-MA");
    expect(document.documentElement.lang).toBe("ar-MA");
    expect(document.documentElement.dir).toBe("rtl");
    applyLanguage("fr");
    expect(document.documentElement.dir).toBe("ltr");
  });
});
