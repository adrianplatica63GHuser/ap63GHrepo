import type { Config } from "jest";
import nextJest from "next/jest.js";

// next/jest wraps Jest with the Next.js SWC transformer, auto-mocks stylesheets
// and image/font imports, loads .env files into process.env, and honors the
// paths option in tsconfig.json. Docs:
// node_modules/next/dist/docs/01-app/02-guides/testing/jest.md
const createJestConfig = nextJest({ dir: "./" });

const config: Config = {
  // Two workers, and the number is not a performance choice — it is the fix for
  // a crash, moved to where every invocation reads it.
  //
  // Jest's default is `cores-1`. Above a certain worker count on this machine the
  // failure stops being a Node heap error Jest can catch and becomes Windows
  // refusing the process's commit charge: `The paging file is too small for this
  // operation to complete`, thrown while mapping the 136 MB
  // `@next/swc-win32-x64-msvc` binary that every suite needs to transform. The
  // casualties are reported as `Test suite failed to run` with three different
  // messages — `Failed to load bindings`, `UNKNOWN: unknown error, open <path>`,
  // `Cannot find module 'source-map'` — every one of which names a file that is
  // present on disk. So it reads as a broken install or a broken test, and the
  // suites it takes are arbitrary.
  //
  // ⚠️ **THE TELL IS THE SUMMARY, NOT THE ERRORS**: `Tests: N passed, N total`
  // with ZERO failed assertions beside a non-zero `Test Suites: n failed`. A run
  // whose suites die in the transformer never reached an assertion to fail.
  //
  // ⚠️ **WHY HERE AND NOT ONLY IN `package.json`.** The cap was already on the
  // `test` script as `jest --maxWorkers=2` — and the verification sequence in
  // `C:\dev\CLAUDE.md` says `npx jest`, which does not read that script. So the
  // documented fix was unreachable from the documented command, and #32.12 spent
  // a round trip on three suites that had nothing wrong with them. A CLI flag
  // still wins over this value, so `npm test` behaves exactly as before and the
  // flag there is left in place as belt-and-braces.
  //
  // The cost is nothing: measured in #32.05, the full 98-suite run takes 9.3 s at
  // two workers against the 144 s Jest itself estimated from the crashed run.
  // Stopping `npm run dev` before Jest is still the other half of this — the
  // e2e step leaves it holding a couple of GB — and is in the sandbox rule file.
  maxWorkers: 2,
  coverageProvider: "v8",
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  // Explicitly mirror tsconfig paths so jest.mock("@/...") resolves correctly.
  // nextJest reads tsconfig at runtime, but the explicit entry here ensures it
  // is available before jest.mock() hoisting occurs.
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  // Keep the haste map out of the Next.js build output.
  //
  // `output: "standalone"` in next.config.ts makes `npm run build` write
  // `.next/standalone/package.json` — a copy of the root one, carrying the same
  // `"name": "ga40prj"`. jest-haste-map registers the name of every package.json
  // it walks, so from that build until `.next` is deleted, every local
  // `npx jest` opened with `jest-haste-map: Haste module naming collision:
  // ga40prj`. Nothing was misconfigured: the build wrote what it was told to,
  // and nothing under `.next/` was ever imported or run — jest was simply
  // walking somewhere it should not.
  //
  // This is the option that reaches that walk. jest-runtime builds
  // jest-haste-map's `ignorePattern` from modulePathIgnorePatterns, joined only
  // by watchPathIgnorePatterns under `--watch`/`--watchAll`, and by
  // cacheDirectory when that sits under rootDir, which it does not here
  // (jest 30.3.0, node_modules/jest-runtime/build/index.js:430, `createHasteMap`).
  //
  // testPathIgnorePatterns below is NOT the lever, however much it looks like
  // one: it decides which files are TESTS, while the haste map is a separate
  // walk over everything under rootDir. next/jest already puts `/.next/` in it
  // (next 16.2.9, node_modules/next/dist/build/jest/jest.js:197-204), so adding
  // `.next` there again is a no-op that reads like a fix. That existing entry is
  // also what makes this one safe, because the haste map's file list IS the
  // candidate pool for test discovery: everything dropped here was already
  // excluded from the test paths that discovery produces.
  //
  // Measured with a jest-haste-map probe against this tree (jest itself cannot
  // run over the device bridge): the map keeps the same 563 files with the
  // pattern as without it, none of them under `.next`, and the same 102 test
  // files match — all it drops is the build output, ~3,400 files and climbing
  // while `next dev` runs. On Windows the walk itself is shortened, because the
  // crawler tests each entry before recursing and only `.next`'s own directory
  // entry fails to match a pattern ending in a separator; on Linux, where jest
  // locates a POSIX `find`, it shells out to that and filters the output, so
  // there only the map shrinks.
  modulePathIgnorePatterns: ["<rootDir>/\\.next/"],
  // Exclude Playwright e2e tests — those run via `npx playwright test`, not Jest.
  // `/node_modules/` is belt-and-braces rather than redundancy worth removing:
  // next/jest prepends `/node_modules/` and `/.next/` here and a custom config
  // can only append (jest.js:197-204, cited above), but jest's own default for
  // this key is REPLACED by a custom value rather than merged with it
  // (jest-config normalize), so if a future `next` within `^16.2.9` ever stopped
  // prepending, this entry would be the only thing left excluding node_modules.
  testPathIgnorePatterns: ["/node_modules/", "<rootDir>/e2e/"],
};

export default createJestConfig(config);
