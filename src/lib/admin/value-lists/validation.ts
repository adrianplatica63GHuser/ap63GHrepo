/**
 * Zod input schemas for the Value Lists API.
 * One schema per list (create = update shape; all payload fields required
 * or optional as the domain dictates; sortOrder always optional).
 */

import { z } from "zod/v4";
import type { ListKey } from "./config";

// ── Leaf schemas ─────────────────────────────────────────────────────────────

const sortOrder = z.coerce.number().int().min(0).default(0);

export const propertyTypeSchema = z.object({
  name:      z.string().min(1, "required"),
  sortOrder,
});

export const tarlaSchema = z.object({
  indicativ: z.string().min(1, "required"),
  descriere: z.string().nullish(),
  sortOrder,
});

export const useCategorySchema = z.object({
  name:      z.string().min(1, "required"),
  sortOrder,
});

export const personTypeSchema = z.object({
  name:      z.string().min(1, "required"),
  sortOrder,
});

export const citizenshipSchema = z.object({
  name:      z.string().min(1, "required"),
  sortOrder,
});

export const documentTypeSchema = z.object({
  name:      z.string().min(1, "required"),
  sortOrder,
});

export const institutionSchema = z.object({
  name:            z.string().min(1, "required"),
  institutionType: z.string().nullish(),
  sortOrder,
});

export const serviceInterestSchema = z.object({
  name:      z.string().min(1, "required"),
  category:  z.string().nullish(),
  sortOrder,
});

// ── Dispatch map ─────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const LIST_SCHEMAS: Record<ListKey, z.ZodType<any>> = {
  "property-types":   propertyTypeSchema,
  "tarla":            tarlaSchema,
  "use-categories":   useCategorySchema,
  "person-types":     personTypeSchema,
  "citizenships":     citizenshipSchema,
  "document-types":   documentTypeSchema,
  "institutions":     institutionSchema,
  "service-interests": serviceInterestSchema,
};
