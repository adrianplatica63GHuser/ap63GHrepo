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
};

export default createJestConfig(config);
