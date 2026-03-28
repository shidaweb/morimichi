import type { ProSpecialty } from "@/types/database";

const SET = new Set<ProSpecialty>([
  "restructuring",
  "lawyer",
  "accountant",
  "sponsor",
  "fund",
  "other_expert",
]);

export function isProSpecialty(v: unknown): v is ProSpecialty {
  return typeof v === "string" && SET.has(v as ProSpecialty);
}
