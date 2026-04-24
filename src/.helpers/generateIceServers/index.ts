/// <reference lib="dom" />

import { AppContext } from "../../.types/index.js";

export async function generateIceServers(
  ctx: AppContext,
): Promise<RTCIceServer[] | false> {
  const raw = await fetch(
    `https://rtc.live.cloudflare.com/v1/turn/keys/${ctx.env.TURN_TOKEN_ID}/credentials/generate-ice-servers`,
    {
      headers: {
        Authorization: `Bearer ${await ctx.env.TURN_API_TOKEN.get()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ttl: 86400 }),
    },
  );
  const json = await raw.json();
  if (typeof json === "object" && Object.hasOwn(json, "iceServers")) {
    const { iceServers } = json as { iceServers: RTCIceServer[] };
    return iceServers;
  }
  return false;
}
