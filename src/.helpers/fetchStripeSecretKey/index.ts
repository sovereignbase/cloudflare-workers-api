import {
  Cryptographic,
  type OpaqueIdentifier,
} from '@sovereignbase/cryptosuite'
import { Bytes } from '@sovereignbase/bytecodec'
import type { AppContext } from '../../.types/types.js'
import { decode } from '@msgpack/msgpack'

let baseKey: Base64URLString | undefined

/**
 * Resolves and decrypts the Stripe secret key for an ANBS client.
 *
 * @param env The Cloudflare Worker environment bindings.
 * @param ctx The Worker or Durable Object execution context used for cache writes.
 * @param id The opaque ANBS client identifier.
 * @returns The decrypted secret key, or `false` when it is unavailable.
 */
export async function fetchStripeSecretKey(
  env: AppContext['env'],
  ctx: AppContext['executionCtx'] | DurableObjectState<{}>,
  id: OpaqueIdentifier
): Promise<string | false> {
  const objectKey = `/${id}`

  const speculativePromise = env.SECRETS.head(objectKey)

  const cacheKey = new Request(
    `https://cache.sovereignbase.dev/secrets${objectKey}`
  )

  const cache = (caches as CacheStorage & { default: Cache }).default

  const baseKeyPromise = baseKey
    ? Promise.resolve(baseKey)
    : await env.SUPER_SECRET_KEY.get()

  let secretCT: ArrayBuffer

  const cached = await cache.match(cacheKey)

  if (cached) {
    secretCT = await cached.arrayBuffer()
  } else {
    if (!(await speculativePromise)) return false

    const object = await env.SECRETS.get(objectKey)
    if (!object) return false

    secretCT = await object.arrayBuffer()

    const response = new Response(secretCT, {
      headers: {
        'content-type': 'application/msgpack',
        'cache-control': 'public, max-age=31536000, immutable',
      },
    })

    ctx.waitUntil(cache.put(cacheKey, response))
  }

  const resolvedBaseKey = (await baseKeyPromise) as Base64URLString
  if (!resolvedBaseKey) return false

  const decoded = decode(secretCT) as {
    iv: Uint8Array
    salt: Uint8Array
    ciphertext: ArrayBuffer
  }

  const { iv, salt, ciphertext } = decoded

  if (
    !(iv instanceof Uint8Array) ||
    iv.byteLength !== 12 ||
    !(salt instanceof Uint8Array) ||
    salt.byteLength !== 16 ||
    !(ciphertext instanceof ArrayBuffer)
  ) {
    return false
  }

  const { cipherKey } = await Cryptographic.cipherMessage.deriveKey(
    Bytes.fromBase64UrlString(resolvedBaseKey),
    { salt }
  )

  const plaintext = await Cryptographic.cipherMessage.decrypt(cipherKey, {
    iv,
    ciphertext,
  })

  return Bytes.toString(plaintext)
}
