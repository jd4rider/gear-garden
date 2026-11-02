# Deployment

## GitHub Pages

`.github/workflows/pages.yml` is the only deploy path:

1. `npm ci`
2. `npm run validate` — every shipped garden, plus an independent solve sample
3. `npm test` — mechanics, solver, generator, campaign
4. `npm run build` — typecheck and Vite production bundle
5. copy the build to `dist/play/` and publish the Pages artifact

The playable build is <https://jd4rider.github.io/gear-garden/play/>.

`base: './'` keeps assets working under `/play/`, a project path, or a future
custom domain. The repo carries no `public/CNAME`: GitHub Pages serves exactly
one canonical hostname, and a custom domain there would redirect the `github.io`
URL that the portal embeds.

## Local

```bash
npm install
npm run dev       # http://localhost:5175
npm run build
npm run preview
```

## Updating levels

```bash
npm run bake       # regenerate and solver-verify all 1,000
npm run validate   # re-check the manifest without regenerating
```

Commit the regenerated `src/data/levels.json`; CI re-validates it before deploy.

## Portal entry

The game is listed in the portal catalogue with:

- id `gear-garden`
- canonical `https://jd4rider.github.io/gear-garden/play/`
- preferred subdomain probe `https://geargarden.littlejoyarcade.site/play/`
- save key `gear-garden-save-v1`

A Supabase row is applied through a versioned migration, and the portal needs a
deploy for the new catalogue entry to appear.
