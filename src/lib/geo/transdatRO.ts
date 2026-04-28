/**
 * TransDatRO — TypeScript port
 *
 * Faithful port of TransDatRO v1.02 (09.06.2010), originally authored for the
 * Romanian National Agency for Cadastre and Land Registration (ANCPI).
 *
 * Converts 2-D planimetric coordinates between:
 *   - ETRS89 / WGS84  (decimal degrees, lat/lon)
 *   - Stereografic 1970  (Northing / Easting, metres)
 *
 * Survey-grade accuracy is achieved via bicubic B-spline interpolation over
 * the ETRS89_KRASOVSCHI42_2DJ.GRD correction grid (72 × 53 nodes, 11 km step).
 *
 * The grid file is read once from disk and cached for the lifetime of the
 * Node.js process.  Height transformation (ETRS89 ↔ Marea Neagră 1975) is
 * intentionally omitted — we store 2-D corners only.
 *
 * All internal angles are in RADIANS unless the variable name ends in "Deg".
 */

import fs   from 'fs';
import path from 'path';

// ---------------------------------------------------------------------------
// Grid file — lazy load & cache
// ---------------------------------------------------------------------------

const GRID_PATH = path.join(
  process.cwd(),
  'src', 'lib', 'geo', 'grids', 'ETRS89_KRASOVSCHI42_2DJ.GRD',
);

let _gridBuf: Buffer | null = null;

function getGridBuffer(): Buffer {
  if (!_gridBuf) {
    _gridBuf = fs.readFileSync(GRID_PATH);
  }
  return _gridBuf;
}

// ---------------------------------------------------------------------------
// Constants — from class dV in the Java source
// ---------------------------------------------------------------------------

/** GRS80 semi-major axis (metres) */
const A_ETRS89 = 6_378_137;

/** GRS80 inverse flattening */
const INV_F_ETRS89 = 298.257_222_101;

// Helmert 2D parameters — Oblique Stereographic GRS80 → Stereografic 1970
const tE_OS_St70 =   119.7358;
const tN_OS_St70 =    31.8051;
const dm_OS_St70 =     0.11559991;
const Rz_OS_St70 =    -0.22739706;

// Helmert 2D parameters — Stereografic 1970 → Oblique Stereographic GRS80
const tE_St70_OS =  -119.7358;
const tN_St70_OS =   -31.8051;
const dm_St70_OS =    -0.11559991;
const Rz_St70_OS =     0.22739706;

// ---------------------------------------------------------------------------
// Low-level binary read — the .GRD files are Delphi binary (little-endian)
// ---------------------------------------------------------------------------

function readF64LE(buf: Buffer, byteOffset: number): number {
  return buf.readDoubleLE(byteOffset);
}

// ---------------------------------------------------------------------------
// Stereo_FiLa_NE — GRS80 oblique stereographic forward projection
//
// Input  : phi, la  — geodetic lat/lon in RADIANS
//          a, nf    — ellipsoid semi-major axis and inverse flattening
// Output : { north, east } in metres (Stereo 70 false origin 500 000 m)
// ---------------------------------------------------------------------------

function stereoFiLaNE(
  phi: number, la: number,
  a: number, nf: number,
): { north: number; east: number } {
  const br1 = 46 * Math.PI / 180;   // reference latitude (Stereo 70 origin)
  const la0 = 25 * Math.PI / 180;   // reference longitude
  const k0  = 0.99975;              // scale factor

  const f  = 1 / nf;
  const b  = a * (1 - f);
  const ep = Math.sqrt((a * a - b * b) / (a * a));

  const w   = Math.sqrt(1 - ep * ep * Math.sin(br1) ** 2);
  let raza  = (a * (1 - ep * ep)) / (w ** 3);
  raza      = Math.sqrt(raza * a / w);

  const n   = Math.sqrt(1 + (ep * ep * Math.cos(br1) ** 4) / (1 - ep * ep));
  const s1  = (1 + Math.sin(br1)) / (1 - Math.sin(br1));
  const s2  = (1 - ep * Math.sin(br1)) / (1 + ep * Math.sin(br1));
  const w1  = Math.exp(n * Math.log(s1 * Math.exp(ep * Math.log(s2))));

  const c   = ((n + Math.sin(br1)) * (1 - (w1 - 1) / (w1 + 1))) /
              ((n - Math.sin(br1)) * (1 + (w1 - 1) / (w1 + 1)));
  const w2  = c * w1;
  const hi0r = (w2 - 1) / (w2 + 1);
  const hi0  = Math.atan(hi0r / Math.sqrt(1 - hi0r * hi0r));

  const sa  = (1 + Math.sin(phi)) / (1 - Math.sin(phi));
  const sb  = (1 - ep * Math.sin(phi)) / (1 + ep * Math.sin(phi));
  const ww  = c * Math.exp(n * Math.log(sa * Math.exp(ep * Math.log(sb))));
  const hir = (ww - 1) / (ww + 1);
  const hi  = Math.atan(hir / Math.sqrt(1 - hir * hir));
  const lam = n * (la - la0) + la0;

  const beta  = 1
    + Math.sin(hi)  * Math.sin(hi0)
    + Math.cos(hi)  * Math.cos(hi0) * Math.cos(lam - la0);

  const east  = 2 * raza * k0 * Math.cos(hi) * Math.sin(lam - la0) / beta + 500_000;
  const north = 2 * raza * k0 *
    (Math.cos(hi0) * Math.sin(hi) - Math.sin(hi0) * Math.cos(hi) * Math.cos(lam - la0))
    / beta + 500_000;

  return { north, east };
}

// ---------------------------------------------------------------------------
// Stereo_NE_FiLa — GRS80 oblique stereographic inverse projection
//
// Input  : north, east in metres
// Output : { fi, la } in RADIANS
// ---------------------------------------------------------------------------

function stereoNEFiLa(
  north: number, east: number,
  a: number, nf: number,
): { fi: number; la: number } {
  const br1 = 46 * Math.PI / 180;
  const la0 = 25 * Math.PI / 180;
  const k0  = 0.99975;
  const fn  = 500_000;
  const fe  = 500_000;

  const f  = 1 / nf;
  const b  = a * (1 - f);
  const ep = Math.sqrt((a * a - b * b) / (a * a));

  const w   = Math.sqrt(1 - ep * ep * Math.sin(br1) ** 2);
  let raza  = (a * (1 - ep * ep)) / (w ** 3);
  raza      = Math.sqrt(raza * a / w);

  const n   = Math.sqrt(1 + (ep * ep * Math.cos(br1) ** 4) / (1 - ep * ep));
  const s1  = (1 + Math.sin(br1)) / (1 - Math.sin(br1));
  const s2  = (1 - ep * Math.sin(br1)) / (1 + ep * Math.sin(br1));
  const w1  = Math.exp(n * Math.log(s1 * Math.exp(ep * Math.log(s2))));

  const c   = ((n + Math.sin(br1)) * (1 - (w1 - 1) / (w1 + 1))) /
              ((n - Math.sin(br1)) * (1 + (w1 - 1) / (w1 + 1)));
  const w2  = c * w1;
  const hi0r = (w2 - 1) / (w2 + 1);
  const hi0  = Math.atan(hi0r / Math.sqrt(1 - hi0r * hi0r));

  const g   = 2 * raza * k0 * Math.tan(Math.PI / 4 - hi0 / 2);
  const h   = 4 * raza * k0 * Math.tan(hi0) + g;

  const ii  = Math.atan((east - fe) / (h + (north - fn)));
  const j   = Math.atan((east - fe) / (g - (north - fn))) - ii;
  const lam = j + 2 * ii + la0;
  const La  = la0 + (lam - la0) / n;
  const hi  = hi0 + 2 * Math.atan(
    (north - fn - (east - fe) * Math.tan(j / 2)) / (2 * raza * k0),
  );

  const csi = (0.5 * Math.log((1 + Math.sin(hi)) / (c * (1 - Math.sin(hi))))) / n;

  let Fi  = 2 * Math.atan(Math.exp(csi)) - Math.PI / 2;
  let dif = 100;
  let iter = 0;
  while (dif > 0.000_001 && iter < 50) {
    iter++;
    const fic  = Fi;
    const csii = Math.log(
      Math.tan(Fi / 2 + Math.PI / 4)
      * Math.exp((ep / 2) * Math.log((1 - ep * Math.sin(Fi)) / (1 + ep * Math.sin(Fi)))),
    );
    Fi  = Fi - (csii - csi) * Math.cos(Fi) * (1 - ep * ep * Math.sin(Fi) ** 2) / (1 - ep * ep);
    dif = Math.abs(Fi * 180 * 3600 / Math.PI - fic * 180 * 3600 / Math.PI);
  }

  return { fi: Fi, la: La };
}

// ---------------------------------------------------------------------------
// Helmert2D — 2-D similarity transformation
// ---------------------------------------------------------------------------

function helmert2D(
  east: number, north: number,
  tE: number, tN: number, dm: number, Rz: number,
): { east: number; north: number } {
  const m    = 1 + dm * 1e-6;
  const RzRad = Rz * Math.PI / (180 * 3_600);   // arcseconds → radians
  return {
    east:  east  * m * Math.cos(RzRad) - north * m * Math.sin(RzRad) + tE,
    north: north * m * Math.cos(RzRad) + east  * m * Math.sin(RzRad) + tN,
  };
}

// ---------------------------------------------------------------------------
// BSplineInterpolation — bicubic B-spline surface
//
// Operates on 1-based arrays (indices 1..16).  Index 0 is unused.
// ---------------------------------------------------------------------------

function bsplineInterpolation(ff: number[], azIn: number[]): number {
  const cf = new Array<number>(17).fill(0);
  const az = [...azIn];   // copy — Java modifies az in-place

  // Derivatives and cross-derivatives
  cf[1]  = az[6];
  cf[2]  = az[7];
  cf[3]  = az[10];
  cf[4]  = az[11];

  cf[5]  = (-az[8]  + 4 * az[7]  - 3 * az[6])  / 2;
  cf[6]  = ( 3 * az[7]  - 4 * az[6]  + az[5])  / 2;
  cf[7]  = (-az[12] + 4 * az[11] - 3 * az[10]) / 2;
  cf[8]  = ( 3 * az[11] - 4 * az[10] + az[9])  / 2;
  cf[9]  = (-az[14] + 4 * az[10] - 3 * az[6])  / 2;
  cf[10] = (-az[15] + 4 * az[11] - 3 * az[7])  / 2;
  cf[11] = ( 3 * az[10] - 4 * az[6]  + az[2])  / 2;
  cf[12] = ( 3 * az[11] - 4 * az[7]  + az[3])  / 2;

  cf[13] = ((az[1]  + az[11]) - (az[3]  + az[9]))  / 4;
  cf[14] = ((az[2]  + az[12]) - (az[4]  + az[10])) / 4;
  cf[15] = ((az[5]  + az[15]) - (az[7]  + az[13])) / 4;
  cf[16] = ((az[6]  + az[16]) - (az[8]  + az[14])) / 4;

  // 16 bicubic surface coefficients
  az[1]  = cf[1];
  az[2]  = cf[5];
  az[3]  = -3*cf[1] + 3*cf[2]  - 2*cf[5]  -   cf[6];
  az[4]  =  2*cf[1] - 2*cf[2]  +   cf[5]  +   cf[6];
  az[5]  = cf[9];
  az[6]  = cf[13];
  az[7]  = -3*cf[9]  + 3*cf[10] - 2*cf[13] -   cf[14];
  az[8]  =  2*cf[9]  - 2*cf[10] +   cf[13] +   cf[14];
  az[9]  = -3*cf[1]  + 3*cf[3]  - 2*cf[9]  -   cf[11];
  az[10] = -3*cf[5]  + 3*cf[7]  - 2*cf[13] -   cf[15];
  az[11] =
      9*cf[1]  - 9*cf[2]  - 9*cf[3]  + 9*cf[4]
    + 6*cf[5]  + 3*cf[6]  - 6*cf[7]  - 3*cf[8]
    + 6*cf[9]  - 6*cf[10] + 3*cf[11] - 3*cf[12]
    + 4*cf[13] + 2*cf[14] + 2*cf[15] +   cf[16];
  az[12] =
     -6*cf[1]  + 6*cf[2]  + 6*cf[3]  - 6*cf[4]
    - 3*cf[5]  - 3*cf[6]  + 3*cf[7]  + 3*cf[8]
    - 4*cf[9]  + 4*cf[10] - 2*cf[11] + 2*cf[12]
    - 2*cf[13] - 2*cf[14] -   cf[15] -   cf[16];
  az[13] =  2*cf[1]  - 2*cf[3]  +   cf[9]  +   cf[11];
  az[14] =  2*cf[5]  - 2*cf[7]  +   cf[13] +   cf[15];
  az[15] =
     -6*cf[1]  + 6*cf[2]  + 6*cf[3]  - 6*cf[4]
    - 4*cf[5]  - 2*cf[6]  + 4*cf[7]  + 2*cf[8]
    - 3*cf[9]  + 3*cf[10] - 3*cf[11] + 3*cf[12]
    - 2*cf[13] -   cf[14] - 2*cf[15] -   cf[16];
  az[16] =
      4*cf[1]  - 4*cf[2]  - 4*cf[3]  + 4*cf[4]
    + 2*cf[5]  + 2*cf[6]  - 2*cf[7]  - 2*cf[8]
    + 2*cf[9]  - 2*cf[10] + 2*cf[11] - 2*cf[12]
    +   cf[13] +   cf[14] +   cf[15] +   cf[16];

  let sum = 0;
  for (let i = 1; i <= 16; i++) sum += az[i] * ff[i];
  return sum;
}

// ---------------------------------------------------------------------------
// Grid context — ported from Interpolation_1D.loadArrays()
//
// Computes the 4×4 neighbourhood node indices and B-spline basis values
// for the query point (stE = Stereo70 East, stN = Stereo70 North).
//
// Returns 1-based arrays nc[1..16] and ff[1..16].
// ---------------------------------------------------------------------------

interface GridCtx {
  nc: number[];
  ff: number[];
}

function buildGridCtx(buf: Buffer, stE: number, stN: number): GridCtx {
  const minE  = readF64LE(buf,  0);
  const maxE  = readF64LE(buf,  8);
  const minN  = readF64LE(buf, 16);
  const maxN  = readF64LE(buf, 24);
  const stepE = readF64LE(buf, 32);
  const stepN = readF64LE(buf, 40);

  if (
    stE <= minE + stepE || stE >= maxE - stepE ||
    stN <= minN + stepN || stN >= maxN - stepN
  ) {
    throw new Error(
      `Coordinates outside Stereo 70 grid boundary `
      + `(E=${stE.toFixed(1)}, N=${stN.toFixed(1)}).  `
      + `Valid range: E [${(minE + stepE).toFixed(0)}, ${(maxE - stepE).toFixed(0)}], `
      + `N [${(minN + stepN).toFixed(0)}, ${(maxN - stepN).toFixed(0)}]`,
    );
  }

  // Number of columns in the grid
  const nrjx    = Math.round((maxE - minE) / stepE + 1);
  // 0-based column / row of the "point 6" node (SW corner of the unit cell)
  const nodcolx = Math.floor((stE - minE) / stepE);
  const nodliny = Math.floor((stN - minN) / stepN);

  // Relative coordinates within the unit cell [0, 1)
  const xk = (stE - (minE + nodcolx * stepE)) / stepE;
  const yk = (stN - (minN + nodliny * stepN)) / stepN;

  // Bicubic basis functions (1-indexed)
  const ff = new Array<number>(17).fill(0);
  ff[1]  = 1;
  ff[2]  = xk;
  ff[3]  = xk * xk;
  ff[4]  = xk * xk * xk;
  ff[5]  = yk;
  ff[6]  = xk * yk;
  ff[7]  = xk * xk * yk;
  ff[8]  = xk * xk * xk * yk;
  ff[9]  = yk * yk;
  ff[10] = xk * yk * yk;
  ff[11] = xk * xk * yk * yk;
  ff[12] = xk * xk * xk * yk * yk;
  ff[13] = yk * yk * yk;
  ff[14] = xk * yk * yk * yk;
  ff[15] = xk * xk * yk * yk * yk;
  ff[16] = xk * xk * xk * yk * yk * yk;

  // 1-based node numbers for the 4×4 neighbourhood (matching Java nc[1..16])
  const nc = new Array<number>(17).fill(0);
  nc[6]  =  nodliny      * nrjx + nodcolx + 1;
  nc[1]  = (nodliny - 1) * nrjx + nodcolx;
  nc[2]  = (nodliny - 1) * nrjx + nodcolx + 1;
  nc[3]  = (nodliny - 1) * nrjx + nodcolx + 2;
  nc[4]  = (nodliny - 1) * nrjx + nodcolx + 3;
  nc[5]  =  nodliny      * nrjx + nodcolx;
  nc[7]  =  nodliny      * nrjx + nodcolx + 2;
  nc[8]  =  nodliny      * nrjx + nodcolx + 3;
  nc[9]  = (nodliny + 1) * nrjx + nodcolx;
  nc[10] = (nodliny + 1) * nrjx + nodcolx + 1;
  nc[11] = (nodliny + 1) * nrjx + nodcolx + 2;
  nc[12] = (nodliny + 1) * nrjx + nodcolx + 3;
  nc[13] = (nodliny + 2) * nrjx + nodcolx;
  nc[14] = (nodliny + 2) * nrjx + nodcolx + 1;
  nc[15] = (nodliny + 2) * nrjx + nodcolx + 2;
  nc[16] = (nodliny + 2) * nrjx + nodcolx + 3;

  return { nc, ff };
}

// ---------------------------------------------------------------------------
// Interpolation_2D.doInterpolation — read dE / dN shifts for each of the
// 16 neighbourhood nodes from the 2-D grid file and interpolate.
//
// Byte layout per node (1-based node number k):
//   dE offset = (k - 1) * 16 + 48        (48 = header size)
//   dN offset = (k - 1) * 16 +  8 + 48
// ---------------------------------------------------------------------------

const HEADER_BYTES = 48;
const SENTINEL     = 999;

function interpolate2D(buf: Buffer, stE: number, stN: number): { shiftE: number; shiftN: number } {
  const { nc, ff } = buildGridCtx(buf, stE, stN);

  const ax = new Array<number>(17).fill(0);
  const ay = new Array<number>(17).fill(0);

  for (let i = 1; i <= 16; i++) {
    const k       = nc[i];
    const offsetE = (k - 1) * 16 + HEADER_BYTES;
    const offsetN = (k - 1) * 16 + 8 + HEADER_BYTES;

    const dE = readF64LE(buf, offsetE);
    const dN = readF64LE(buf, offsetN);

    if (Math.round(dE) === SENTINEL || Math.round(dN) === SENTINEL) {
      throw new Error('Coordinates fall outside the valid grid border (sentinel 999 encountered)');
    }
    ax[i] = dE;
    ay[i] = dN;
  }

  return {
    shiftE: bsplineInterpolation(ff, ax),
    shiftN: bsplineInterpolation(ff, ay),
  };
}

// ---------------------------------------------------------------------------
// Public API — coordinate conversion
// ---------------------------------------------------------------------------

export interface Stereo70Coords {
  /** Stereografic 1970 Northing (metres) */
  north: number;
  /** Stereografic 1970 Easting (metres) */
  east: number;
}

export interface Wgs84Coords {
  /** WGS84 latitude (decimal degrees, positive = N) */
  lat: number;
  /** WGS84 longitude (decimal degrees, positive = E) */
  lon: number;
}

/**
 * Convert WGS84 / ETRS89 decimal degrees → Stereografic 1970 (N, E in metres).
 * Survey-grade accuracy via grid interpolation.
 *
 * @throws if the point falls outside the grid coverage (roughly Romania bbox).
 */
export function wgs84ToStereo70(lat: number, lon: number): Stereo70Coords {
  const buf = getGridBuffer();

  // 1. Degrees → radians
  const phi = lat * Math.PI / 180;
  const la  = lon * Math.PI / 180;

  // 2. GRS80 oblique stereographic forward projection
  const { north: northS, east: eastS } = stereoFiLaNE(phi, la, A_ETRS89, INV_F_ETRS89);

  // 3. Helmert 2D: Oblique Stereographic → approx. Stereo 70
  const approx = helmert2D(eastS, northS, tE_OS_St70, tN_OS_St70, dm_OS_St70, Rz_OS_St70);

  // 4. Grid correction
  const { shiftE, shiftN } = interpolate2D(buf, approx.east, approx.north);

  return {
    north: approx.north + shiftN,
    east:  approx.east  + shiftE,
  };
}

/**
 * Convert Stereografic 1970 (N, E in metres) → WGS84 / ETRS89 decimal degrees.
 * Survey-grade accuracy via grid interpolation.
 *
 * @throws if the point falls outside the grid coverage.
 */
export function stereo70ToWgs84(north: number, east: number): Wgs84Coords {
  const buf = getGridBuffer();

  // 1. Inverse grid correction
  const { shiftE, shiftN } = interpolate2D(buf, east, north);
  const eastOS  = east  - shiftE;
  const northOS = north - shiftN;

  // 2. Helmert 2D: Stereo 70 → Oblique Stereographic
  const os = helmert2D(eastOS, northOS, tE_St70_OS, tN_St70_OS, dm_St70_OS, Rz_St70_OS);

  // 3. Inverse GRS80 oblique stereographic projection → radians
  const { fi, la } = stereoNEFiLa(os.north, os.east, A_ETRS89, INV_F_ETRS89);

  return {
    lat: fi * 180 / Math.PI,
    lon: la * 180 / Math.PI,
  };
}

// ---------------------------------------------------------------------------
// Public API — DMS utilities
// ---------------------------------------------------------------------------

export interface DMS {
  /** Whole degrees (unsigned) */
  deg: number;
  /** Whole minutes (0–59) */
  min: number;
  /** Decimal seconds (0–60) */
  sec: number;
  /** Cardinal direction */
  dir: 'N' | 'S' | 'E' | 'W';
}

/** Decimal degrees → DMS struct. */
export function decimalToDMS(decDeg: number, isLat: boolean): DMS {
  const abs = Math.abs(decDeg);
  const deg = Math.floor(abs);
  const min = Math.floor((abs - deg) * 60);
  const sec = ((abs - deg) * 60 - min) * 60;
  const dir = isLat
    ? (decDeg >= 0 ? 'N' : 'S')
    : (decDeg >= 0 ? 'E' : 'W');
  return { deg, min, sec, dir };
}

/** DMS struct → decimal degrees (always positive; apply sign / direction externally). */
export function dmsToDecimal(dms: Omit<DMS, 'dir'>): number {
  return dms.deg + dms.min / 60 + dms.sec / 3_600;
}

/**
 * Format a decimal-degree value as a DMS string.
 * Example: 44.123456, isLat=true  → "44° 07' 24.44322" N"
 */
export function formatDMS(decDeg: number, isLat: boolean): string {
  const { deg, min, sec, dir } = decimalToDMS(decDeg, isLat);
  return `${deg}° ${String(min).padStart(2, '0')}' ${sec.toFixed(5)}" ${dir}`;
}
