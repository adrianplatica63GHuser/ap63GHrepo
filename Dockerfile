# ── Stage 1: install all dependencies (incl. devDeps needed by the build) ─────
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# Reproducible install from the lockfile, same as CI.
#
# Do NOT switch this to `npm install --ignore-scripts`. Two things break:
#   1. `npm install` can silently update the lockfile, so the image stops
#      matching what CI built and tested — the exact drift `npm ci` prevents.
#   2. `--ignore-scripts` skips the "postinstall" script
#      (scripts/copy-pdfjs-worker.mjs), which is what puts
#      public/pdf.worker.min.js in place. That file is gitignored and exists
#      ONLY because postinstall generates it, so on a clean checkout the
#      `COPY . .` below finds nothing to copy and the runtime image ships
#      without it. PDF rasterisation in Admin → Import then fails at runtime
#      with a 404 for /pdf.worker.min.js — and only on a clean build, so it
#      would look intermittent.
# Playwright is a devDependency here, but none of the playwright packages
# declare an install script (hasInstallScript=false in package-lock.json), so
# `npm ci` will not try to download browsers into the image.
RUN npm ci

# ── Stage 2: build the Next.js app ────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* vars are baked into the JS bundle at build time.
# Pass them in via --build-arg when running docker build.
ARG NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
ARG NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID=DEMO_MAP_ID
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_APP_URL=http://localhost:3000

ENV NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=$NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
ENV NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID=$NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# ── Stage 3: lean runtime image ───────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# next-intl reads the messages/ JSON files from disk at runtime.
# They are NOT included in .next/standalone automatically.
COPY --from=builder /app/messages ./messages

# The standalone output contains server.js + minimal node_modules.
COPY --from=builder /app/.next/standalone ./

# Static chunks and CSS — must be in .next/static/ relative to server.js.
COPY --from=builder /app/.next/static ./.next/static

# Public folder (fonts, images, favicons, etc.)
COPY --from=builder /app/public ./public

# transdatRO.ts reads this binary grid file from disk at runtime via
# fs.readFileSync(path.join(process.cwd(), "src", "lib", "geo", "grids", ...)).
# It is NOT picked up by Next's standalone output tracing (a raw fs.readFileSync
# on a process.cwd()-built path isn't statically traceable), so without this
# explicit copy the file is missing in the runtime image and any Stereo70 <->
# WGS84 conversion (e.g. importing a property from a text file) throws ENOENT,
# surfacing as a generic 500 "Internal server error".
COPY --from=builder /app/src/lib/geo/grids ./src/lib/geo/grids

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
