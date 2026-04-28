/**
 * Client-safe DMS ↔ Decimal Degree helpers.
 *
 * No file I/O — safe to import in both server and client components.
 * The full TransDatRO conversion (Stereo70 ↔ WGS84) lives in transdatRO.ts
 * and must stay server-side because it reads the .GRD binary grid file.
 */

export type DMS = {
  deg: number;
  min: number;
  sec: number;
  dir: "N" | "S" | "E" | "W";
};

export function decimalToDMS(decDeg: number, isLat: boolean): DMS {
  const abs = Math.abs(decDeg);
  const deg = Math.floor(abs);
  const minFull = (abs - deg) * 60;
  const min = Math.floor(minFull);
  const sec = (minFull - min) * 60;
  const dir: DMS["dir"] = isLat
    ? decDeg >= 0 ? "N" : "S"
    : decDeg >= 0 ? "E" : "W";
  return { deg, min, sec, dir };
}

export function dmsToDecimal({ deg, min, sec }: Omit<DMS, "dir">): number {
  return deg + min / 60 + sec / 3600;
}

/** Formats a decimal degree value as a DMS string, e.g. "44°22'30.50\"N". */
export function formatDMS(decDeg: number, isLat: boolean): string {
  const d = decimalToDMS(decDeg, isLat);
  const secStr = d.sec.toFixed(2).padStart(5, "0");
  const minStr = String(d.min).padStart(2, "0");
  return `${d.deg}°${minStr}'${secStr}"${d.dir}`;
}
