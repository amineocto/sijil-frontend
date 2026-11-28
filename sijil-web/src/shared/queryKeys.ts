export const queryKeys = {
  catalogueType: (code: string) => ["catalogue-type", code] as const,
  publishedType: (code: string) => ["published-type", code] as const,
  publishedTypes: ["published-types"] as const,
};
