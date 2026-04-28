import { AppContext } from '../../.types'

/**
 * Creates a Cloudflare access rule that blocks an IP address.
 *
 * @param env The Cloudflare Worker environment bindings.
 * @param ipAddress The IP address to block.
 * @param reason The rule note and diagnostic reason.
 * @returns The created Cloudflare access rule id.
 */
export async function blockIPAddress(
  env: AppContext['env'],
  ipAddress: string,
  reason: string
): Promise<string> {
  const token = await env.IP_BLOCK_TOKEN.get()

  const res = await fetch(
    `https://api.cloudflare.com/client/v4/zones/${env.ZONE_ID}/firewall/access_rules/rules`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        mode: 'block',
        configuration: {
          target: 'ip',
          value: ipAddress,
        },
        notes: reason,
      }),
    }
  )

  const json = await res.json<{ result: { id: string } }>()

  return json.result.id
}
