/// <reference lib="dom" />

import { AppContext } from '../../.types/index.js'

/**
 * Generates Cloudflare Calls TURN credentials for WebRTC clients.
 *
 * @param env The Cloudflare Worker environment bindings.
 * @returns The generated ICE server list, or `false` when the response shape is unsupported.
 */
export async function generateIceServers(
  env: AppContext['env']
): Promise<RTCIceServer[] | false> {
  const raw = await fetch(
    `https://rtc.live.cloudflare.com/v1/turn/keys/${env.TURN_TOKEN_ID}/credentials/generate-ice-servers`,
    {
      headers: {
        Authorization: `Bearer ${await env.TURN_API_TOKEN.get()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ttl: 86400 }),
    }
  )
  const json = await raw.json()
  if (typeof json === 'object' && Object.hasOwn(json, 'iceServers')) {
    const { iceServers } = json as { iceServers: RTCIceServer[] }
    return iceServers
  }
  return false
}
