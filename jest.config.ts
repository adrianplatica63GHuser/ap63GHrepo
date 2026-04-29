import type { Config } from "jest";
import nextJest from "next/jest.js";

// next/jest wraps Jest with the Next.js SWC transformer, auto-mocks stylesheets
// and image/font imports, loads .env files into process.env, and honors the
// paths option in tsconfig.json. Docs:
// node_modules/next/dist/docs/01-app/02-guides/testing/jest.md
const createJestConfig = nextJest({ dir: "./" });

const config: Config = {
  coverageProvider: "v8",
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  // Explicitly mirror tsconfig paths so jest.mock("@/...") resolves correctly.
  // nextJest reads tsconfig at runtime, but the explicit entry here ensures it
  // is available before jest.mock() hoisting occurs.
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
};

export default createJestConfig(config);
