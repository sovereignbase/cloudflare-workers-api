import { OpaqueIdentifier } from "@sovereignbase/cryptosuite";
import type { ClientConfig, AppContext } from "../../.types/index.js";

export async function fetchClientConfig(
  env: AppContext["env"],
  ctx: AppContext["executionCtx"],
  clientId: OpaqueIdentifier,
): Promise<ClientConfig | false> {
  const speculativePromise = env.BILLING.head(clientId);

  const cacheKey = new Request(
    `https://cache.sovereignbase.dev/billing/${clientId}`,
  );
  const cache = (caches as CacheStorage & { default: Cache }).default;

  const cached = await cache.match(cacheKey);
  if (cached) return (await cached.json()) as ClientConfig;

  if (!(await speculativePromise)) return false;

  const object = await env.BILLING.get(clientId);
  if (!object) return false;

  const response = new Response(object.body, {
    headers: {
      "content-type": "application/json",
      "cache-control": "public, max-age=31536000, immutable",
    },
  });

  ctx.waitUntil(cache.put(cacheKey, response.clone()));

  return (await response.json()) as ClientConfig;
}
