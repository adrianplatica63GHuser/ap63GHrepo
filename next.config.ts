import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  // "standalone" bundles only the files needed to run the app — no full
  // node_modules required at runtime. Used by the UAT Docker image build.
  // Has no effect on `npm run dev`.
  output: "standalone",
};

const withNextIntl = createNextIntlPlugin();
export default withNextIntl(nextConfig);
