# ── Stage 1: install all dependencies (incl. devDeps needed by the build) ─────
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# ⚠️ **AND THE POSTINSTALL SCRIPT ITSELF, WHICH IS WHY `npm ci` BELOW CAN RUN
# AT ALL.** package.json declares `"postinstall": "node
# scripts/copy-pdfjs-worker.mjs"`, and npm runs it from /app -- so without this
# line `npm ci` dies with `Cannot find module '/app/scripts/copy-pdfjs-worker.mjs'`,
# exit 1, and the whole build stops at this stage. That is not hypothetical: it
# had been true since 8b817ff (Slice #19.06, 2 Jul) added BOTH the script and
# the postinstall entry to a deps stage that has copied only package*.json
# since the Dockerfile was written, and it stayed invisible for nearly two
# months because this layer was cached. The first build to pull a fresh
# node:22-alpine digest re-ran the RUN and failed in a deps stage nobody had
# touched. ⚠️ **A CACHED `RUN` IS NOT EVIDENCE THAT IT WORKS** -- that is the
# transferable lesson, and it is why fa29825, which believed it was restoring
# this behaviour, changed only comment lines IN THIS FILE and could not have
# noticed. (Its .dockerignore half was real; its Dockerfile half was a hunk of
# sixteen comment lines and no deletions.)
#
# ONE file, not `COPY scripts ./scripts`: this layer is keyed on what it
# copies, so pulling the whole folder in would invalidate the ~40 s npm ci on
# every edit to any unrelated script.
COPY scripts/copy-pdfjs-worker.mjs ./scripts/
# Reproducible install from the lockfile, same as CI.
#
# Do NOT switch this to `npm install --ignore-scripts`. Two things break:
#   1. `npm install` can silently update the lockfile, so the image stops
#      matching what CI built and tested — the exact drift `npm ci` prevents.
#   2. `--ignore-scripts` suppresses DEPENDENCY install scripts, and this tree
#      has eight that matter here — `sharp`, `esbuild` (×3), `@swc/core`,
#      `unrs-resolver`, `tesseract.js`, `@parcel/watcher` — which is how their
#      native binaries get placed. (The lockfile shows eleven; `fsevents` ×2 is
#      darwin-only and pdfjs-dist's `canvas` is optional, so none of those three
#      installs on alpine.) Without them the build or the
#      runtime image breaks outright.
#      ⚠️ **THE REASON IS NOT THE PDFJS WORKER, WHATEVER THIS COMMENT USED TO
#      SAY.** This stage's postinstall does copy the worker — into this
#      stage's own /app/public, which nothing ever reads: the builder takes
#      node_modules from here and nothing else. That copy has always been
#      discarded. The builder generates the file itself; see the RUN below its
#      `COPY . .`. Anyone reading the correction and concluding
#      `--ignore-scripts` is therefore harmless has the wrong end of it —
#      hence the paragraph above.
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
# Slice #23.10.dev -- developer diagnostics (AI Discover, the Metadata tab and
# the filters/columns fed from it, Help content, Settings, the locale flags).
# Defaults to false so an image built without the arg ships WITHOUT them: the
# safe direction, since forgetting the flag hides a diagnostic rather than
# exposing one. build-ciprian-image.ps1 passes false explicitly anyway.
ARG NEXT_PUBLIC_DEV_TOOLS=false

ENV NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=$NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
ENV NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID=$NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_DEV_TOOLS=$NEXT_PUBLIC_DEV_TOOLS
ENV NEXT_TELEMETRY_DISABLED=1

# ⚠️ **THE WORKER IS GENERATED HERE, NOT INHERITED FROM THE BUILD CONTEXT, AND
# THE DEPS STAGE'S POSTINSTALL DOES NOT COVER IT.** public/pdf.worker.min.js is
# gitignored, and it used to reach the image only if it happened to exist in
# the working tree the `COPY . .` above ran over -- true on Adrian's machine,
# where npm install has run, and false on any clean checkout or CI runner. It
# is now in .dockerignore as well, so that path is closed and this RUN is the
# only writer. The postinstall in the deps stage does not help either: that
# stage writes the file into ITS OWN /app/public, and this stage copies only
# node_modules across, so what it produced is discarded. (The deps comment
# claimed otherwise until this slice; it was describing an intention, not a
# path.)
#
# Running it here, after node_modules and the source are both in place, makes
# the file come from the image's own pinned pdfjs-dist. Cheap, deterministic,
# and it closes for real the runtime 404 on /pdf.worker.min.js -- broken PDF
# rasterisation in Admin -> Import -- that fa29825 set out to close.
# ⚠️ `&& test -s` because the script EXITS 0 WHEN THE SOURCE IS MISSING. That
# silence is right for postinstall, where it guards a first run before
# pdfjs-dist resolves; here node_modules is fully populated, so a missing
# source means the build is broken and exiting 0 would ship the image anyway --
# reappearing as the same runtime 404 this line exists to prevent. The stray
# working-tree copy that used to mask it is gone by construction:
# public/pdf.worker.min.js is in .dockerignore, so `COPY . .` above cannot
# bring one in. pdfjs-dist v4 renames the source to `build/pdf.worker.min.mjs`,
# so the next major bump is exactly that case -- and before the .dockerignore
# entry it would have passed this guard on a file dated whenever Adrian last
# ran npm install.
RUN node scripts/copy-pdfjs-worker.mjs && test -s public/pdf.worker.min.js

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
