# Portfolio — Software Engineer

Dark, futuristic landing page. Next.js 16 (App Router) · React 19 · Tailwind v4 ·
Framer Motion · react-three-fiber · Lenis. TypeScript throughout.

```bash
pnpm install          # lifecycle scripts are blocked by config
pnpm dev              # http://localhost:3000
pnpm build && pnpm start
pnpm run ci:verify    # audit + typecheck + lint + build
```

`pnpm` only. `packageManager` is pinned and `engines` requires pnpm >= 10.

---

## Supply-chain posture

**pnpm 10+/11 reads its own settings from `pnpm-workspace.yaml`, not `.npmrc`.**
Putting these keys in `.npmrc` silently does nothing — verified with
`pnpm config get`. The real controls live in `pnpm-workspace.yaml`:

| Setting | Effect |
|---|---|
| `ignoreScripts: true` | No dependency `preinstall`/`install`/`postinstall` runs, ever |
| `onlyBuiltDependencies: []` | Empty allow-list. A package needing a real build must be named here explicitly |
| `blockExoticSubdeps: true` | Transitive deps cannot resolve to git URLs or direct tarballs |
| `minimumReleaseAge: 1440` | Refuses versions published in the last 24h |
| `saveExact: true` | `pnpm add` never writes a `^` range |
| `preferFrozenLockfile: true` | Lockfile is authoritative |

### Verified, not assumed

- **Lifecycle scripts blocked.** Of 447 installed packages, exactly one
  (`unrs-resolver`) declares a `postinstall`. It did not run: its directory
  contains zero `.node` binaries, which the hook would have produced.
- **Maturity gate fires.** The first install was *rejected* because
  `zod@4.5.2` had been published ~6 hours earlier. Pinned to `4.4.3` instead.
- **Lockfile drift fails the build.** Hand-editing `three` to a different
  version makes `pnpm install --frozen-lockfile` exit with
  `ERR_PNPM_OUTDATED_LOCKFILE`.
- **Registry-only resolution.** No git, tarball, or non-registry specifier
  appears anywhere in `pnpm-lock.yaml`.
- **All 19 direct dependencies pinned exactly.** No `^`, `~`, or wildcard.

If a dependency legitimately needs to build, add it to `onlyBuiltDependencies`
in `pnpm-workspace.yaml` — deliberately, in a reviewable diff.

### CI

`.github/workflows/ci.yml` runs `pnpm install --frozen-lockfile
--ignore-scripts`. The `--ignore-scripts` flag is redundant with the config,
and intentionally so: CI should not depend on a config file being read
correctly.

---

## Secrets & input handling

- **No secrets in source.** Nothing is hardcoded; `.env*` is git-ignored.
- **Server/client boundary is enforced, not assumed.** Environment parsing
  lives in `lib/env.server.ts` behind an `import "server-only"`, so a client
  component that reaches it is a *build* error. This split was made after
  finding that the env schema was being bundled into a client chunk via
  `lib/schemas.ts` (shape only, no values — but the wrong side of the line).
  The client bundle is verifiably free of `CONTACT_WEBHOOK_URL` and
  `readServerEnv`.
- **One validation gate.** `app/api/contact/route.ts` validates with zod
  before anything downstream touches the data: content-type check → JSON
  parse → `contactSchema.safeParse`. `.strict()` rejects unknown keys rather
  than passing them through.
- **Sanitising transforms.** C0/C1 control characters are stripped and
  whitespace collapsed, so a submission cannot forge log lines. Verified:
  NUL, newline, and BELL are all removed.
- **Errors leak field names only**, never submitted values.
- Honeypot field plus a per-IP rate limit (5/min; swap for a shared store
  behind a load balancer).
- CSP in `next.config.ts` sets `connect-src 'self'` — the page cannot phone
  home. `'unsafe-eval'` is dev-only.

---

## The WebGL hero

`components/HeroCanvas.tsx` renders a stylised engineer at a glowing
three-monitor desk. **Nothing is fetched.** No textures, no HDR environment
maps, no video, no external image hosts. The monitors are a fragment shader
that draws scrolling syntax-coloured "code" from a hash function; the floor is
a procedural grid; the desk, keyboard, and figure are primitives. This is what
lets `connect-src 'self'` be honest. (Note that drei's `<Environment>` presets
fetch from a CDN — deliberately avoided.)

The camera lerps toward a cursor-driven target with frame-rate-independent
damping, so tracking feels identical at 60 and 144Hz.

**Memory:** geometries and materials are declared as JSX, so r3f's reconciler
disposes them on unmount. `<ContextGuard />` additionally calls `gl.dispose()`
and `forceContextLoss()` — browsers cap live WebGL contexts at ~16, and an SPA
that mounts several canvases will otherwise silently lose the oldest.

`prefers-reduced-motion` is respected in the canvas, the terminal, and Lenis
(which does not initialise at all).

## Layout

```
app/       layout, page, api/contact/route.ts
components/ HeroCanvas · Terminal · ProjectCard · SmoothScroll
lib/       schemas.ts (client-safe) · env.server.ts (server-only) · content.ts
```
