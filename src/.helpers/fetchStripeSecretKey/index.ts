import {
  Cryptographic,
  type OpaqueIdentifier,
} from "@sovereignbase/cryptosuite";
import { Bytes } from "@sovereignbase/bytecodec";
import type { AppContext } from "../../.types/index.js";
import { decode } from "@msgpack/msgpack";

let baseKey: Base64URLString | undefined;

export async function fetchStripeSecretKey(
  env: AppContext["env"],
  ctx: AppContext["executionCtx"],
  clientId: OpaqueIdentifier,
): Promise<string | false> {
  if (clientId === env.ADMIN_ID)
    return (await env.STRIPE_SECRET_KEY.get()) as string;

  const objectKey = `/stripe/${clientId}`;

  const speculativePromise = env.SECRETS.head(objectKey);

  const cacheKey = new Request(
    `https://cache.sovereignbase.dev/secrets${objectKey}`,
  );

  const cache = (caches as CacheStorage & { default: Cache }).default;

  const baseKeyPromise =
    baseKey ? Promise.resolve(baseKey) : await env.SUPER_SECRET_KEY.get();

  let stripeSK: ArrayBuffer;

  const cached = await cache.match(cacheKey);

  if (cached) {
    stripeSK = await cached.arrayBuffer();
  } else {
    if (!(await speculativePromise)) return false;

    const object = await env.SECRETS.get(objectKey);
    if (!object) return false;

    stripeSK = await object.arrayBuffer();

    const response = new Response(stripeSK, {
      headers: {
        "content-type": "application/msgpack",
        "cache-control": "public, max-age=31536000, immutable",
      },
    });

    ctx.waitUntil(cache.put(cacheKey, response));
  }

  const resolvedBaseKey = (await baseKeyPromise) as Base64URLString;
  if (!resolvedBaseKey) return false;

  const decoded = decode(stripeSK) as {
    iv: Uint8Array;
    salt: Uint8Array;
    ciphertext: ArrayBuffer;
  };

  const { iv, salt, ciphertext } = decoded;

  if (
    !(iv instanceof Uint8Array) ||
    iv.byteLength !== 12 ||
    !(salt instanceof Uint8Array) ||
    salt.byteLength !== 16 ||
    !(ciphertext instanceof ArrayBuffer)
  ) {
    return false;
  }

  const { cipherKey } = await Cryptographic.cipherMessage.deriveKey(
    Bytes.fromBase64UrlString(resolvedBaseKey),
    { salt },
  );

  const plaintext = await Cryptographic.cipherMessage.decrypt(cipherKey, {
    iv,
    ciphertext,
  });

  return Bytes.toString(plaintext);
}
