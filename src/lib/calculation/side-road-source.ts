/**
 * „Calcul drum lateral" — what a request names, read from the archive              (Slice #39.79)
 *
 * The screen sends ids and what was typed — the property, each owner's person and share, the road's width — and the
 * server reads the rest from the database: the property's corners (converted from the stored WGS84 to Stereo 70, in
 * which the geometry works, rounded to the millimetre a cadastral file writes) and each person's name. A re-run
 * (`rerunOf`) takes the corners its run stored instead, so it cuts the same parcel even if the property's corners
 * have changed since (Ask first 6). Then `checkSideRoadInput` decides, exactly as on the screen.
 */

import { asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { calculationRun, person, property, propertyCorner } from "@/db/schema";
import { wgs84ToStereo70 } from "@/lib/geo/transdatRO";
import {
  checkSideRoadInput,
  cornerLabels,
  InputRejected,
  type InputCorner,
  type SideRoadInput,
} from "./side-road-input";

/** A request the route cannot act on — 400 with its words; the screen never sends one. */
export class SideRoadRequestInvalid extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SideRoadRequestInvalid";
  }
}

/** What the run keeps of the property and its owners — `inputParams` beside the order, the road and the options. */
export type SideRoadSource = {
  source: "property";
  propertyId: string;
  /** Kept so the history names the property even after it is deleted. */
  propertyCode: string;
  /** The corners the parcel was cut from, as they were then. */
  corners: InputCorner[];
  /** In entry order — which is also each owner's colour; the code and the kind for the re-run's screen. */
  owners: { personId: string; name: string; code: string; type: "NATURAL" | "JUDICIAL"; share: number }[];
  width: number;
};

const round3 = (n: number) => Math.round(n * 1000) / 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The property and its corners as the calculation reads them, or null when there is no such property. */
export async function loadPropertyForCalculation(
  propertyId: string,
): Promise<{ id: string; code: string; nickname: string | null; corners: InputCorner[] } | null> {
  if (!UUID.test(propertyId)) return null;
  const [p] = await db
    .select({ id: property.id, code: property.code, nickname: property.nickname })
    .from(property)
    .where(eq(property.id, propertyId));
  if (!p) return null;
  const rows = await db
    .select({ sequenceNo: propertyCorner.sequenceNo, lat: propertyCorner.lat, lon: propertyCorner.lon, originalIndex: propertyCorner.originalIndex })
    .from(propertyCorner)
    .where(eq(propertyCorner.propertyId, propertyId))
    .orderBy(asc(propertyCorner.sequenceNo));
  const labels = cornerLabels(rows);
  const corners = rows.map((r, i) => {
    const s = wgs84ToStereo70(r.lat, r.lon);
    return { number: labels[i]!, north: round3(s.north), east: round3(s.east) };
  });
  return { ...p, corners };
}

/** The stored corners of a property-made run, for its re-run. */
async function storedCornersOfRun(runId: string): Promise<{ propertyId: string; propertyCode: string; corners: InputCorner[] }> {
  const [run] = await db.select({ inputParams: calculationRun.inputParams }).from(calculationRun).where(eq(calculationRun.id, runId));
  const stored = run?.inputParams as Partial<SideRoadSource> | undefined;
  if (!stored || stored.source !== "property" || !Array.isArray(stored.corners) || typeof stored.propertyId !== "string") {
    throw new SideRoadRequestInvalid("That run cannot be re-run: it was not made from a property.");
  }
  return { propertyId: stored.propertyId, propertyCode: stored.propertyCode ?? "", corners: stored.corners };
}

type BodyOwner = { personId: string; share: string };

function readBody(body: unknown): { propertyId: string; owners: BodyOwner[]; width: string; rerunOf: string | null } {
  const b = (body ?? {}) as Record<string, unknown>;
  if (typeof b.propertyId !== "string" || b.propertyId.length === 0) throw new SideRoadRequestInvalid("A property is required");
  if (!Array.isArray(b.owners)) throw new SideRoadRequestInvalid("The owners are required");
  const owners = b.owners.map((o) => {
    const x = (o ?? {}) as Record<string, unknown>;
    if (typeof x.personId !== "string" || typeof x.share !== "string") throw new SideRoadRequestInvalid("Each owner needs a person and a share");
    return { personId: x.personId, share: x.share };
  });
  if (typeof b.width !== "string") throw new SideRoadRequestInvalid("The road's width is required");
  const rerunOf = typeof b.rerunOf === "string" && b.rerunOf.length > 0 ? b.rerunOf : null;
  return { propertyId: b.propertyId, owners, width: b.width, rerunOf };
}

/**
 * Read the body, the property (or the re-run's stored corners) and the persons; check; and return the input the
 * computation cuts, with what the run will keep. Throws `InputRejected` with every problem, or
 * `SideRoadRequestInvalid` for a body that is not one (an unknown property or person included).
 */
export async function resolveSideRoadRequest(body: unknown): Promise<{ input: SideRoadInput; source: SideRoadSource }> {
  const req = readBody(body);
  const found = await loadPropertyForCalculation(req.propertyId);
  let corners: InputCorner[];
  let propertyCode: string;
  if (req.rerunOf && !UUID.test(req.rerunOf)) throw new SideRoadRequestInvalid("That run cannot be re-run");
  if (req.rerunOf) {
    const stored = await storedCornersOfRun(req.rerunOf);
    if (stored.propertyId !== req.propertyId) throw new SideRoadRequestInvalid("The re-run names another property");
    corners = stored.corners;
    propertyCode = found?.code ?? stored.propertyCode;
  } else {
    if (!found) throw new SideRoadRequestInvalid("No such property");
    corners = found.corners;
    propertyCode = found.code;
  }

  const ids = [...new Set(req.owners.map((o) => o.personId))];
  if (ids.some((id) => !UUID.test(id))) throw new SideRoadRequestInvalid("An owner is not a person id");
  const people =
    ids.length === 0
      ? []
      : await db.select({ id: person.id, name: person.displayName, code: person.code, type: person.type }).from(person).where(inArray(person.id, ids));
  const people0 = new Map(people.map((p) => [p.id, p]));
  const missing = ids.filter((id) => !people0.has(id));
  if (missing.length > 0) throw new SideRoadRequestInvalid(`No such person: ${missing.join(", ")}`);

  const checked = checkSideRoadInput({
    corners,
    owners: req.owners.map((o) => ({ personId: o.personId, name: people0.get(o.personId)!.name, share: o.share })),
    width: req.width,
  });
  if (!checked.ok) throw new InputRejected(checked.problems);
  const { input } = checked;
  return {
    input,
    source: {
      source: "property",
      propertyId: req.propertyId,
      propertyCode,
      corners: input.corners,
      owners: input.owners.map((o) => {
        const p = people0.get(o.personId)!;
        return { personId: o.personId, name: o.name, code: p.code, type: p.type, share: o.percent };
      }),
      width: input.roadWidth,
    },
  };
}
