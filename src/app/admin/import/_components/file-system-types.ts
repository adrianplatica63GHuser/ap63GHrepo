/**
 * Minimal local typings for the File System Access API.
 *
 * TypeScript's bundled DOM lib does not yet ship these types, so we declare
 * only the small surface this feature actually uses rather than pulling in
 * a third-party @types package.
 */

export type FSFileHandle = {
  kind: "file";
  name: string;
  getFile: () => Promise<File>;
};

export type FSDirectoryHandle = {
  kind: "directory";
  name: string;
  values: () => AsyncIterable<FSFileHandle | FSDirectoryHandle>;
};

declare global {
  interface Window {
    showDirectoryPicker?: (options?: {
      mode?: "read" | "readwrite";
    }) => Promise<FSDirectoryHandle>;
  }
}

export function isFileHandle(
  h: FSFileHandle | FSDirectoryHandle,
): h is FSFileHandle {
  return h.kind === "file";
}
