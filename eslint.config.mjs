import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Third-party minified assets in public/ (e.g. pdf.worker.min.js).
    "public/**",
    // ⚠️ The bridge's quarantine folder.                       (Slice #32.02)
    //
    // The device bridge cannot unlink, so a removal Claude is authorised to
    // make becomes a move into `_to_delete/` under the repo root, and Adrian
    // deletes that one folder afterwards. It is gitignored and excluded from
    // `tsconfig.json`; without this line ESLint was the one tool still reading
    // it, and it failed the whole run on rules broken by a file that is on its
    // way to the bin — which is a lint error nobody can act on except by doing
    // the deletion the run is blocking.
    "_to_delete/**",
  ]),
  {
    rules: {
      // Honour the `_`-prefix convention for intentionally-unused identifiers.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
]);

export default eslintConfig;
