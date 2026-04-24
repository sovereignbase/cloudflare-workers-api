import type { BillingData, AppContext } from "../../.types/index.js";

export async function fetchBillingData(
  context: AppContext,
  id: string,
): Promise<BillingData | false> {
  const speculativePromise = context.env.BILLING.head(id);

  const cacheKey = new Request(`https://cache.sovereignbase.dev/billing/${id}`);
  const cache = (caches as CacheStorage & { default: Cache }).default;

  const cached = await cache.match(cacheKey);
  if (cached) return (await cached.json()) as BillingData;

  if (!(await speculativePromise)) return false;

  const object = await context.env.BILLING.get(id);
  if (!object) return false;

  const response = new Response(object.body, {
    headers: {
      "content-type": "application/json",
      "cache-control": "public, max-age=31536000, immutable",
    },
  });

  context.executionCtx.waitUntil(cache.put(cacheKey, response.clone()));

  return (await response.json()) as BillingData;
}
