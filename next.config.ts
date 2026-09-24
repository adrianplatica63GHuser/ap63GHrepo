import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  // "standalone" bundles only the files needed to run the app — no full
  // node_modules required at runtime. Used by the UAT Docker image build.
  // Has no effect on `npm run dev`.
  output: "standalone",
  // The test runner's own `next dev` builds into `.next/runner`   (Slice Propus.2)
  // so that it can run beside Adrian's server on 3000: Next 16 locks
  // `<distDir>/dev/lock` and refuses a second `next dev` in one distDir
  // ("Another next dev server is already running in this directory").
  // Only scripts/test-runner/runner.ts sets the variable; unset, nothing
  // changes. The runner's two type globs are already in tsconfig.json's
  // `include`, so Next finds nothing to add and never rewrites that file.
  distDir: process.env.GA40_NEXT_DIST_DIR || ".next",
};

const withNextIntl = createNextIntlPlugin();
export default withNextIntl(nextConfig);
