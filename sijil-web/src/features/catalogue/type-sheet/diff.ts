import type { Definition } from "@/shared/api";

export interface RubriqueChange {
  key: string;
  before: unknown;
  after: unknown;
}

/** Rubriques de premier niveau qui diffèrent entre deux définitions, dans l'ordre alphabétique. */
export function diffDefinitions(before: Definition, after: Definition): RubriqueChange[] {
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  return keys
    .filter((key) => canonical(before[key]) !== canonical(after[key]))
    .map((key) => ({ key, before: before[key], after: after[key] }));
}

/** JSON à clés triées, pour comparer sans dépendre de l'ordre des clés. */
export function canonical(value: unknown): string {
  if (value === undefined) return "undefined";
  return JSON.stringify(value, (_key, v: unknown) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(
          Object.entries(v as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)),
        )
      : v,
  );
}
