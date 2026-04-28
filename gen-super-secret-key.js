import { toBase64UrlString } from '@sovereignbase/bytecodec'

const byts = await crypto.getRandomValues(new Uint8Array(128))

console.log(toBase64UrlString(byts))
