export const baseRelationTypes = [
  "depends_on",
  "used_by",
  "dispatches_to",
  "reads_from",
  "writes_to",
  "validates",
  "renders",
  "generates",
  "guards",
  "adapts",
  "tests",
  "related_to"
] as const;

export type BaseRelationType = typeof baseRelationTypes[number];

export function isBaseRelationType(value: string): value is BaseRelationType {
  return (baseRelationTypes as readonly string[]).includes(value);
}
