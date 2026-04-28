/**
 * POST /api/geo/convert
 *
 * Batch coordinate conversion between WGS84 (decimal degrees) and
 * Stereografic 1970 (Northing / Easting in metres).
 *
 * The TransDatRO grid interpolation runs server-side (reads a binary file
 * from disk), so this endpoint is required even for display-only conversions.
 * DMS ↔ Decimal Degrees is pure math and can be done client-side via the
 * helpers exported from @/lib/geo/transdatRO.
 *
 * Request body (JSON):
 *   {
 *     direction: "wgs84ToStereo70" | "stereo70ToWgs84",
 *     points: Array<{ lat: number; lon: number }>          // wgs84ToStereo70
 *           | Array<{ north: number; east: number }>       // stereo70ToWgs84
 *   }
 *
 * Response 200:
 *   {
 *     points: Array<{ north: number; east: number }>       // wgs84ToStereo70
 *           | Array<{ lat: number; lon: number }>          // stereo70ToWgs84
 *   }
 *
 * Response 400: validation error (bad direction, missing fields, wrong types)
 * Response 422: point outside grid coverage
 * Response 500: unexpected error
 */

import type { NextRequest } from 'next/server';
import { z }                from 'zod/v4';
import { wgs84ToStereo70, stereo70ToWgs84 } from '@/lib/geo/transdatRO';
import { zodErrorToResponse, unexpectedError } from '@/lib/api/errors';

// ---------------------------------------------------------------------------
// Request schemas
// ---------------------------------------------------------------------------

const wgs84PointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
});

const stereo70PointSchema = z.object({
  north: z.number(),
  east:  z.number(),
});

const requestSchema = z.discriminatedUnion('direction', [
  z.object({
    direction: z.literal('wgs84ToStereo70'),
    points:    z.array(wgs84PointSchema).min(1).max(500),
  }),
  z.object({
    direction: z.literal('stereo70ToWgs84'),
    points:    z.array(stereo70PointSchema).min(1).max(500),
  }),
]);

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return zodErrorToResponse(parsed.error);
  }

  try {
    if (parsed.data.direction === 'wgs84ToStereo70') {
      const results = parsed.data.points.map((p) =>
        wgs84ToStereo70(p.lat, p.lon),
      );
      return Response.json({ points: results });
    } else {
      const results = parsed.data.points.map((p) =>
        stereo70ToWgs84(p.north, p.east),
      );
      return Response.json({ points: results });
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes('outside')) {
      return Response.json({ error: err.message }, { status: 422 });
    }
    return unexpectedError(err, 'POST /api/geo/convert');
  }
}
