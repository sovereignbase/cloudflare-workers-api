import { OpaqueIdentifier } from '@sovereignbase/cryptosuite'
import type { ClientConfig, AppContext } from '../../.types/types.js'

/**
 * Fetches the persisted client configuration for an ANBS base station client.
 *
 * The result is cached through the Cloudflare Cache API when the client
 * configuration exists.
 *
 * @param env The Cloudflare Worker environment bindings.
 * @param ctx The Worker execution context used for cache writes.
 * @param clientId The opaque ANBS client identifier.
 * @returns The client configuration, or `false` when no configuration exists.
 */
export async function fetchClientConfig(
  env: AppContext['env'],
  ctx: AppContext['executionCtx'],
  clientId: OpaqueIdentifier
): Promise<ClientConfig | false> {
  const speculativePromise = env.BILLING.head(clientId)

  const cacheKey = new Request(
    `https://cache.sovereignbase.dev/client-config/${clientId}`
  )
  const cache = (caches as CacheStorage & { default: Cache }).default

  const cached = await cache.match(cacheKey)
  if (cached) return (await cached.json()) as ClientConfig

  if (!(await speculativePromise)) return false

  const object = await env.BILLING.get(clientId)
  if (!object) return false

  const response = new Response(object.body, {
    headers: {
      'content-type': 'application/json',
      'cache-control': 'public, max-age=31536000, immutable',
    },
  })

  ctx.waitUntil(cache.put(cacheKey, response.clone()))

  return (await response.json()) as ClientConfig
}
