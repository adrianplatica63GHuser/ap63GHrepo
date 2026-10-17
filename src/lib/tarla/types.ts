/**
 * The shapes the tarla pages and their routes share — client-safe (no database import).        (Slice #39.67)
 */

export type TarlaListItem = {
  id: string;
  indicativ: string;
  locality: string | null;
  county: string | null;
  descriere: string | null;
  origin: "MANUAL" | "IMPORT";
  propertyCount: number;
  cornerCount: number;
};

export type TarlaCornerItem = { lat: number; lon: number; originalIndex: number | null };

export type TarlaFull = Omit<TarlaListItem, "cornerCount"> & {
  notes: string | null;
  corners: TarlaCornerItem[];
  /** A Date on the server, an ISO string once it has crossed JSON. */
  updatedAt: Date | string;
};

export type TarlaPropertyItem = {
  id: string;
  code: string;
  nickname: string | null;
  parcela: string | null;
  typeName: string | null;
  locality: string | null;
};

export type TarlaDocumentItem = {
  id: string;
  code: string;
  title: string | null;
  typeName: string | null;
  /** The codes of this tarla's properties the document is linked to. */
  propertyCodes: string[];
};

export type TarlaUpdate = {
  indicativ: string;
  locality?: string | null;
  county?: string | null;
  descriere?: string | null;
  notes?: string | null;
  corners?: { lat: number; lon: number; originalIndex?: number | null }[];
};
