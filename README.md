# void-repro-routes

Minimal reproduction: `void deploy` to Cloudflare fails with `traffic-preservation-unavailable` when `cloudflare.routes` is omitted and the Worker's active version was not uploaded by Void.

- void: 1.1.11
- Target: Cloudflare Workers, served on `workers.dev` only (no routes, no custom domains)

## Problem

This app has no routes.
It is served only on `workers.dev`, so `void.config.ts` sets `workers_dev: true` and `preview_urls: true` and leaves `routes` out:

```ts
cloudflare: {
  name: "void-repro-routes",
  workers_dev: true,
  preview_urls: true,
  // routes is omitted
},
```

If the Worker already exists and its active version was created by something other than Void, `void deploy` stops before uploading:

```
deploy: the existing Worker has dashboard-managed routes or visibility that Void cannot safely republish.
Add its current routes, workers_dev, and preview_urls values to the root Wrangler config, then retry; no version was uploaded.
```

The Worker has no routes, so there is nothing to preserve.
It was not configured in the dashboard either; `workers_dev` and `preview_urls` are already set in `void.config.ts`.
The error message's fix does not apply either, because a Void project has no root Wrangler config for the user to edit.

The non-Void versions that trigger this are ordinary.
For example, any of these leaves such a version active:

- creating the Worker first with `wrangler deploy`, `cf deploy` or the dashboard
- connecting the Worker to Workers Builds, which needs an existing Worker
- deploying once with another tool before moving to Void

## Cause

`@void/deploy-cloudflare` treats a missing `routes` (and `route`) as "keep whatever routes the Worker has now":

```js
// @void/deploy-cloudflare/dist/index.mjs:1078
...config.routes === void 0 && config.route === void 0 ? { preserveRoutes: true } : {},
```

To keep the current routes, it reads them from the metadata that Void writes into its own version messages.
When the active version has no such metadata, the previous traffic config is unknown, and `resolvePreservedTraffic` returns `null`:

```js
// @void/deploy-cloudflare/dist/index.mjs:1153
if ((desired.preserveRoutes || desired.preserveWorkersDev || desired.preservePreviewUrls) && workerExists && !previous) return null;
```

```js
// @void/deploy-cloudflare/dist/index.mjs:1293
if (!resolved) return {
  ok: false,
  reason: "traffic-preservation-unavailable",
  ...
};
```

So "routes omitted" is read as "preserve unknown routes" rather than "this Worker has no routes", and the deploy fails.
The check does not look at the Worker's actual routes, which are empty here.

Setting `routes: []` explicitly makes the same deploy succeed, because `preserveRoutes` is then not set.

## Steps to reproduce

1. Create a Worker named `void-repro-routes` with any tool other than Void, for example `cf deploy` or `wrangler deploy` from a hello-world project.
   Do not add routes.
2. In this repository, run:

   ```sh
   pnpm install
   pnpm run build
   pnpm exec void deploy --platform cloudflare
   ```

3. The deploy fails with `traffic-preservation-unavailable`, and no version is uploaded.

## Expected

When the Worker has no routes, omitting `routes` deploys it the same way as `routes: []`.
